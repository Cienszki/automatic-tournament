// Games and performances (SCHEMA.md 7.3, 7.5). A real game keeps its Dota match id as its id; a
// forfeited game, whose old id (`forfeit_game1`) repeats in every match, becomes
// `<matchId>-forfeit-<n>`. Forfeited games keep their numbers; played games take the free numbers
// in order of start time.

import * as s from '@/platform/db/schema';
import { picksBansSchema } from '@/platform/db/schema/json';
import { fields } from '../context';
import { ancestorId, docsOf, type Doc } from '../source';
import { fromUnixSeconds, toBool, toInt, toText } from '../values';
import { arr, obj, timeOf } from './read';
import { mapPerformances } from './performances';
import { fitJson, type MapState } from './state';

const KIND = 'matches.games';
const GAME_FIELDS = fields(
  'id', 'match_id', 'game_number', 'is_forfeit', 'forfeit_by_team_id', 'radiant_win', 'duration', 'start_time',
  'firstBloodTime', 'radiant_team', 'dire_team', 'radiantTeam', 'direTeam', 'picksBans', 'manualTeamMapping',
  'isManualImport', 'uploadMethod', 'uploadedAt', 'uploadedBy', 'isParsed', 'lastReprocessed', 'lastUpdated',
  'resyncedAt', 'teamAssignmentUpdated', 'description',
);

export interface GameDraft { doc: Doc; row: Record<string, unknown>; forfeit: boolean; number: number | null; start: number }

export function mapGames(state: MapState): void {
  const docs = docsOf(state.capture, KIND);
  state.ctx.read(KIND, docs);
  const drafts: Array<GameDraft & { matchId: string }> = [];
  for (const doc of docs) {
    state.ctx.checkFields(KIND, doc, GAME_FIELDS);
    const matchId = ancestorId(doc);
    if (!state.matchTeams.has(matchId)) {
      state.ctx.outcome(KIND, 'unmapped', 'the match of the game is not imported', doc.path);
      continue;
    }
    drafts.push({ ...gameDraft(state, doc, matchId), matchId });
  }
  const byMatch = new Map<string, GameDraft[]>();
  for (const draft of keepOnePerDotaGame(state, drafts)) {
    if (!byMatch.has(draft.matchId)) byMatch.set(draft.matchId, []);
    byMatch.get(draft.matchId)!.push(draft);
  }
  const matches = new Map(state.rows.get(s.matches).map((m) => [m.id as string, m]));
  for (const [matchId, list] of byMatch) {
    numberGames(state, matchId, list);
    checkScore(state, matches.get(matchId), list);
  }
  mapPerformances(state);
}

/**
 * A completed match whose stored score is not the count of its games' winners. The stored score
 * is kept (a draw in a series of two, or a result entered by hand, can be right), but the owner
 * sees every case. Series with a forfeited game are not checked: their score counts the forfeit.
 */
export function checkScore(state: MapState, match: Record<string, unknown> | undefined, games: readonly GameDraft[]): void {
  if (!match || match.status !== 'completed' || games.some((g) => g.forfeit)) return;
  let wa = 0;
  let wb = 0;
  for (const { row } of games) {
    if (typeof row.radiantWin !== 'boolean') continue;
    const winner = row.radiantWin ? row.radiantTeamId : row.direTeamId;
    if (winner && winner === match.teamAId) wa++;
    else if (winner && winner === match.teamBId) wb++;
  }
  const scoreA = match.scoreA as number | null;
  const scoreB = match.scoreB as number | null;
  if (scoreA === wa && scoreB === wb) return;
  state.ctx.finding({
    kind: 'matches', code: 'conflict',
    reason: 'the stored score disagrees with the imported games; the stored score is kept (owner to confirm)',
    ref: `${String(match.id)} ${String(scoreA)}:${String(scoreB)} vs games ${wa}:${wb}`,
  });
}

/**
 * A Dota game stored under two matches (a playoff game also attached to the group match of the same
 * two teams) is kept under the match it fits: the one whose series is not already full without it.
 */
function keepOnePerDotaGame<T extends GameDraft & { matchId: string }>(state: MapState, drafts: T[]): T[] {
  const byDota = new Map<number, T[]>();
  for (const d of drafts) {
    const dota = d.row.dotaMatchId as number | null;
    if (dota === null) continue;
    if (!byDota.has(dota)) byDota.set(dota, []);
    byDota.get(dota)!.push(d);
  }
  const games = (matchId: string) => drafts.filter((d) => d.matchId === matchId).length;
  const dropped = new Set<T>();
  for (const copies of byDota.values()) {
    if (copies.length < 2) continue;
    const fits = copies.filter((c) => games(c.matchId) - 1 < state.matchTeams.get(c.matchId)!.bestOf);
    const keep = fits.length === 1 ? fits[0] : copies[0];
    for (const c of copies) {
      if (c === keep) continue;
      dropped.add(c);
      state.ctx.outcome(KIND, 'unmapped', 'the same Dota game is stored under two matches; it is kept under the match whose series it fits', `${c.doc.path} (kept: ${keep.doc.path})`);
    }
  }
  return drafts.filter((d) => !dropped.has(d));
}

