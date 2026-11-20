// Matches (SCHEMA.md 7.2, 7.8): group, league and Swiss matches from `matches`; bracket matches
// from `playoff_matches` merged with the mirror document of the same id in `matches`, which holds
// the schedule and the games. What hangs on a match (reschedule requests, casters, coaches,
// admin actions) is in match-extras.ts.

import * as s from '@/platform/db/schema';
import { draftPenaltiesSchema } from '@/platform/db/schema/json';
import { fields } from '../context';
import { docsOf, type Doc } from '../source';
import { toBestOf, toInt, toText } from '../values';
import { mapMatchExtras } from './match-extras';
import { arr, createdOf, obj, timeOf, updatedOf } from './read';
import { fitJson, type MapState } from './state';

const KIND = 'matches';
export const MATCH_FIELDS = fields(
  'id', 'tournamentId', 'teamA', 'teamB', 'teams', 'winnerId', 'winner', 'result', 'status', 'isBanForfeit',
  'schedulingStatus', 'schedulingMethod', 'scheduledFor', 'scheduled_for', 'dateTime', 'defaultMatchTime', 'deadline',
  'rescheduleLatest', 'rescheduleMaxHoursLater', 'completedAt', 'completed_at', 'createdAt', 'created_at', 'updatedAt',
  'updated_at', 'divisionId', 'group_id', 'round', 'matchday', 'bestOf', 'series_format', 'format', 'game_ids', 'forfeit',
  'adminScheduledAt', 'adminScheduledBy', 'adminScheduleReason', 'rescheduleRequest', 'proposedTime', 'proposedById',
  'proposingCaptainId', 'approvedStandins', 'standinInfo', 'coachInfo', 'casters', 'draftPenalties', 'lanStage',
  'lanSlot', 'isPlayoff', 'playoffCode', 'roundId', 'playoff_match_id', 'playoff_bracket_type', 'playoff_round',
  'playoff_position', 'gamesReprocessed', 'gamesUpdated', 'lastReprocessed', 'lastResynced', 'lastUpdated',
  'resyncedGamesCount', 'extra', 'replacesMatchId', 'replacedByMatchId', 'isSwissByeMatch',
);
const BRACKET_FIELDS = fields(
  'id', 'bracketType', 'round', 'position', 'code', 'teamA', 'teamB', 'nextWinnerMatchId', 'nextWinnerSlot',
  'nextLoserMatchId', 'nextLoserSlot', 'teamASlotId', 'teamBSlotId', 'winnerSlotId', 'loserSlotId', 'format', 'status',
  'result', 'deadline', 'scheduledFor', 'createdAt', 'updatedAt', 'rescheduleRequest', 'matchId',
);

/** Placeholders the old site used for the empty side of a bye. */
const isByeTeam = (id: unknown) => typeof id === 'string' && (id.startsWith('__PLAYOFF_BYE__') || id === 'swiss-bye');

const SCHEDULE_STATES: Record<string, [string, string | null]> = {
  confirmed: ['confirmed', null], unscheduled: ['unscheduled', null], proposed: ['proposed', null],
  scheduled: ['confirmed', null], 'admin-scheduled': ['confirmed', 'admin'],
};
const METHODS: Record<string, string> = { 'admin-scheduled': 'admin', 'captain-scheduled': 'captain', admin: 'admin', captain: 'captain', fixed: 'fixed' };
const SIDES: Record<string, string> = { upper: 'upper', lower: 'lower', final: 'final', wildcard: 'wildcard', 'third-place': 'third_place', third_place: 'third_place' };
const KINDS = new Set(['regular', 'tiebreak', 'rematch', 'showmatch']);

export function mapMatches(state: MapState): void {
  const matches = docsOf(state.capture, KIND);
  const bracket = docsOf(state.capture, 'playoff_matches');
  state.ctx.read(KIND, matches);
  state.ctx.read('playoff_matches', bracket);
  const mirrors = new Map(matches.map((m) => [m.id, m]));
  const bracketIds = new Set(bracket.map((b) => b.id));
  for (const doc of matches) {
    if (bracketIds.has(doc.id)) continue;
    state.ctx.checkFields(KIND, doc, MATCH_FIELDS);
    const groupId = toText(doc.data.divisionId) ?? toText(doc.data.group_id);
    const stageId = groupId ? state.groupStage.get(groupId) : undefined;
    if (!groupId || !stageId) {
      state.ctx.outcome(KIND, 'unmapped', doc.data.isPlayoff ? 'a playoff match with no bracket document' : 'the match names no group of this tournament', doc.path);
      continue;
    }
    addMatch(state, [doc], baseRow(state, doc, doc, stageId, groupId));
    state.ctx.outcome(KIND, 'mapped');
  }
  for (const doc of bracket) {
    state.ctx.checkFields('playoff_matches', doc, BRACKET_FIELDS);
    const mirror = mirrors.get(doc.id);
    if (mirror) {
      state.ctx.checkFields(KIND, mirror, MATCH_FIELDS);
      state.ctx.outcome(KIND, 'merged');
    }
    addMatch(state, mirror ? [mirror, doc] : [doc], bracketRow(state, doc, mirror));
    state.ctx.outcome('playoff_matches', 'mapped');
  }
  checkBracketLinks(state);
}

