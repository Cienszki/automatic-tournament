// Performances (SCHEMA.md 7.5): one player in one game, keyed by Steam64. Older documents are keyed
// by the roster document id (all of one tournament, part of another) or by `unknown_<steam32>`;
// both resolve to a Steam64. Typed columns take the camelCase field, else its snake_case copy;
// everything else OpenDota reported goes to `extra`, with `missing` naming the typed columns the
// source did not have.

import * as s from '@/platform/db/schema';
import { performanceExtraSchema } from '@/platform/db/schema/json';
import { ancestorId, docsOf, type Doc } from '../source';
import { isSteam32, isSteam64, toBool, toInt, toSteam64, toText } from '../values';
import { obj } from './read';
import { fitJson, type MapState } from './state';

const KIND = 'matches.games.performances';

/** Typed column → the source fields that fill it, in order of preference. */
const COLUMNS: Record<string, string[]> = {
  kills: ['kills'], deaths: ['deaths'], assists: ['assists'], lastHits: ['lastHits', 'last_hits'], denies: ['denies'],
  gpm: ['gpm', 'gold_per_min'], xpm: ['xpm', 'xp_per_min'], netWorth: ['netWorth', 'net_worth'], totalGold: ['totalGold'],
  goldSpent: ['goldSpent'], heroDamage: ['heroDamage', 'hero_damage'], towerDamage: ['towerDamage', 'tower_damage'],
  heroHealing: ['heroHealing', 'hero_healing'], obsPlaced: ['obsPlaced', 'obs_placed', 'observerWardsPlaced'],
  senPlaced: ['senPlaced', 'sen_placed', 'sentryWardsPlaced'], observerKills: ['observerKills'], sentryKills: ['sentryKills'],
  courierKills: ['courierKills'], roshanKills: ['roshanKills', 'roshans_killed'], towerKills: ['towerKills', 'towers_killed'],
  neutralKills: ['neutralKills'], laneKills: ['laneKills'], heroKills: ['heroKills'],
  campsStacked: ['campsStacked', 'camps_stacked', 'creeps_stacked'], runesPickedUp: ['runesPickedUp', 'rune_pickups'],
  buybacks: ['buybackCount'], highestKillStreak: ['highestKillStreak'], doubleKills: ['doubleKills'],
  tripleKills: ['tripleKills'], ultraKills: ['ultraKills'], rampages: ['rampages'],
};
const SMALLINT = 32767;
const INT_COLUMNS = new Set(['netWorth', 'totalGold', 'goldSpent', 'heroDamage', 'towerDamage', 'heroHealing']);
const SOURCE_FIELDS = new Set(Object.values(COLUMNS).flat());

/** Fields that are identity, copies, the parent path, or a stored fantasy calculation: dropped (SCHEMA.md 7.5). */
const DROPPED = new Set([
  'playerId', 'steamId', 'steamId32', 'teamId', 'heroId', 'firstBloodClaimed', 'firstblood_claimed', 'fantasyPoints',
  'personaname', 'playerName', 'teamPlayerName', 'hero_name', 'teamName', 'win', 'gameId', 'matchId', 'gameDate',
  'algorithm', 'basePoints', 'bonusPoints', 'bonusBreakdown', 'lastRecalculated',
]);
/** Fields of parsed replays that go to `extra` under their own name. */
const RICH = new Set([
  'abilityTargets', 'abilityUses', 'actions', 'additionalUnits', 'ancientKills', 'damageInflictor', 'damageInflictorReceived',
  'damageTaken', 'disableCount', 'goldReasons', 'hexCount', 'invisibilityCount', 'isBot', 'isRadiant', 'itemUses', 'items',
  'killStreaks', 'laneEfficiency', 'lanePos', 'level', 'lifeStateData', 'maxHeroDamageInstance', 'modifierValues',
  'multiKillStreaks', 'obsWardLog', 'permanentBuffs', 'purchaseCount', 'purchaseLog', 'role', 'rootCount', 'runePickups',
  'senWardLog', 'silenceCount', 'slowCount', 'soloKills', 'stunDuration', 'stuns', 'teamfightParticipation',
  'teamfight_participation', 'wardsDestroyed', 'xpReasons', 'multiKills',
]);
const AT_MINUTE = /^(gold|xp|lh)At(10|20|30)$/;

/** The Steam64 of a performance: its own Steam fields, else the roster entry it names. */
export function steamOf(state: MapState, doc: Doc): string | null {
  const d = doc.data;
  for (const v of [d.steamId, doc.id, d.playerId]) if (isSteam64(v)) return v;
  for (const v of [d.playerId, doc.id]) {
    const member = typeof v === 'string' ? state.members.get(v) : undefined;
    if (member?.steamId64) return member.steamId64;
  }
  const unknown = /^unknown_(\d+)$/.exec(doc.id);
  if (unknown) return toSteam64(unknown[1]);
  if (isSteam32(d.steamId32)) return toSteam64(d.steamId32);
  if (isSteam32(doc.id)) return toSteam64(doc.id);
  return null;
}

