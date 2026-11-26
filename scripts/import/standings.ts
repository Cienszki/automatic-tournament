// The proof that nothing was lost: the standings computed by the new code (WP-13a's
// computeStandings) from the imported rows, compared with what the old site published (WP-12's
// `published/standings.json`) or, where nothing was published, with the standings the old site
// stored on its group documents.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { computeStandings, parseRankingRules, type StandingsMatch, type StandingsTeam } from '@/features/formats';
import * as s from '@/platform/db/schema';
import type { Db } from '@/platform/db/types';
import type { StoredTable } from './legacy-letnia';
import type { Capture } from './source';

interface PublishedRow {
  place: number; teamId: string; matchesPlayed: number; wins: number; draws: number; losses: number; points: number;
  gamesWon: number; gamesLost: number; neustadtl: number; buchholz?: number;
}
interface PublishedTable { groupId: string; groupName: string; order: string[]; divisionView: PublishedRow[] }

export interface TableComparison {
  groupId: string;
  groupName: string;
  /** `published`: the old site's table (WP-12); `stored`: the standings saved on the old group document. */
  against: 'published' | 'stored' | 'none';
  orderMatches: boolean | null;
  /** One line per value that differs, owner corrections aside. */
  differences: string[];
  /**
   * Values that differ only because of an owner correction (owner-corrections.json): the table
   * computed from the matches as the source stored them has the published value.
   */
  corrected: string[];
  /** Why differences are expected, when they are. */
  explanation?: string;
}

/** `published/standings.json` for a slug: next to the capture, in a sibling `published/<slug>`, or in a given folder. */
export function findPublished(capture: Capture, dirs: readonly string[]): PublishedTable[] | null {
  const candidates = [
    join(capture.dir, 'published', 'standings.json'),
    join(capture.dir, '..', 'published', capture.slug, 'standings.json'),
    ...dirs.flatMap((d) => [join(d, capture.slug, 'published', 'standings.json'), join(d, capture.slug, 'standings.json')]),
  ];
  const file = candidates.find(existsSync);
  return file ? (JSON.parse(readFileSync(file, 'utf8')) as { tables: PublishedTable[] }).tables : null;
}

/**
 * Each group's standings, computed from the imported rows with the stage's stored rules. With
 * `before`, the matches an owner correction changed take the values the source stored instead.
 */
export async function computeImportedStandings(db: Db, tournamentId: string, before?: ReadonlyMap<string, Record<string, unknown>>) {
  const stages = await db.select().from(s.stages).where(eq(s.stages.tournamentId, tournamentId));
  const groups = await db.select().from(s.groups).where(eq(s.groups.tournamentId, tournamentId));
  const members = await db.select().from(s.teamMembers)
    .where(and(eq(s.teamMembers.tournamentId, tournamentId), isNull(s.teamMembers.leftAt), ne(s.teamMembers.kind, 'coach')));
  const teams = await db.select().from(s.teams).where(eq(s.teams.tournamentId, tournamentId));
  const groupTeams = await db.select().from(s.groupTeams).where(eq(s.groupTeams.tournamentId, tournamentId));
  const matches = await db.select().from(s.matches).where(eq(s.matches.tournamentId, tournamentId));
  const replaced = new Set(matches.map((m) => m.replacesMatchId).filter(Boolean));
  const mmr = new Map<string, number>();
  for (const m of members) if (m.mmr && m.mmr > 0) mmr.set(m.teamId, (mmr.get(m.teamId) ?? 0) + m.mmr);
  const out = [];
  for (const group of groups) {
    const stage = stages.find((st) => st.id === group.stageId)!;
    if (!stage.ranking) continue;
    const ids = new Set(groupTeams.filter((g) => g.groupId === group.id).map((g) => g.teamId));
    const input: StandingsTeam[] = teams.filter((t) => ids.has(t.id)).map((t) => ({
      id: t.id, name: t.name, ...(mmr.has(t.id) ? { mmr: mmr.get(t.id)! } : {}),
    }));
    const groupMatches: StandingsMatch[] = matches.filter((m) => m.groupId === group.id).map((row) => {
      const m = { ...row, ...(before?.get(row.id) as Partial<typeof row> | undefined) };
      return { id: m.id, teamAId: m.teamAId, teamBId: m.teamBId, scoreA: m.scoreA, scoreB: m.scoreB, status: m.status, kind: m.kind, replaced: replaced.has(m.id), round: m.round };
    });
    const rules = parseRankingRules(stage.ranking);
    out.push({ group, rules, standings: computeStandings({ teams: input, matches: groupMatches, rules }) });
  }
  return out;
}

type Computed = Awaited<ReturnType<typeof computeImportedStandings>>[number];
type Rows = Computed['standings']['rows'];
interface Difference { key: string; text: string }