/** `docs`: the documents that describe the match (a bracket match has two), the first one leading. */
function addMatch(state: MapState, docs: readonly Doc[], row: Record<string, unknown>): void {
  state.rows.add(s.matches, row);
  state.matchTeams.set(row.id as string, { a: row.teamAId as string | null, b: row.teamBId as string | null, bestOf: row.bestOf as number });
  mapMatchExtras(state, docs, row);
}

/** A team id from the match, or null for the empty side of a bye; an unknown team is reported. */
function teamRef(state: MapState, doc: Doc, value: unknown, side: string): string | null {
  const id = toText(value);
  if (!id || isByeTeam(id)) return null;
  if (!state.teamIds.has(id)) {
    state.ctx.finding({ kind: KIND, code: 'unmapped', reason: 'a match names a team that does not exist; left empty', ref: `${doc.path} ${side} = ${id}` });
    return null;
  }
  return id;
}

function bestOfOf(state: MapState, doc: Doc, stageId: string, extra: unknown[] = []): number {
  const d = doc.data;
  const values = [d.bestOf, d.series_format, d.format, ...extra].map(toBestOf).filter((n): n is number => n !== null);
  if (new Set(values).size > 1) {
    state.ctx.finding({ kind: KIND, code: 'conflict', reason: 'bestOf, series_format and format disagree; the first is used', ref: `${doc.path} ${values.join('/')}` });
  }
  return values[0] ?? (state.rows.get(s.stages).find((r) => r.id === stageId)?.defaultBestOf as number) ?? 2;
}

/** Columns every match has, from the `matches` document. */
function baseRow(state: MapState, doc: Doc, timing: Doc, stageId: string, groupId: string | null): Record<string, unknown> {
  const d = timing.data;
  const a = obj(d.teamA);
  const b = obj(d.teamB);
  const teamAId = teamRef(state, timing, a.id, 'teamA');
  const teamBId = teamRef(state, timing, b.id, 'teamB');
  const isBye = isByeTeam(a.id) || isByeTeam(b.id) || d.isSwissByeMatch === true;
  let status = toText(d.status) ?? 'scheduled';
  if (status === 'completed' && isBye) status = 'bye';
  if (!['scheduled', 'live', 'completed', 'bye', 'void'].includes(status)) {
    state.ctx.finding({ kind: KIND, code: 'unmapped', reason: `match status "${status}" imported as scheduled`, ref: timing.path });
    status = 'scheduled';
  }
  const rawState = toText(d.schedulingStatus) ?? 'unscheduled';
  const [scheduleState, implied] = SCHEDULE_STATES[rawState] ?? ['unscheduled', null];
  if (!SCHEDULE_STATES[rawState]) state.ctx.finding({ kind: KIND, code: 'unmapped', reason: `schedulingStatus "${rawState}" imported as unscheduled`, ref: timing.path });
  const method = toText(d.schedulingMethod);
  const forfeit = obj(d.forfeit);
  const forfeiting = forfeit.forfeitingTeam === 'teamA' ? teamAId : forfeit.forfeitingTeam === 'teamB' ? teamBId : null;
  let scoreA = toInt(a.score);
  let scoreB = toInt(b.score);
  // A score of 0:0 on a match not yet played is the old default, not a result.
  if ((status === 'scheduled' || status === 'live') && !scoreA && !scoreB) [scoreA, scoreB] = [null, null];
  const extra = obj(d.extra);
  const kind = toText(extra.kind) ?? (d.replacesMatchId ? 'rematch' : 'regular');
  const scheduledField = ['scheduledFor', 'scheduled_for', 'dateTime'].find((f) => d[f] !== undefined && d[f] !== null && d[f] !== '');
  return {
    tournamentId: state.tournamentId, id: doc.id, stageId, groupId,
    round: toInt(d.round) ?? toInt(d.playoff_round) ?? 1, matchday: toInt(d.matchday),
    kind: KINDS.has(kind) ? kind : 'other', kindNote: toText(extra.note), replacesMatchId: toText(d.replacesMatchId), tieRef: null,
    teamAId, teamBId, bestOf: bestOfOf(state, timing, stageId), status, scheduleState,
    schedulingMethod: METHODS[method ?? ''] ?? implied,
    scheduledAt: scheduledField ? timeOf(state, KIND, timing, scheduledField, d[scheduledField]) : null,
    deadlineAt: timeOf(state, KIND, timing, 'deadline', d.deadline),
    rescheduleLatestAt: timeOf(state, KIND, timing, 'rescheduleLatest', d.rescheduleLatest),
    rescheduleMaxHoursLater: toInt(d.rescheduleMaxHoursLater),
    scoreA, scoreB, winnerTeamId: teamRef(state, timing, d.winnerId, 'winnerId'),
    completedAt: timeOf(state, KIND, timing, 'completedAt', d.completedAt ?? d.completed_at),
    forfeitTeamId: forfeiting, forfeitScope: forfeiting ? toText(forfeit.scope) ?? 'series' : null,
    forfeitReason: forfeiting ? toText(forfeit.reason) ?? (d.isBanForfeit ? 'ban' : null) : null,
    bracketSide: null, bracketPosition: null, code: toText(d.lanSlot) ?? toText(d.playoffCode),
    nextWinnerMatchId: null, nextWinnerSlot: null, nextLoserMatchId: null, nextLoserSlot: null,
    draftPenalties: fitJson(state, draftPenaltiesSchema, arr(d.draftPenalties), `${KIND} ${timing.path} draftPenalties`),
    createdAt: createdOf(state, KIND, timing), updatedAt: updatedOf(state, KIND, timing),
  };
}