export function mapPerformances(state: MapState): void {
  const docs = docsOf(state.capture, KIND);
  state.ctx.read(KIND, docs);
  const games = new Map(state.rows.get(s.games).map((g) => [g.id as string, g]));
  const unknownFields = new Map<string, number>();
  for (const doc of docs) {
    const matchId = ancestorId(doc, 2);
    const gameId = state.gameIds.get(matchId)?.get(ancestorId(doc));
    const game = gameId ? games.get(gameId) : undefined;
    if (!game) {
      state.ctx.outcome(KIND, 'unmapped', 'the performance\'s game is not imported', doc.path);
      continue;
    }
    const steamId64 = steamOf(state, doc);
    if (!steamId64) {
      state.ctx.outcome(KIND, 'unmapped', 'the performance resolves to no Steam id', doc.path);
      continue;
    }
    const d = doc.data;
    const row: Record<string, unknown> = { tournamentId: state.tournamentId, gameId, steamId64, playerSlot: null };
    const missing: string[] = [];
    for (const [column, sources] of Object.entries(COLUMNS)) {
      const value = sources.map((f) => toInt(d[f])).find((v) => v !== null);
      if (value === undefined) missing.push(column);
      const limit = INT_COLUMNS.has(column) ? 2_000_000_000 : SMALLINT;
      if (value !== undefined && Math.abs(value) > limit) {
        state.ctx.finding({ kind: KIND, code: 'conflict', reason: `${column} is out of the column's range; capped`, ref: `${doc.path} ${value}` });
      }
      row[column] = Math.max(-limit, Math.min(value ?? 0, limit));
    }
    const fb = toBool(d.firstBloodClaimed) ?? toBool(d.firstblood_claimed);
    if (fb === null) missing.push('firstBlood');
    row.firstBlood = fb ?? false;
    row.heroId = toInt(d.heroId);
    row.teamId = teamOf(state, doc, steamId64, game);
    const extra: Record<string, unknown> = {};
    const atMinute: Record<string, Record<string, unknown>> = {};
    for (const [field, value] of Object.entries(d)) {
      if (DROPPED.has(field) || SOURCE_FIELDS.has(field)) continue;
      const at = AT_MINUTE.exec(field);
      if (at) (atMinute[`${at[1]}At`] ??= {})[at[2]] = value;
      else if (RICH.has(field)) extra[field === 'teamfight_participation' ? 'teamfightParticipation' : field] = value;
      else {
        extra[field] = value;
        unknownFields.set(field, (unknownFields.get(field) ?? 0) + 1);
      }
    }
    Object.assign(extra, atMinute);
    if (missing.length) extra.missing = missing;
    if (Object.keys(extra).some((k) => RICH.has(k) && k !== 'multiKills') || Object.keys(atMinute).length) game.parsed = true;
    row.extra = fitJson(state, performanceExtraSchema, extra, `${KIND} ${doc.path} extra`);
    state.ctx.player(steamId64, { nickname: toText(d.personaname) ?? toText(d.playerName) });
    state.rows.add(s.performances, row);
    state.ctx.outcome(KIND, 'mapped');
  }
  for (const [field, n] of unknownFields) {
    state.ctx.finding({ kind: KIND, code: 'unknown-field', reason: `field "${field}" is not named in SCHEMA.md; kept in extra`, ref: `${n} documents` });
  }
}

/** `teamId`, else the roster the player was on, else the side of the game they played; null when unknown. */
function teamOf(state: MapState, doc: Doc, steamId64: string, game: Record<string, unknown>): string | null {
  const id = toText(doc.data.teamId);
  if (id && state.teamIds.has(id)) return id;
  if (id) state.ctx.finding({ kind: KIND, code: 'unmapped', reason: 'teamId is not a team of this tournament', ref: `${doc.path} ${id}` });
  const match = state.matchTeams.get(game.matchId as string);
  const onRoster = [match?.a, match?.b].find((t) => t && state.memberBySteam.has(`${t}/${steamId64}`));
  if (onRoster) {
    state.ctx.finding({ kind: KIND, code: 'decision', reason: 'a performance without teamId takes the team whose roster has the player', ref: doc.path });
    return onRoster;
  }
  const radiant = toBool(obj(doc.data).isRadiant);
  if (radiant !== null) {
    const side = (radiant ? game.radiantTeamId : game.direTeamId) as string | null;
    if (side) {
      state.ctx.finding({ kind: KIND, code: 'decision', reason: 'a performance without teamId takes the team of its side of the game', ref: doc.path });
      return side;
    }
  }
  if (!id) state.ctx.finding({ kind: KIND, code: 'unmapped', reason: 'a performance has no team, and none could be found; team left empty', ref: doc.path });
  return null;
}
