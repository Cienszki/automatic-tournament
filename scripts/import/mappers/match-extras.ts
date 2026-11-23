// What hangs on a match document besides its result: the reschedule request (a map on the match
// today, a row now; SCHEMA.md 7.4), casters, per-match coaches, and admin actions for the audit log.

import * as s from '@/platform/db/schema';
import { steam64FromProfileUrl, toText } from '../values';
import type { Doc } from '../source';
import { arr, createdOf, obj, timeOf } from './read';
import type { MapState } from './state';

type Row = Record<string, unknown>;

const RESCHEDULE_STATUSES = new Set(['pending', 'approved', 'rejected', 'cancelled']);

export function mapMatchExtras(state: MapState, docs: readonly Doc[], match: Row): void {
  const requests = docs.map((doc) => rescheduleRow(state, doc, match)).filter((r): r is Row => r !== null);
  if (requests.length) {
    // A bracket match and its mirror can both carry the request; the later one is kept.
    requests.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
    if (requests.length > 1 && JSON.stringify(requests[0]) !== JSON.stringify(requests[1])) {
      state.ctx.finding({ kind: 'matches', code: 'conflict', reason: 'the bracket match and its mirror carry different reschedule requests; the later one is kept', ref: String(match.id) });
    }
    state.rows.add(s.rescheduleRequests, requests[requests.length - 1]);
  }
  const lead = docs[0];
  mapCasters(state, lead, match);
  mapCoaches(state, lead, match);
  mapAudit(state, lead, match);
}

/** `rescheduleRequest`, or the old root layout's `proposedTime` with `proposedById` (a team) and `proposingCaptainId`. */
function rescheduleRow(state: MapState, doc: Doc, match: Row): Row | null {
  const d = doc.data;
  const kind = doc.path.includes('/playoff_matches/') ? 'playoff_matches' : 'matches';
  const r = obj(d.rescheduleRequest);
  const base = { tournamentId: state.tournamentId, id: `${String(match.id)}-reschedule`, matchId: match.id };
  if (Object.keys(r).length) {
    const proposedAt = timeOf(state, kind, doc, 'rescheduleRequest.proposedDate', r.proposedDate);
    const teamId = toText(r.requestedBy);
    if (!proposedAt || !teamId || !state.teamIds.has(teamId)) {
      state.ctx.finding({ kind, code: 'unmapped', reason: 'a reschedule request without a proposed time or a known requesting team is not imported', ref: doc.path });
      return null;
    }
    const status = toText(r.status) ?? 'pending';
    if (!RESCHEDULE_STATUSES.has(status)) state.ctx.finding({ kind, code: 'unmapped', reason: `reschedule status "${status}" imported as pending`, ref: doc.path });
    return {
      ...base, teamId, requestedBy: state.ctx.user(r.requestedByCaptainId, `${kind}:rescheduleRequest.requestedByCaptainId`),
      originalAt: timeOf(state, kind, doc, 'rescheduleRequest.originalDate', r.originalDate), proposedAt,
      status: RESCHEDULE_STATUSES.has(status) ? status : 'pending',
      respondedBy: state.ctx.user(r.respondedBy, `${kind}:rescheduleRequest.respondedBy`),
      respondedAt: timeOf(state, kind, doc, 'rescheduleRequest.respondedAt', r.respondedAt),
      createdAt: timeOf(state, kind, doc, 'rescheduleRequest.createdAt', r.createdAt) ?? createdOf(state, kind, doc),
    };
  }
  if (d.proposedTime) {
    const teamId = toText(d.proposedById);
    const proposedAt = timeOf(state, kind, doc, 'proposedTime', d.proposedTime);
    if (!proposedAt || !teamId || !state.teamIds.has(teamId)) {
      state.ctx.finding({ kind, code: 'unmapped', reason: 'a proposed time without a known proposing team is not imported', ref: doc.path });
      return null;
    }
    const proposed = d.schedulingStatus === 'proposed';
    return {
      ...base, teamId, requestedBy: state.ctx.user(d.proposingCaptainId, `${kind}:proposingCaptainId`), originalAt: null, proposedAt,
      status: proposed ? 'pending' : 'approved', respondedBy: null, respondedAt: null, createdAt: createdOf(state, kind, doc),
    };
  }
  return null;
}

/** `casters[]` → `match_casters`; the stored name, picture and stream come from the user. */
function mapCasters(state: MapState, doc: Doc, match: Row): void {
  const casters = arr(doc.data.casters).map(obj);
  casters.forEach((c, i) => {
    const userId = state.ctx.user(c.uid, 'matches:casters.uid');
    if (!userId) return;
    // Their order is kept through added_at, one millisecond apart from the match's creation.
    const addedAt = new Date((match.createdAt as Date).getTime() + i);
    state.rows.add(s.matchCasters, { tournamentId: state.tournamentId, matchId: match.id, userId, isMain: c.main === true, addedAt });
  });
}

/** `coachInfo.{teamId}` → `match_coaches`. */
function mapCoaches(state: MapState, doc: Doc, match: Row): void {
  for (const [teamId, raw] of Object.entries(obj(doc.data.coachInfo))) {
    const c = obj(raw);
    if (teamId !== match.teamAId && teamId !== match.teamBId) {
      state.ctx.finding({ kind: 'matches', code: 'unmapped', reason: 'coachInfo names a team that does not play the match', ref: `${doc.path} ${teamId}` });
      continue;
    }
    const url = toText(c.steamProfileUrl);
    const steamId64 = steam64FromProfileUrl(url);
    state.ctx.player(steamId64, { nickname: toText(c.nickname) });
    state.rows.add(s.matchCoaches, {
      tournamentId: state.tournamentId, matchId: match.id, teamId, steamId64, profileUrl: steamId64 ? null : url,
      nickname: toText(c.nickname) ?? 'Coach', assignedBy: null,
      assignedAt: timeOf(state, 'matches', doc, 'coachInfo.assignedAt', c.assignedAt) ?? createdOf(state, 'matches', doc),
    });
  }
}

/** `adminScheduledAt/By/Reason` and `forfeit.issuedAt/By` → audit log rows (SCHEMA.md 7.2). */
function mapAudit(state: MapState, doc: Doc, match: Row): void {
  const d = doc.data;
  const base = { tournamentId: state.tournamentId, targetKind: 'match', targetId: match.id as string };
  const scheduledAt = timeOf(state, 'matches', doc, 'adminScheduledAt', d.adminScheduledAt);
  if (scheduledAt) {
    state.rows.add(s.auditLog, {
      ...base, at: scheduledAt, action: 'match.schedule', actorUserId: state.ctx.user(d.adminScheduledBy, 'matches:adminScheduledBy'),
      reason: toText(d.adminScheduleReason), data: { scheduledAt: (match.scheduledAt as Date | null)?.toISOString() ?? null, imported: true },
    }, 'insert-only');
  }
  const forfeit = obj(d.forfeit);
  const issuedAt = timeOf(state, 'matches', doc, 'forfeit.issuedAt', forfeit.issuedAt);
  if (issuedAt) {
    state.rows.add(s.auditLog, {
      ...base, at: issuedAt, action: 'match.forfeit', actorUserId: state.ctx.user(forfeit.issuedBy, 'matches:forfeit.issuedBy'),
      reason: toText(forfeit.reason), data: { team: String(forfeit.forfeitingTeam ?? ''), scope: String(forfeit.scope ?? ''), games: arr(forfeit.forfeitedGameNumbers).map(Number), imported: true },
    }, 'insert-only');
  }
}
