// Applying the owner corrections (corrections.ts) to the mapped rows. Each function runs right
// after the mapper whose rows it corrects (map.ts) and records in the tournament's CorrectionLog
// what it changed. Applying a correction is a plain change of values on the mapped rows, so a
// second run produces the same rows and writes nothing. Game placement corrections are applied
// by placement.ts; roster Steam ids by teams.ts.

import * as s from '@/platform/db/schema';
import type { MatchCorrection } from '../corrections';
import type { Row } from '../rows';
import type { MapState } from './state';

const APPROVED = new Set(['approved', 'appeal_approved']);

const show = (v: unknown) => (v === null || v === undefined ? 'none' : v instanceof Date ? v.toISOString() : String(v));

/** Set `key` on `row` and describe the change, or nothing when it already had the value. */
function change(row: Row, key: string, value: unknown, label = key, fmt: (v: unknown) => string = show): string | null {
  const before = row[key];
  const same = before instanceof Date && value instanceof Date ? before.getTime() === value.getTime() : before === value;
  if (same) return null;
  row[key] = value;
  return `${label} ${fmt(before)} → ${fmt(value)}`;
}

const describe = (changes: Array<string | null>) => changes.filter(Boolean).join(', ') || 'already so';

/** Format, score, winner and organizer's decisions on matches; runs after mapMatches. */
export function applyMatchCorrections(state: MapState): void {
  const rows = new Map(state.rows.get(s.matches).map((m) => [m.id as string, m]));
  for (const c of state.corrections.of('match')) {
    const row = rows.get(c.matchId);
    if (!row) continue;
    if (!state.matchesBefore.has(c.matchId)) state.matchesBefore.set(c.matchId, { ...row });
    state.corrections.applied(c, describe(matchChanges(row, c, (v) => (typeof v === 'string' ? state.teamNames.get(v)?.trim() ?? v : show(v)))));
    const teams = state.matchTeams.get(c.matchId);
    if (teams) teams.bestOf = row.bestOf as number;
  }
}

function matchChanges(row: Row, c: MatchCorrection, team: (v: unknown) => string): Array<string | null> {
  const { set } = c;
  const side = (x: 'a' | 'b') => (x === 'a' ? row.teamAId : row.teamBId) as string | null;
  const out: Array<string | null> = [];
  if (set.bestOf !== undefined) out.push(change(row, 'bestOf', set.bestOf, 'best of'));
  if (set.scoreA !== undefined || set.scoreB !== undefined) {
    const before = `${show(row.scoreA)}:${show(row.scoreB)}`;
    const a = set.scoreA ?? row.scoreA;
    const b = set.scoreB ?? row.scoreB;
    if (a !== row.scoreA || b !== row.scoreB) out.push(`score ${before} → ${show(a)}:${show(b)}`);
    row.scoreA = a;
    row.scoreB = b;
  }
  if (set.winner !== undefined) out.push(change(row, 'winnerTeamId', set.winner === 'none' ? null : side(set.winner), 'winner', team));
  if (set.forfeit) {
    out.push(change(row, 'forfeitTeamId', side(set.forfeit.team), 'given against', team));
    out.push(change(row, 'forfeitScope', 'series', 'forfeit scope'));
    out.push(change(row, 'forfeitReason', set.forfeit.reason, 'reason'));
  }
  return out;
}

/** Roster entries that left a team; runs after the rosters and transfers are mapped. */
export function applyMemberCorrections(state: MapState): void {
  const rows = state.rows.get(s.teamMembers);
  for (const c of state.corrections.of('member')) {
    const row = rows.find((m) => m.id === c.memberId && m.teamId === c.teamId && m.steamId64 === c.steamId64);
    if (!row) continue;
    state.corrections.applied(c, describe([
      change(row, 'leftAt', new Date(c.set.leftAt), 'left at'),
      change(row, 'leftReason', c.set.leftReason, 'left reason'),
    ]));
  }
}

/**
 * A stand-in the owner named for a match: the approved request for that player is given the
 * owner's name for them; without one, an approved request is added (the shape every other
 * approved stand-in has), so the lineup check and the stats know who played. Runs after
 * mapStandinRequests.
 */
export function applyStandinCorrections(state: MapState): void {
  const requests = state.rows.get(s.standinRequests);
  const matches = new Map(state.rows.get(s.matches).map((m) => [m.id as string, m]));
  for (const c of state.corrections.of('standin')) {
    const match = matches.get(c.matchId);
    if (!match || (match.teamAId !== c.teamId && match.teamBId !== c.teamId) || !state.teamIds.has(c.teamId)) continue;
    const found = requests.filter((r) => r.matchId === c.matchId && r.teamId === c.teamId && r.standinSteamId64 === c.steamId64 && APPROVED.has(r.status as string));
    if (found.length) {
      const changes = found.flatMap((r) => [
        change(r, 'standinNickname', c.nickname, `request ${String(r.id)}: stand-in name`),
        r.replacedMemberId ? null : change(r, 'replacedMemberId', c.replacedMemberId ?? null, `request ${String(r.id)}: replaced member`),
      ]);
      state.corrections.applied(c, describe(changes));
      continue;
    }
    const replaced = c.replacedMemberId && state.members.has(c.replacedMemberId) ? c.replacedMemberId : null;
    const at = (match.scheduledAt ?? match.completedAt ?? match.createdAt) as Date;
    state.rows.add(s.standinRequests, {
      tournamentId: state.tournamentId, id: `owner-${c.id}`, matchId: c.matchId, teamId: c.teamId, requestedBy: null,
      replacedMemberId: replaced, replacedMmr: null, standinSteamId64: c.steamId64, standinProfileUrl: null,
      standinNickname: c.nickname, standinMmr: null, standinRegistrationUserId: null, gameNumbers: [], status: 'approved',
      respondedBy: null, respondedAt: null, rejectionReason: null, appealedAt: null,
      appealResolvedBy: null, appealResolvedAt: null, appealNote: null, createdAt: at, updatedAt: at,
    });
    state.ctx.player(c.steamId64, { nickname: c.nickname });
    state.corrections.applied(c, `approved stand-in added (request owner-${c.id})`);
  }
}

/** Approved stand-ins of a match by team: Steam64 → team id, for telling the teams of a game apart. */
export function approvedStandins(state: MapState, matchId: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of state.rows.get(s.standinRequests)) {
    if (r.matchId === matchId && APPROVED.has(r.status as string) && typeof r.standinSteamId64 === 'string') out.set(r.standinSteamId64, r.teamId as string);
  }
  return out;
}

/** The global player rows the owner named; runs inside mapPlayersTable for players this tournament writes. */
export function playerCorrectionRows(state: MapState): Row[] {
  return state.corrections.of('player').flatMap((c) => {
    if (!state.ctx.players.has(c.steamId64)) return [];
    state.corrections.applied(c, `nickname "${c.nickname}" (also ${c.aliases.join(', ') || 'no other name'})`);
    return [{ steamId64: c.steamId64, nickname: c.nickname }];
  });
}

/** Corrections that matched nothing become findings; the outcomes stay on the log for the report. */
export function finishCorrections(state: MapState): void {
  for (const o of state.corrections.finish()) {
    if (o.status === 'unmatched') {
      state.ctx.finding({ kind: 'corrections', code: 'conflict', reason: 'an owner correction matched no row of this capture; nothing was changed', ref: `${o.id}: ${o.label}` });
    }
  }
}