const slotOf = (value: unknown) => (value === 'teamA' || value === 'a' ? 'a' : value === 'teamB' || value === 'b' ? 'b' : null);

/** A bracket match: structure and result from `playoff_matches`, schedule and games from the mirror. */
function bracketRow(state: MapState, doc: Doc, mirror: Doc | undefined): Record<string, unknown> {
  const p = doc.data;
  const row = baseRow(state, doc, mirror ?? doc, 'playoffs', null);
  const result = obj(p.result);
  const a = obj(p.teamA);
  const b = obj(p.teamB);
  row.teamAId = teamRef(state, doc, a.id, 'teamA');
  row.teamBId = teamRef(state, doc, b.id, 'teamB');
  row.round = toInt(p.round) ?? row.round;
  row.bestOf = toBestOf(p.format) ?? row.bestOf;
  row.bracketSide = SIDES[toText(p.bracketType) ?? ''] ?? null;
  if (!row.bracketSide) state.ctx.finding({ kind: 'playoff_matches', code: 'unmapped', reason: `bracketType "${String(p.bracketType)}" is not a bracket side`, ref: doc.path });
  row.bracketPosition = toInt(p.position);
  row.code = toText(p.code) ?? row.code;
  const status = toText(p.status);
  if (status === 'bye' || isByeTeam(a.id) || isByeTeam(b.id)) row.status = 'bye';
  else if (status && ['scheduled', 'live', 'completed'].includes(status)) row.status = status;
  if (result.teamAScore !== undefined) {
    const [ra, rb] = [toInt(result.teamAScore), toInt(result.teamBScore)];
    if (mirror && (row.scoreA !== null || row.scoreB !== null) && (row.scoreA !== ra || row.scoreB !== rb)) {
      state.ctx.finding({ kind: 'playoff_matches', code: 'conflict', reason: 'the bracket result and its mirror match disagree; the bracket result is used', ref: `${doc.path} ${ra}:${rb} / ${String(row.scoreA)}:${String(row.scoreB)}` });
    }
    row.scoreA = ra;
    row.scoreB = rb;
    row.winnerTeamId = teamRef(state, doc, result.winnerId, 'result.winnerId');
    row.completedAt = timeOf(state, 'playoff_matches', doc, 'result.completedAt', result.completedAt) ?? row.completedAt;
  }
  if (!row.scheduledAt) row.scheduledAt = timeOf(state, 'playoff_matches', doc, 'scheduledFor', p.scheduledFor);
  if (!row.deadlineAt) row.deadlineAt = timeOf(state, 'playoff_matches', doc, 'deadline', p.deadline);
  row.nextWinnerMatchId = toText(p.nextWinnerMatchId);
  row.nextWinnerSlot = row.nextWinnerMatchId ? slotOf(p.nextWinnerSlot) : null;
  row.nextLoserMatchId = toText(p.nextLoserMatchId);
  row.nextLoserSlot = row.nextLoserMatchId ? slotOf(p.nextLoserSlot) : null;
  if (!mirror) {
    row.createdAt = createdOf(state, 'playoff_matches', doc);
    row.updatedAt = updatedOf(state, 'playoff_matches', doc);
  }
  return row;
}

/** A link to a next match that is not imported would break the foreign key: it is cut and reported. */
function checkBracketLinks(state: MapState): void {
  const ids = new Set(state.rows.get(s.matches).map((r) => r.id as string));
  for (const row of state.rows.get(s.matches)) {
    for (const [idKey, slotKey] of [['nextWinnerMatchId', 'nextWinnerSlot'], ['nextLoserMatchId', 'nextLoserSlot']] as const) {
      const next = row[idKey] as string | null;
      if (next && (!ids.has(next) || !row[slotKey])) {
        state.ctx.finding({ kind: 'playoff_matches', code: 'unmapped', reason: 'a bracket link points at a match that is not imported, or has no slot; the link is left out', ref: `${String(row.id)} ${idKey} = ${next}` });
        row[idKey] = null;
        row[slotKey] = null;
      }
    }
  }
}
