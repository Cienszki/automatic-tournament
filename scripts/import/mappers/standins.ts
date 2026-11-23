// Stand-in requests (SCHEMA.md 7.6). The copies kept on matches (`approvedStandins`, and the
// stand-in summary an old layout keeps) are not imported; they are checked against the requests.

import * as s from '@/platform/db/schema';
import { fields } from '../context';
import { docsOf, type Doc } from '../source';
import { steam64FromProfileUrl, toInt, toSteam64, toText } from '../values';
import { arr, createdOf, obj, timeOf, updatedOf } from './read';
import type { MapState } from './state';

const KIND = 'standinRequests';
const FIELDS = fields(
  'matchId', 'teamId', 'captainId', 'status', 'createdAt', 'updatedAt', 'replacedPlayerId', 'replacedPlayerNickname',
  'replacedPlayerMmr', 'standinNickname', 'standinMmr', 'gameNumbers', 'standinSteamId32', 'standinSteamProfileUrl',
  'standinSmurfAccounts', 'requestingTeamId', 'requestingTeamName', 'opponentTeamId', 'matchTeamAName', 'matchTeamBName',
  'matchScheduledFor', 'respondedAt', 'respondedBy', 'rejectionReason', 'appealedAt', 'appealResolvedAt',
  'appealResolvedBy', 'appealAdminNote',
  // Written by the adapter for an old layout: one request per pair of player and registered stand-in.
  'replacedMemberId', 'standinRegistrationUserId',
);
const STATUSES = new Set(['pending', 'approved', 'rejected', 'appeal_pending', 'appeal_approved', 'appeal_rejected']);

export function mapStandinRequests(state: MapState): void {
  const docs = docsOf(state.capture, KIND);
  state.ctx.read(KIND, docs);
  const copies = approvedCopies(state);
  for (const doc of docs) {
    state.ctx.checkFields(KIND, doc, FIELDS);
    const row = requestRow(state, doc, copies.get(doc.id));
    if (!row) continue;
    state.rows.add(s.standinRequests, row);
    state.ctx.outcome(KIND, 'mapped');
  }
  checkMatchCopies(state);
}

/** `matches.approvedStandins` by request id. */
function approvedCopies(state: MapState): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const match of docsOf(state.capture, 'matches')) {
    for (const [requestId, raw] of Object.entries(obj(match.data.approvedStandins))) out.set(requestId, obj(raw));
  }
  return out;
}

