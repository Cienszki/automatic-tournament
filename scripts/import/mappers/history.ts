// Collections only the owner's credentialed export can see (SCHEMA.md 7.6, 7.10): roster transfers
// and the games the sync was told to skip. None is in the anonymous captures, so these mappers are
// written from the code that writes them and tested on made-up documents.

import * as s from '@/platform/db/schema';
import { isDenied } from '../private-sources';
import { ancestorId, docsOf } from '../source';
import { steam64FromProfileUrl, toSteam64, toText } from '../values';
import { createdOf, timeOf } from './read';
import type { MapState } from './state';

/**
 * `teams/{id}/transfers` (`PDLTransferRecord`): an `add` sets the joining date of the member with
 * that Steam id; a `remove` keeps the player who left as a member with `left_at` set, because the
 * old site deleted their roster document.
 */
export function mapTransfers(state: MapState): void {
  // Without the transfers, a member's joining date can only be the roster document's creation
  // time, which is wrong for a player whose `add` transfer set it. So existing members keep the
  // stored date and only a new member gets the creation time. The rule covers the whole table:
  // the other dates are creation times too, which do not change between captures, except a
  // coach's (`coach.updatedAt`), which then also stays as first imported.
  if (isDenied(state.capture, 'teams.transfers')) state.rows.keepOnUpdate(s.teamMembers, 'joinedAt');
  const docs = docsOf(state.capture, 'teams.transfers');
  state.ctx.read('teams.transfers', docs);
  const members = state.rows.get(s.teamMembers);
  for (const doc of docs) {
    const d = doc.data;
    const teamId = toText(d.teamId) ?? ancestorId(doc);
    const steamId64 = toSteam64(d.playerSteamId) ?? steam64FromProfileUrl(d.playerSteamProfileUrl);
    const at = timeOf(state, 'teams.transfers', doc, 'performedAt', d.performedAt) ?? createdOf(state, 'teams.transfers', doc);
    if (!state.teamIds.has(teamId) || !steamId64) {
      state.ctx.outcome('teams.transfers', 'unmapped', 'a transfer without a known team or a Steam id', doc.path);
      continue;
    }
    const current = members.find((m) => m.teamId === teamId && m.steamId64 === steamId64 && !m.leftAt);
    if (d.type === 'add') {
      if (current) {
        current.joinedAt = at;
        state.ctx.outcome('teams.transfers', 'merged');
      } else {
        state.ctx.outcome('teams.transfers', 'dropped', 'an addition whose player is no longer on the roster (their removal is its own transfer)');
      }
    } else if (d.type === 'remove') {
      if (current) {
        state.ctx.outcome('teams.transfers', 'dropped', 'a removal of a player who is still on the roster (added again later)');
        continue;
      }
      state.ctx.player(steamId64, { nickname: toText(d.playerNickname) });
      state.rows.add(s.teamMembers, {
        tournamentId: state.tournamentId, id: `transfer-${doc.id}`, teamId, steamId64, kind: 'player', position: null,
        nickname: toText(d.playerNickname) ?? steamId64, mmr: null, mmrProofUrl: null, profileUrl: null, smurfAccounts: [],
        joinedAt: createdOf(state, 'teams.transfers', doc), leftAt: at, leftReason: 'transfer', updatedAt: at,
      });
      state.rows.add(s.auditLog, {
        tournamentId: state.tournamentId, at, action: 'team.transfer', targetKind: 'team', targetId: teamId,
        actorUserId: state.ctx.user(d.performedBy, 'teams.transfers:performedBy'), reason: null,
        data: { type: 'remove', steamId64, imported: true },
      }, 'insert-only');
      state.ctx.outcome('teams.transfers', 'mapped');
    } else {
      state.ctx.outcome('teams.transfers', 'unmapped', `transfer type "${String(d.type)}" is not known`, doc.path);
    }
  }
}

/** `skippedGames` (and an old layout's `blockedGames`) → `ignored_dota_matches`. */
export function mapIgnoredGames(state: MapState): void {
  for (const kind of ['skippedGames', 'blockedGames']) {
    const docs = docsOf(state.capture, kind);
    state.ctx.read(kind, docs);
    for (const doc of docs) {
      const id = toText(doc.data.gameId) ?? toText(doc.data.matchId) ?? doc.id;
      if (!/^\d{6,12}$/.test(id)) {
        state.ctx.outcome(kind, 'unmapped', 'a skipped game without a Dota match id', doc.path);
        continue;
      }
      state.rows.add(s.ignoredDotaMatches, {
        tournamentId: state.tournamentId, dotaMatchId: Number(id), reason: toText(doc.data.reason) ?? 'skipped on the old site',
        ignoredBy: state.ctx.user(doc.data.skippedBy ?? doc.data.blockedBy, `${kind}:by`),
        ignoredAt: timeOf(state, kind, doc, 'skippedAt', doc.data.skippedAt ?? doc.data.blockedAt) ?? createdOf(state, kind, doc),
      });
      state.ctx.outcome(kind, 'mapped');
    }
  }
}