/** Every value of a computed table that is not the published one, keyed by team and column. */
function publishedDifferences({ rules, standings }: Computed, table: PublishedTable): { orderMatches: boolean; zeroGames: boolean; list: Difference[] } {
  const rows = standings.rows;
  const list: Difference[] = [];
  const order = rows.map((r) => r.teamId);
  // Teams sharing a place are listed in id order; the old page used its own order for them.
  const orderMatches = order.every((id, i) => id === table.order[i] || rows[i].sharedPlace);
  if (!orderMatches) list.push({ key: 'order', text: `order: published ${table.order.join(', ')}; computed ${order.join(', ')}` });
  const games = rules.points === 'games_won';
  const zeroGames = table.divisionView.every((r) => r.gamesWon === 0 && r.gamesLost === 0);
  for (const row of rows) {
    const p = table.divisionView.find((r) => r.teamId === row.teamId);
    if (!p) {
      list.push({ key: `${row.teamId}/missing`, text: `${row.teamName}: not in the published table` });
      continue;
    }
    const ours: Record<string, number> = {
      matchesPlayed: row.record.played, wins: row.record.wins, draws: row.record.draws, losses: row.record.losses,
      points: row.record.points, neustadtl: games ? row.record.buchholz : row.record.neustadtl,
      ...(zeroGames ? {} : { gamesWon: row.record.gamesWon, gamesLost: row.record.gamesLost }),
    };
    for (const [k, v] of Object.entries(ours)) {
      const theirs = (p as unknown as Record<string, number>)[k];
      if (theirs !== v) list.push({ key: `${row.teamId}/${k}`, text: `${row.teamName}: ${k} published ${theirs}, computed ${v}` });
    }
    if (!row.sharedPlace && p.place !== row.place) list.push({ key: `${row.teamId}/place`, text: `${row.teamName}: place published ${p.place}, computed ${row.place}` });
  }
  for (const p of table.divisionView) if (!rows.some((r) => r.teamId === p.teamId)) list.push({ key: `${p.teamId}/extra`, text: `${p.teamId}: published, but not in the imported group` });
  return { orderMatches, zeroGames, list };
}

export async function compareStandings(
  db: Db, capture: Capture, dirs: readonly string[], stored: StoredTable[] | undefined,
  before: ReadonlyMap<string, Record<string, unknown>> = new Map(),
): Promise<TableComparison[]> {
  const computed = await computeImportedStandings(db, capture.tournamentId);
  const original = before.size ? await computeImportedStandings(db, capture.tournamentId, before) : computed;
  const published = findPublished(capture, dirs);
  return computed.map((c, i) => {
    const { group } = c;
    const table = published?.find((t) => t.groupId === group.id);
    if (table) {
      const now = publishedDifferences(c, table);
      const was = new Set(publishedDifferences(original[i], table).list.map((d) => d.key));
      return {
        groupId: group.id, groupName: group.name, against: 'published' as const, orderMatches: now.orderMatches,
        differences: now.list.filter((d) => was.has(d.key)).map((d) => d.text),
        corrected: now.list.filter((d) => !was.has(d.key)).map((d) => d.text),
        ...(now.zeroGames ? { explanation: 'games won and lost are not compared: the old page shows 0:0 for every team (it reads a stored total the server never wrote for group tournaments; WP-13a)' } : {}),
      };
    }
    const saved = stored?.find((t) => t.groupId === group.id);
    if (saved) return compareStored(group.id, group.name, c.standings.rows, saved);
    return { groupId: group.id, groupName: group.name, against: 'none' as const, orderMatches: null, differences: [], corrected: [] };
  });
}


/** The old group documents store a record per team but no order. */
function compareStored(groupId: string, groupName: string, rows: Rows, saved: StoredTable): TableComparison {
  const differences: string[] = [];
  for (const row of rows) {
    const p = saved.rows.find((r) => r.teamId === row.teamId);
    if (!p) {
      differences.push(`${row.teamName}: not in the stored standings`);
      continue;
    }
    const ours: Record<string, number> = { matchesPlayed: row.record.played, wins: row.record.wins, draws: row.record.draws, losses: row.record.losses, points: row.record.points };
    for (const [k, v] of Object.entries(ours)) {
      const theirs = (p as unknown as Record<string, number>)[k];
      if (theirs !== v) differences.push(`${row.teamName}: ${k} stored ${theirs}, computed ${v}`);
    }
  }
  for (const p of saved.rows) if (!rows.some((r) => r.teamId === p.teamId)) differences.push(`${p.teamId}: in the stored standings, not in the imported group`);
  // A stored record that counts fewer matches than were played was not updated after them.
  const stale = rows.filter((r) => {
    const p = saved.rows.find((x) => x.teamId === r.teamId);
    return p && p.matchesPlayed < r.record.played;
  }).length;
  const differing = new Set(differences.map((d) => d.split(':')[0])).size;
  const explanation = differences.length && stale === differing
    ? `${rows.length - differing} of ${rows.length} teams agree, and every team that differs has a stored record with fewer matches than it played: the stored standings were not updated after those matches. The old code wrote them from the matches (recalculateGroupStandingsAdmin in src/lib/post-sync-recalculations.ts) only when an admin ran it; the new code always computes them from the matches`
    : undefined;
  return { groupId, groupName, against: 'stored', orderMatches: null, differences, corrected: [], ...(explanation ? { explanation } : {}) };
}