function requestRow(state: MapState, doc: Doc, copy: Record<string, unknown> | undefined): Record<string, unknown> | null {
  const d = doc.data;
  const matchId = toText(d.matchId);
  const teamId = toText(d.teamId) ?? toText(d.requestingTeamId);
  if (!matchId || !state.matchTeams.has(matchId)) {
    state.ctx.outcome(KIND, 'unmapped', 'the request\'s match is not imported', doc.path);
    return null;
  }
  if (!teamId || !state.teamIds.has(teamId)) {
    state.ctx.outcome(KIND, 'unmapped', 'the request\'s team does not exist', doc.path);
    return null;
  }
  // The replaced player: by roster id (older layout) or by Steam64 on the requesting team.
  const replacedRef = toText(d.replacedMemberId) ?? toText(d.replacedPlayerId);
  let replacedMemberId: string | null = null;
  if (replacedRef) {
    replacedMemberId = state.members.has(replacedRef) ? replacedRef : state.memberBySteam.get(`${teamId}/${toSteam64(replacedRef) ?? replacedRef}`) ?? null;
    if (!replacedMemberId) state.ctx.finding({ kind: KIND, code: 'unmapped', reason: 'the replaced player is not on the team\'s roster; left empty', ref: `${doc.path} ${replacedRef}` });
  }
  const registrationId = toText(d.standinRegistrationUserId);
  const registration = registrationId ? state.registrations.get(registrationId) : undefined;
  if (registrationId && !registration) {
    state.ctx.finding({ kind: KIND, code: 'unmapped', reason: 'the stand-in is not in the stand-in pool; the request is imported without them', ref: `${doc.path} ${registrationId}` });
  }
  const url = toText(d.standinSteamProfileUrl);
  let standinSteamId64 = registration?.steamId64 ?? toSteam64(d.standinSteamId32) ?? steam64FromProfileUrl(url);
  if (!standinSteamId64 && toSteam64(copy?.steamId32)) {
    // The request kept only a vanity profile link; the approval resolved it and stored it on the match.
    standinSteamId64 = toSteam64(copy!.steamId32);
    state.ctx.finding({ kind: KIND, code: 'decision', reason: 'the Steam id of the stand-in is taken from the approved copy on the match (the request has only a vanity profile link)', ref: doc.path });
  }
  state.ctx.player(standinSteamId64, { nickname: toText(d.standinNickname) });
  let status = toText(d.status) ?? 'pending';
  if (!STATUSES.has(status)) {
    state.ctx.finding({ kind: KIND, code: 'unmapped', reason: `request status "${status}" imported as pending`, ref: doc.path });
    status = 'pending';
  }
  return {
    tournamentId: state.tournamentId, id: doc.id, matchId, teamId,
    requestedBy: state.ctx.user(d.captainId, `${KIND}:captainId`), replacedMemberId, replacedMmr: toInt(d.replacedPlayerMmr),
    standinSteamId64, standinProfileUrl: standinSteamId64 ? null : url,
    standinNickname: registration?.nickname ?? toText(d.standinNickname) ?? '?',
    standinMmr: registration?.mmr ?? toInt(d.standinMmr),
    standinRegistrationUserId: registration ? registrationId : null,
    gameNumbers: arr(d.gameNumbers).map(toInt).filter((n): n is number => n !== null),
    status, respondedBy: state.ctx.user(d.respondedBy, `${KIND}:respondedBy`),
    respondedAt: timeOf(state, KIND, doc, 'respondedAt', d.respondedAt), rejectionReason: toText(d.rejectionReason),
    appealedAt: timeOf(state, KIND, doc, 'appealedAt', d.appealedAt),
    appealResolvedBy: state.ctx.user(d.appealResolvedBy, `${KIND}:appealResolvedBy`),
    appealResolvedAt: timeOf(state, KIND, doc, 'appealResolvedAt', d.appealResolvedAt), appealNote: toText(d.appealAdminNote),
    createdAt: createdOf(state, KIND, doc), updatedAt: updatedOf(state, KIND, doc),
  };
}

/** `matches.approvedStandins.{requestId}`: every entry should be an approved request with the same stand-in. */
function checkMatchCopies(state: MapState): void {
  const requests = new Map(state.rows.get(s.standinRequests).map((r) => [r.id as string, r]));
  for (const match of docsOf(state.capture, 'matches')) {
    for (const [requestId, raw] of Object.entries(obj(match.data.approvedStandins))) {
      const copy = obj(raw);
      const request = requests.get(requestId);
      if (!request) {
        state.ctx.finding({ kind: 'matches', code: 'conflict', reason: 'approvedStandins names a request that is not imported (the copy is not imported)', ref: `${match.path} ${requestId}` });
      } else if (request.status !== 'approved' && request.status !== 'appeal_approved') {
        state.ctx.finding({ kind: 'matches', code: 'conflict', reason: 'approvedStandins names a request that is not approved; the request is used', ref: `${match.path} ${requestId} (${String(request.status)})` });
      } else if (toSteam64(copy.steamId32) && toSteam64(copy.steamId32) !== request.standinSteamId64) {
        state.ctx.finding({ kind: 'matches', code: 'conflict', reason: 'approvedStandins has another stand-in than the request; the request is used', ref: `${match.path} ${requestId}` });
      }
    }
  }
}
