// Which match each game belongs to (WP-33b). The old site put a game on the first match between
// its two teams, or on the one with the fewest games, with no check of the date or of whether the
// format was full (STATUS.md question 41, "Old flow"); a game could end up under two matches, or
// under the wrong one of the same two teams. Rules, in order:
//   1. An owner correction for the Dota game decides.
//   2. A game stored under two or more matches goes to the one whose scheduled time is nearest the
//      game's start, among those whose format is not already full without it.
//   3. A game stored under one match, which started on another day (Warsaw) than that match is
//      scheduled for and on the day of another match between the same two teams, moves there.
// A game is never put on a full match unless a correction says so; such a case is reported.
// Forfeited games are never moved. Pure: no database, no state.

import { WARSAW } from '../values';

export interface PlacementGame {
  /** Unique per stored copy (the source document path). */
  key: string;
  dotaMatchId: number | null;
  /** The match the copy is stored under. */
  sourceMatchId: string;
  start: Date | null;
  forfeit: boolean;
}

export interface PlacementMatch {
  id: string;
  teamAId: string | null;
  teamBId: string | null;
  bestOf: number;
  status: string;
  scheduledAt: Date | null;
  scoreA: number | null;
  scoreB: number | null;
}

/** An owner correction: the game belongs to `matchId`, not to `notMatchId`. */
export interface PlacementRule { id: string; dotaMatchId: number; matchId: string; notMatchId: string }

export type PlacementNote =
  | { kind: 'duplicate'; key: string; dotaMatchId: number; from: string[]; to: string; dropped: string[] }
  | { kind: 'moved'; key: string; dotaMatchId: number; from: string; to: string }
  | { kind: 'full'; key: string; dotaMatchId: number; matchId: string; wanted: string }
  | { kind: 'rule'; key: string; dotaMatchId: number; ruleId: string; from: string[]; to: string };

export interface PlacementResult {
  /** Copy key → the match it is kept under. Copies not in the map are dropped (another copy is kept). */
  placed: Map<string, string>;
  notes: PlacementNote[];
  /** Rules that matched a stored copy. */
  rulesApplied: Set<string>;
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: WARSAW, year: 'numeric', month: '2-digit', day: '2-digit' });
/** The calendar day of an instant in Warsaw, `2026-07-23`. */
export const warsawDay = (d: Date): string => dayFormat.format(d);

const pairOf = (m: PlacementMatch) => [m.teamAId ?? '', m.teamBId ?? ''].sort().join('|');

export function placeGames(games: readonly PlacementGame[], matches: readonly PlacementMatch[], rules: readonly PlacementRule[] = []): PlacementResult {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const placed = new Map(games.map((g) => [g.key, g.sourceMatchId]));
  const notes: PlacementNote[] = [];
  const rulesApplied = new Set<string>();
  const ruleOf = new Map(rules.map((r) => [r.dotaMatchId, r]));
  // Games on a match other than `game`: forfeits and other Dota games, each counted once.
  // Quadratic in the games: fine for an import, but it must not go into the per-game live path as is (WP-13b).
  const others = (matchId: string, dota: number | null) => new Set(games
    .filter((g) => placed.get(g.key) === matchId && (g.dotaMatchId === null || g.dotaMatchId !== dota))
    .map((g) => (g.dotaMatchId === null ? g.key : String(g.dotaMatchId)))).size;
  const full = (matchId: string, dota: number | null) => isFull(byId.get(matchId), others(matchId, dota));

  const copies = new Map<number, PlacementGame[]>();
  for (const g of games) {
    if (g.forfeit || g.dotaMatchId === null) continue;
    copies.set(g.dotaMatchId, [...(copies.get(g.dotaMatchId) ?? []), g]);
  }
  const ordered = [...copies.entries()].sort(([, a], [, b]) => time(a[0].start) - time(b[0].start));
  for (const [dota, list] of ordered) {
    const keep = list[0];
    const from = list.map((c) => c.sourceMatchId);
    const rule = ruleOf.get(dota);
    if (rule && byId.has(rule.matchId) && (from.includes(rule.notMatchId) || from.includes(rule.matchId))) {
      rulesApplied.add(rule.id);
      const kept = settle(placed, list, keep, rule.matchId);
      notes.push({ kind: 'rule', key: kept, dotaMatchId: dota, ruleId: rule.id, from, to: rule.matchId });
      continue;
    }
    if (list.length > 1) {
      const open = from.filter((id) => !full(id, dota));
      const to = nearest(open.length ? open : from, keep.start, byId);
      const kept = settle(placed, list, keep, to);
      if (!open.length) notes.push({ kind: 'full', key: kept, dotaMatchId: dota, matchId: to, wanted: to });
      notes.push({ kind: 'duplicate', key: kept, dotaMatchId: dota, from, to, dropped: list.filter((c) => c.key !== kept).map((c) => c.key) });
      continue;
    }
    const moved = sameDayMatch(keep, byId, matches);
    if (!moved) continue;
    if (full(moved, dota)) {
      notes.push({ kind: 'full', key: keep.key, dotaMatchId: dota, matchId: keep.sourceMatchId, wanted: moved });
      continue;
    }
    placed.set(keep.key, moved);
    notes.push({ kind: 'moved', key: keep.key, dotaMatchId: dota, from: keep.sourceMatchId, to: moved });
  }
  return { placed, notes, rulesApplied };
}

