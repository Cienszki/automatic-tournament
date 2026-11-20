// What a run of the mappers keeps beside the rows: an account of every source document (mapped,
// merged into another row, dropped by a rule, or not imported), every finding worth a line in the
// report, and the people and players that rows refer to.

import type { Doc } from './source';
import { isUserId, toSteam64 } from './values';

/** What happened to one source document. */
export type Outcome = 'mapped' | 'merged' | 'dropped' | 'unmapped';

/** A finding: something the import decided, could not do, or saw disagree. */
export interface Finding {
  kind: string;
  /** `unmapped` (a document or value was not imported), `unknown-field` (a field no mapper names), `conflict`, `decision`. */
  code: 'unmapped' | 'unknown-field' | 'conflict' | 'decision';
  /** A sentence without ids, so findings with the same reason group together. */
  reason: string;
  /** The document or value it is about. */
  ref?: string;
}

export interface KindAccount {
  read: number;
  outcomes: Record<Outcome, number>;
  /** Why documents were dropped or not imported, with a count each. */
  reasons: Record<string, number>;
}

export interface PlayerInfo {
  steamId64: string;
  nickname?: string | null;
  personaName?: string | null;
  avatarUrl?: string | null;
  avatarMediumUrl?: string | null;
  avatarFullUrl?: string | null;
  topHeroes?: unknown;
}

export class ImportContext {
  readonly findings: Finding[] = [];
  readonly accounts = new Map<string, KindAccount>();
  /** User ids that rows refer to, with where each was first seen. */
  readonly userRefs = new Map<string, string>();
  /** Steam players that rows refer to, with whatever the source said about them. */
  readonly players = new Map<string, PlayerInfo>();

  constructor(readonly tournamentId: string) {}

  private account(kind: string): KindAccount {
    let a = this.accounts.get(kind);
    if (!a) {
      a = { read: 0, outcomes: { mapped: 0, merged: 0, dropped: 0, unmapped: 0 }, reasons: {} };
      this.accounts.set(kind, a);
    }
    return a;
  }

  /** Count the documents of a kind before mapping them. */
  read(kind: string, docs: readonly Doc[]): void {
    this.account(kind).read += docs.length;
  }

  outcome(kind: string, outcome: Outcome, reason?: string, ref?: string): void {
    const a = this.account(kind);
    a.outcomes[outcome]++;
    if (reason) a.reasons[`${outcome}: ${reason}`] = (a.reasons[`${outcome}: ${reason}`] ?? 0) + 1;
    if (outcome === 'unmapped' && reason) this.finding({ kind, code: 'unmapped', reason, ref });
  }

  /** A whole kind dropped by a rule of SCHEMA.md (derived or bookkeeping data). */
  dropKind(kind: string, docs: readonly Doc[], reason: string): void {
    this.read(kind, docs);
    for (let i = 0; i < docs.length; i++) this.outcome(kind, 'dropped', reason);
  }

  finding(f: Finding): void {
    this.findings.push(f);
  }

  /**
   * Record every top-level field of `doc` that is not in `known`. A field the mappers do not
   * name is not imported anywhere, so it must be visible in the report.
   */
  checkFields(kind: string, doc: Doc, known: ReadonlySet<string>): void {
    for (const field of Object.keys(doc.data)) {
      if (!known.has(field)) this.finding({ kind, code: 'unknown-field', reason: `field "${field}" is not imported`, ref: doc.path });
    }
  }

  /** A user id from the data, or null (with a finding) when the value is not one. */
  user(value: unknown, where: string): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!isUserId(value)) {
      this.finding({ kind: where.split(':')[0], code: 'unmapped', reason: 'a user reference is not a Firebase user id; left empty', ref: `${where} = ${String(value)}` });
      return null;
    }
    if (!this.userRefs.has(value)) this.userRefs.set(value, where);
    return value;
  }

  /** A Steam player that a row refers to; returns the Steam64, or null when the value is none. */
  player(value: unknown, info: Omit<PlayerInfo, 'steamId64'> = {}): string | null {
    const steamId64 = toSteam64(value);
    if (!steamId64) return null;
    const known = this.players.get(steamId64) ?? { steamId64 };
    // The first source that names a value wins; later ones only fill gaps.
    for (const [key, v] of Object.entries(info) as Array<[keyof PlayerInfo, unknown]>) {
      if (v !== undefined && v !== null && v !== '' && (known[key] === undefined || known[key] === null)) {
        (known as unknown as Record<string, unknown>)[key] = v;
      }
    }
    this.players.set(steamId64, known);
    return steamId64;
  }
}

/** Field names as a set, for `checkFields`. */
export const fields = (...names: string[]): ReadonlySet<string> => new Set(names);
