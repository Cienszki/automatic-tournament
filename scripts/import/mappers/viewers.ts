// Fantasy rounds and lineups, pick'em entries (SCHEMA.md 7.9). Points and totals are not stored:
// they are computed from performances (ADR-11), so every stored score is dropped.

import * as s from '@/platform/db/schema';
import { pickemPredictionsSchema } from '@/platform/db/schema/json';
import { fields } from '../context';
import { ancestorId, docsOf } from '../source';
import { toBool, toInt, toText } from '../values';
import { createdOf, obj, timeOf, updatedOf } from './read';
import { fitJson, type MapState } from './state';
import { POSITION } from './teams';

const ROUND_FIELDS = fields('name', 'lockDeadline', 'isCurrent', 'createdAt', 'position', 'order');
const LINEUP_FIELDS = fields('userId', 'displayName', 'totalFantasyScore', 'averageFantasyScore', 'gamesPlayed', 'lastRecalculatedAt');
const PICK_FIELDS = fields('roundId', 'lineup', 'lastUpdated', 'roundScore', 'displayName');
const PICKEM_FIELDS = fields(
  'userId', 'updatedAt', 'lastUpdated', 'baskets', 'scores', 'predictions', 'email', 'discordUsername', 'displayName',
  'tournamentId', 'playoffsFormat', 'playoffsTeamsCount', 'byeTeamsCount', 'submissionDeadline',
);

export function mapViewers(state: MapState): void {
  mapFantasyRounds(state);
  mapFantasyLineups(state);
  mapPickems(state);
}

function mapFantasyRounds(state: MapState): void {
  const docs = docsOf(state.capture, 'fantasyRounds');
  state.ctx.read('fantasyRounds', docs);
  docs.forEach((doc, i) => {
    state.ctx.checkFields('fantasyRounds', doc, ROUND_FIELDS);
    const d = doc.data;
    state.rows.add(s.fantasyRounds, {
      tournamentId: state.tournamentId, id: doc.id, name: toText(d.name) ?? doc.id, position: toInt(d.position) ?? toInt(d.order) ?? i + 1,
      lockAt: timeOf(state, 'fantasyRounds', doc, 'lockDeadline', d.lockDeadline), isCurrent: toBool(d.isCurrent) ?? false,
      createdAt: createdOf(state, 'fantasyRounds', doc),
    });
    state.ctx.outcome('fantasyRounds', 'mapped');
  });
}

function mapFantasyLineups(state: MapState): void {
  const owners = docsOf(state.capture, 'fantasyLineups');
  const picks = docsOf(state.capture, 'fantasyLineups.rounds');
  state.ctx.read('fantasyLineups', owners);
  state.ctx.read('fantasyLineups.rounds', picks);
  for (const doc of owners) {
    state.ctx.checkFields('fantasyLineups', doc, LINEUP_FIELDS);
    // The owner's document holds only totals (derived); its user id names the round rows.
    state.ctx.outcome('fantasyLineups', 'merged');
  }
  const rounds = new Set(state.rows.get(s.fantasyRounds).map((r) => r.id as string));
  for (const doc of picks) {
    state.ctx.checkFields('fantasyLineups.rounds', doc, PICK_FIELDS);
    const userId = state.ctx.user(ancestorId(doc), 'fantasyLineups:uid');
    const roundId = toText(doc.data.roundId) ?? doc.id;
    if (!userId || !rounds.has(roundId)) {
      state.ctx.outcome('fantasyLineups.rounds', 'unmapped', userId ? 'the lineup\'s fantasy round does not exist' : 'the lineup has no user id', doc.path);
      continue;
    }
    const submittedAt = timeOf(state, 'fantasyLineups.rounds', doc, 'lastUpdated', doc.data.lastUpdated) ?? updatedOf(state, 'fantasyLineups.rounds', doc);
    let added = 0;
    for (const [label, raw] of Object.entries(obj(doc.data.lineup))) {
      const pick = obj(raw);
      const position = POSITION[label.toLowerCase()];
      const memberId = toText(pick.id);
      const steamId64 = (memberId ? state.members.get(memberId)?.steamId64 : null) ?? state.ctx.player(pick.steamId);
      if (!position || !steamId64) {
        state.ctx.finding({ kind: 'fantasyLineups.rounds', code: 'unmapped', reason: position ? 'a fantasy pick resolves to no player; the pick is not imported' : `"${label}" is not a position; the pick is not imported`, ref: doc.path });
        continue;
      }
      if (memberId && state.members.get(memberId)?.steamId64 && toText(pick.steamId) && state.members.get(memberId)!.steamId64 !== toText(pick.steamId)) {
        state.ctx.finding({ kind: 'fantasyLineups.rounds', code: 'conflict', reason: 'the pick\'s stored Steam id differs from its roster entry; the roster entry is used', ref: doc.path });
      }
      state.ctx.player(steamId64, { nickname: toText(pick.nickname) });
      const teamId = toText(pick.teamId);
      state.rows.add(s.fantasyLineups, {
        tournamentId: state.tournamentId, roundId, userId, position, steamId64,
        teamId: teamId && state.teamIds.has(teamId) ? teamId : null, submittedAt,
      });
      added++;
    }
    state.ctx.outcome('fantasyLineups.rounds', added ? 'mapped' : 'unmapped', added ? undefined : 'a lineup with no importable pick', doc.path);
  }
}

function mapPickems(state: MapState): void {
  const docs = docsOf(state.capture, 'pickems');
  state.ctx.read('pickems', docs);
  for (const doc of docs) {
    state.ctx.checkFields('pickems', doc, PICKEM_FIELDS);
    const d = doc.data;
    const userId = state.ctx.user(d.userId ?? doc.id, 'pickems:userId');
    if (!userId) {
      state.ctx.outcome('pickems', 'unmapped', 'a pick\'em entry without a user id', doc.path);
      continue;
    }
    const scores = d.scores && typeof d.scores === 'object' ? d.scores : undefined;
    const predictions = d.baskets
      ? { kind: 'placement-baskets', baskets: d.baskets, ...(scores ? { scores } : {}) }
      : d.predictions && typeof d.predictions === 'object' ? d.predictions : { kind: 'team-scores', scores: scores ?? {} };
    state.rows.add(s.pickemPicks, {
      tournamentId: state.tournamentId, userId,
      predictions: fitJson(state, pickemPredictionsSchema, predictions, `pickems ${doc.path} predictions`),
      submittedAt: timeOf(state, 'pickems', doc, 'updatedAt', d.updatedAt ?? d.lastUpdated) ?? updatedOf(state, 'pickems', doc),
    });
    state.ctx.outcome('pickems', 'mapped');
  }
}