/** Full without the game: as many games as the format allows, or completed with every game of its score. */
export function isFull(match: PlacementMatch | undefined, games: number): boolean {
  if (!match) return true;
  if (games >= match.bestOf) return true;
  const played = (match.scoreA ?? 0) + (match.scoreB ?? 0);
  return match.status === 'completed' && match.scoreA !== null && match.scoreB !== null && played > 0 && games >= played;
}

/** One copy is kept under `to`, the one stored there when there is one (its performances go with it); the others are dropped. */
function settle(placed: Map<string, string>, list: readonly PlacementGame[], first: PlacementGame, to: string): string {
  const keep = list.find((c) => c.sourceMatchId === to) ?? first;
  for (const c of list) placed.delete(c.key);
  placed.set(keep.key, to);
  return keep.key;
}

const time = (d: Date | null) => d?.getTime() ?? Number.MAX_SAFE_INTEGER;

/**
 * The match scheduled nearest the start (without a start, every match is equally near).
 * Ties, in order: the earlier scheduled match, then a scheduled one before an unscheduled one,
 * then the lower match id. Never the order the capture happens to list them in.
 */
export function nearest(ids: readonly string[], start: Date | null, byId: ReadonlyMap<string, PlacementMatch>): string {
  const at = (id: string) => byId.get(id)?.scheduledAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const distance = (id: string) => (start && Number.isFinite(at(id)) ? Math.abs(at(id) - start.getTime()) : Number.POSITIVE_INFINITY);
  // Infinity - Infinity is NaN, which is falsy: two unscheduled matches fall through to the id.
  const order = (x: string, y: string) => distance(x) - distance(y) || at(x) - at(y) || (x < y ? -1 : x > y ? 1 : 0);
  return [...ids].sort(order)[0];
}

/** Another match of the same two teams scheduled on the game's day, when the game's own match is on another day. */
function sameDayMatch(game: PlacementGame, byId: ReadonlyMap<string, PlacementMatch>, matches: readonly PlacementMatch[]): string | null {
  const own = byId.get(game.sourceMatchId);
  if (!own?.scheduledAt || !game.start || !own.teamAId || !own.teamBId) return null;
  const day = warsawDay(game.start);
  if (warsawDay(own.scheduledAt) === day) return null;
  const candidates = matches.filter((m) => m.id !== own.id && pairOf(m) === pairOf(own) && m.scheduledAt && warsawDay(m.scheduledAt) === day);
  return candidates.length ? nearest(candidates.map((m) => m.id), game.start, byId) : null;
}