function teamOf(state: MapState, doc: Doc, side: 'radiant' | 'dire'): string | null {
  const d = doc.data;
  const manual = obj(obj(d.manualTeamMapping)[side]);
  const snake = obj(d[`${side}_team`]);
  const camel = obj(d[`${side}Team`]);
  const id = toText(manual.id) ?? toText(snake.id) ?? toText(snake.team_id) ?? toText(camel.id);
  if (id && !state.teamIds.has(id)) {
    state.ctx.finding({ kind: KIND, code: 'unmapped', reason: `the ${side} team is not a team of this tournament; left empty`, ref: `${doc.path} ${id}` });
    return null;
  }
  return id;
}

function gameDraft(state: MapState, doc: Doc, matchId: string): GameDraft {
  const d = doc.data;
  const forfeit = d.is_forfeit === true || doc.id.startsWith('forfeit_');
  const dotaText = toText(d.id) ?? doc.id;
  const dota = !forfeit && /^\d{6,12}$/.test(dotaText) ? Number(dotaText) : null;
  if (!forfeit && dota === null) state.ctx.finding({ kind: KIND, code: 'conflict', reason: 'a game that is not a forfeit has no Dota match id', ref: doc.path });
  if (toText(d.match_id) && toText(d.match_id) !== matchId) {
    state.ctx.finding({ kind: KIND, code: 'conflict', reason: 'match_id differs from the match the game is stored under; the parent is used', ref: doc.path });
  }
  const manual = d.isManualImport === true || Boolean(d.uploadMethod);
  const forfeitTeam = toText(d.forfeit_by_team_id);
  const row = {
    tournamentId: state.tournamentId, id: dota !== null ? String(dota) : doc.id, matchId, number: 0, dotaMatchId: dota,
    radiantTeamId: teamOf(state, doc, 'radiant'), direTeamId: teamOf(state, doc, 'dire'),
    radiantWin: forfeit ? null : toBool(d.radiant_win), isForfeit: forfeit,
    forfeitTeamId: forfeitTeam && state.teamIds.has(forfeitTeam) ? forfeitTeam : null,
    startedAt: fromUnixSeconds(d.start_time), durationSeconds: toInt(d.duration), firstBloodSeconds: toInt(d.firstBloodTime),
    picksBans: fitJson(state, picksBansSchema, arr(d.picksBans).map(obj).map((p) => ({
      heroId: toInt(p.hero_id), isPick: toBool(p.is_pick), order: toInt(p.order), team: toInt(p.team),
    })), `${KIND} ${doc.path} picksBans`),
    parsed: d.isParsed === true,
    source: manual ? 'manual' : 'league-sync',
    importedBy: state.ctx.user(d.uploadedBy, `${KIND}:uploadedBy`),
    importedAt: timeOf(state, KIND, doc, 'uploadedAt', d.uploadedAt) ?? new Date(doc.createTime ?? doc.updateTime ?? '2000-01-01T00:00:00Z'),
  };
  return { doc, row, forfeit, number: toInt(d.game_number), start: toInt(d.start_time) ?? Number.MAX_SAFE_INTEGER };
}

function numberGames(state: MapState, matchId: string, drafts: GameDraft[]): void {
  const taken = new Set<number>();
  for (const g of drafts.filter((x) => x.forfeit)) {
    let n = g.number && g.number > 0 && !taken.has(g.number) ? g.number : 0;
    if (!n) {
      n = 1;
      while (taken.has(n)) n++;
      state.ctx.finding({ kind: KIND, code: 'conflict', reason: 'a forfeited game has no usable game number; it takes the next free one', ref: g.doc.path });
    }
    taken.add(n);
    g.row.number = n;
    g.row.id = `${matchId}-forfeit-${n}`;
  }
  const played = drafts.filter((x) => !x.forfeit).sort((a, b) => a.start - b.start || a.doc.id.localeCompare(b.doc.id));
  for (const g of played) {
    let n = 1;
    while (taken.has(n)) n++;
    taken.add(n);
    g.row.number = n;
  }
  const forfeits = drafts.filter((x) => x.forfeit).map((g) => g.row.number as number);
  if (played.length && forfeits.some((n) => n > Math.min(...played.map((p) => p.row.number as number)))) {
    state.ctx.finding({ kind: KIND, code: 'decision', reason: 'a series has forfeited games after played ones; numbers follow the forfeit numbers, then start time', ref: matchId });
  }
  const bestOf = state.matchTeams.get(matchId)!.bestOf;
  if (drafts.length > bestOf) {
    state.ctx.finding({ kind: KIND, code: 'conflict', reason: 'the match has more games than its series length; every game is imported', ref: `${matchId}: ${drafts.length} games in a best of ${bestOf} (${forfeits.length} forfeited)` });
  }
  state.gameCounts.set(matchId, drafts.length);
  for (const g of drafts) {
    state.rows.add(s.games, g.row);
    state.ctx.outcome(KIND, 'mapped');
  }
  state.gameIds.set(matchId, new Map(drafts.map((g) => [g.doc.id, g.row.id as string])));
}
