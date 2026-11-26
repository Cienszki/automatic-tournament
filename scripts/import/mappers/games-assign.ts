// The two decisions about a game that the old data got wrong, applied to the game drafts: which
// match it belongs to (placement.ts) and which teams played it (game-teams.ts). Each decision
// that differs from what the source stored is a finding naming the game readably.

import * as s from '@/platform/db/schema';
import { docsOf, type Doc } from '../source';
import { toBool, toInt } from '../values';
import { approvedStandins } from './apply-corrections';
import { resolveGameTeams, type GamePlayer, type Pick } from './game-teams';
import { placeGames, type PlacementMatch } from './placement';
import { steamOf } from './performances';
import { arr, obj } from './read';
import type { MapState } from './state';

const KIND = 'matches.games';

export interface Draft {
  doc: Doc;
  row: Record<string, unknown>;
  forfeit: boolean;
  number: number | null;
  start: number;
  /** The match the game document is stored under. */
  sourceMatchId: string;
}

const asDate = (v: unknown) => (v instanceof Date ? v : null);

/** Each draft's match by date and format; drafts of a game stored twice are dropped but one. */
export function placeDrafts(state: MapState, drafts: readonly Draft[]): Draft[] {
  const matches: PlacementMatch[] = state.rows.get(s.matches).map((m) => ({
    id: m.id as string, teamAId: m.teamAId as string | null, teamBId: m.teamBId as string | null, bestOf: m.bestOf as number,
    status: m.status as string, scheduledAt: asDate(m.scheduledAt), scoreA: m.scoreA as number | null, scoreB: m.scoreB as number | null,
  }));
  const rules = state.corrections.of('game').map((c) => ({ id: c.id, dotaMatchId: c.dotaMatchId, matchId: c.matchId, notMatchId: c.notMatchId }));
  const result = placeGames(drafts.map((d) => ({
    key: d.doc.path, dotaMatchId: d.row.dotaMatchId as number | null, sourceMatchId: d.sourceMatchId, start: asDate(d.row.startedAt), forfeit: d.forfeit,
  })), matches, rules);
  for (const c of state.corrections.of('game')) {
    if (result.rulesApplied.has(c.id)) state.corrections.applied(c, `kept under ${c.matchId}, not ${c.notMatchId}`);
  }
  const byKey = new Map(drafts.map((d) => [d.doc.path, d]));
  for (const note of result.notes) {
    const game = String(note.dotaMatchId);
    if (note.kind === 'moved') {
      state.ctx.finding({ kind: KIND, code: 'decision', about: { matchId: note.to, game }, ref: `${note.key} -> ${note.to}`,
        reason: 'a game started on another day than its match is scheduled for, and on the day of another match of the same two teams: moved to that match' });
    } else if (note.kind === 'full') {
      state.ctx.finding({ kind: KIND, code: 'conflict', about: { matchId: note.matchId, game }, ref: `${note.key} (wanted: ${note.wanted})`,
        reason: 'a game would belong to a match whose format is already full (or which is completed with all its games); it stays where it is (owner to confirm)' });
    } else {
      const why = note.kind === 'rule' ? 'the match an owner correction names' : 'the match scheduled nearest its start whose format is not full';
      const alsoUnder = note.from.filter((id) => id !== note.to);
      for (const d of drafts.filter((x) => x.row.dotaMatchId === note.dotaMatchId && result.placed.get(x.doc.path) === undefined)) {
        state.ctx.outcome(KIND, 'unmapped', `the same Dota game is stored under two matches; it is kept under ${why}`, `${d.doc.path} (kept under ${note.to})`, { matchId: note.to, game, alsoUnder });
      }
    }
  }
  const kept: Draft[] = [];
  for (const [key, matchId] of result.placed) {
    const d = byKey.get(key)!;
    d.row.matchId = matchId;
    kept.push(d);
  }
  return kept;
}

/** Performances of each game document, by the document's path. */
function performancesByGame(state: MapState): Map<string, Doc[]> {
  const out = new Map<string, Doc[]>();
  for (const p of docsOf(state.capture, 'matches.games.performances')) {
    const game = p.path.slice(0, p.path.lastIndexOf('/performances/'));
    out.set(game, [...(out.get(game) ?? []), p]);
  }
  return out;
}

/** Account → the teams it can play for in a game of `matchId` that started at `start`. */
function rosterAccounts(state: MapState, matchId: string, start: Date | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (steam: unknown, team: string) => {
    if (typeof steam !== 'string') return;
    out.set(steam, [...(out.get(steam) ?? []), team]);
  };
  for (const m of state.rows.get(s.teamMembers)) {
    if (m.kind === 'coach') continue;
    const left = asDate(m.leftAt);
    if (left && start && left <= start) continue;
    add(m.steamId64, m.teamId as string);
    for (const smurf of arr(m.smurfAccounts)) add(obj(smurf).steamId64, m.teamId as string);
  }
  // A stand-in approved for this match plays for that team only.
  for (const [steam, team] of approvedStandins(state, matchId)) out.set(steam, [team]);
  return out;
}

/** Radiant and Dire of every played game from its players; the stored labels only when they decide nothing. */
export function resolveTeams(state: MapState, drafts: readonly Draft[]): void {
  const perfs = performancesByGame(state);
  const names = (id: unknown) => (typeof id === 'string' ? state.teamNames.get(id) ?? id : 'none');
  for (const d of drafts) {
    if (d.forfeit) continue;
    const matchId = d.row.matchId as string;
    const start = asDate(d.row.startedAt);
    const players: GamePlayer[] = (perfs.get(d.doc.path) ?? []).flatMap((p) => {
      const steamId64 = steamOf(state, p);
      return steamId64 ? [{ steamId64, heroId: toInt(p.data.heroId), isRadiant: toBool(p.data.isRadiant) }] : [];
    });
    const picks: Pick[] = arr(d.doc.data.picksBans).map(obj).map((p) => ({ heroId: toInt(p.hero_id), isPick: toBool(p.is_pick), team: toInt(p.team) }));
    const match = state.matchTeams.get(matchId);
    const labels = { radiant: d.row.radiantTeamId as string | null, dire: d.row.direTeamId as string | null };
    const result = resolveGameTeams({ players, picks, labels, teamsOf: rosterAccounts(state, matchId, start), matchTeams: [match?.a ?? null, match?.b ?? null] });
    d.row.radiantTeamId = result.radiant;
    d.row.direTeamId = result.dire;
    const game = String(d.row.dotaMatchId ?? d.doc.id);
    if (result.disagrees) {
      state.ctx.finding({
        kind: KIND, code: 'conflict', about: { matchId, game }, ref: d.doc.path,
        reason: 'the players of a game are of other teams than its stored labels; the teams are taken from the players',
      });
    }
    const ofMatch = (team: string | null) => team === match?.a || team === match?.b;
    if (result.by === 'players' && match && (!ofMatch(result.radiant) || !ofMatch(result.dire))) {
      state.ctx.finding({
        kind: KIND, code: 'conflict', about: { matchId, game }, ref: `${d.doc.path} ${names(result.radiant)} / ${names(result.dire)}`,
        reason: 'the players of a game are of other teams than its match; the players\' teams are kept (owner to confirm)',
      });
    }
  }
}
