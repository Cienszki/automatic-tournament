// What the mappers of one tournament share while they run: the source, the findings, the rows
// produced so far, and lookups the later mappers need from the earlier ones (which teams, members,
// groups and matches exist). Mappers run in a fixed order (map.ts).

import type { ZodTypeAny, z } from 'zod';
import type { ImportContext } from '../context';
import type { RowSet } from '../rows';
import type { Capture, GlobalCapture } from '../source';

export interface MemberInfo {
  teamId: string;
  steamId64: string | null;
  kind: 'player' | 'substitute' | 'coach';
  nickname: string;
}

export interface RegistrationInfo {
  steamId64: string;
  nickname: string;
  mmr: number | null;
}

export interface MapOptions {
  anonymize: boolean;
}

export interface MapState {
  capture: Capture;
  global: GlobalCapture | null;
  ctx: ImportContext;
  rows: RowSet;
  tournamentId: string;
  options: MapOptions;
  /** Slug → tournament id, from the global `tournaments` collection and the captures being imported. */
  slugToId: Map<string, string>;
  stageKinds: Map<string, 'round_robin' | 'swiss' | 'bracket'>;
  /** Group id → its stage id. */
  groupStage: Map<string, string>;
  teamIds: Set<string>;
  teamNames: Map<string, string>;
  members: Map<string, MemberInfo>;
  /** `${teamId}/${steamId64}` → member id, for references by Steam id. */
  memberBySteam: Map<string, string>;
  matchTeams: Map<string, { a: string | null; b: string | null; bestOf: number }>;
  registrations: Map<string, RegistrationInfo>;
  /** Games per match (real and forfeited). */
  gameCounts: Map<string, number>;
  /** Match id → old game document id → new game id. */
  gameIds: Map<string, Map<string, string>>;
}

export function newMapState(base: Pick<MapState, 'capture' | 'global' | 'ctx' | 'rows' | 'options' | 'slugToId'>): MapState {
  return {
    ...base,
    tournamentId: base.capture.tournamentId,
    stageKinds: new Map(),
    groupStage: new Map(),
    teamIds: new Set(),
    teamNames: new Map(),
    members: new Map(),
    memberBySteam: new Map(),
    matchTeams: new Map(),
    registrations: new Map(),
    gameCounts: new Map(),
    gameIds: new Map(),
  };
}

/**
 * Parse a JSON column value with its schema. When it does not fit, report each problem and drop
 * the offending keys (they are all optional ones in practice); if it still does not fit, throw,
 * because a required JSON column cannot be written.
 */
export function fitJson<S extends ZodTypeAny>(state: MapState, schema: S, value: unknown, where: string): z.infer<S> {
  const first = schema.safeParse(value);
  if (first.success) return first.data;
  const copy = structuredClone(value) as Record<string, unknown>;
  for (const issue of first.error.issues) {
    state.ctx.finding({ kind: where.split(' ')[0], code: 'unmapped', reason: `a value does not fit the JSON schema and is left out: ${issue.message}`, ref: `${where} /${issue.path.join('/')}` });
    removePath(copy, issue.path);
  }
  const second = schema.safeParse(copy);
  if (second.success) return second.data;
  throw new Error(`${where}: does not fit its JSON schema: ${second.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
}

function removePath(obj: unknown, path: ReadonlyArray<string | number>): void {
  if (!path.length) return;
  let cur = obj as Record<string | number, unknown> | undefined;
  for (const key of path.slice(0, -1)) {
    if (!cur || typeof cur !== 'object') return;
    cur = cur[key] as Record<string | number, unknown> | undefined;
  }
  if (!cur || typeof cur !== 'object') return;
  const last = path[path.length - 1];
  if (Array.isArray(cur) && typeof last === 'number') cur.splice(last, 1);
  else delete cur[last];
}
