// Teams, rosters, group membership, Steam players and stand-in registrations (SCHEMA.md 7.6).

import * as s from '@/platform/db/schema';
import { smurfAccountsSchema, topHeroesSchema } from '@/platform/db/schema/json';
import { fields } from '../context';
import { ancestorId, docsOf, type Doc } from '../source';
import { isSteam64, steam64FromProfileUrl, toInt, toSteam64, toText, withoutNulls } from '../values';
import { arr, createdOf, obj, timeOf, updatedOf } from './read';
import { fitJson, type MapState } from './state';
import { tournamentDoc } from './tournament';

const TEAM_FIELDS = fields(
  'id', 'name', 'tag', 'logoUrl', 'motto', 'status', 'captainId', 'createdAt', 'updatedAt', 'discordUsername',
  'captainDiscordUsername', 'divisionId', 'division', 'seedMmr', 'seedPosition', 'mmrCap', 'banReason', 'bannedAt',
  'bannedBy', 'coach', 'roster', 'points', 'seasonPoints', 'wins', 'draws', 'losses', 'matchesPlayed', 'recentForm',
  'stats', 'totalMMR', 'mostPlayedHeroes', 'lastStatsUpdate', 'averageAssistsPerGame', 'averageDeathsPerGame',
  'averageFantasyPoints', 'averageGpm', 'averageHeroDamage', 'averageHeroHealing', 'averageKillsPerGame',
  'averageLastHits', 'averageMatchDurationMinutes', 'averageNetWorth', 'averageTowerDamage', 'averageXpm',
);
const PLAYER_FIELDS = fields(
  'id', 'steamId64', 'steamId', 'steamId32', 'nickname', 'role', 'mmr', 'profileScreenshotUrl', 'smurfAccounts',
  'personaname', 'avatar', 'avatarmedium', 'avatarfull', 'mostPlayedHeroes', 'steamProfileUrl', 'createdAt', 'updatedAt',
);
const STANDIN_FIELDS = fields(
  'userId', 'nickname', 'discordUsername', 'mmr', 'profileScreenshotUrl', 'roles', 'description', 'status', 'createdAt',
  'verifiedAt', 'steamId', 'steamId32', 'steamProfileUrl', 'matches',
);

export const POSITION: Record<string, string> = {
  carry: 'carry', mid: 'mid', offlane: 'offlane', 'soft support': 'soft_support', 'hard support': 'hard_support',
};
const TEAM_STATUSES = new Set(['pending', 'verified', 'rejected', 'warning', 'banned', 'eliminated']);

export function mapTeams(state: MapState): void {
  const { ctx, rows } = state;
  const docs = docsOf(state.capture, 'teams');
  ctx.read('teams', docs);
  const names = new Set<string>();
  const swissGroup = toText(tournamentDoc(state).data.type) === 'swiss' ? [...state.groupStage.keys()][0] : undefined;
  for (const doc of docs) {
    ctx.checkFields('teams', doc, TEAM_FIELDS);
    const d = doc.data;
    let name = toText(d.name) ?? doc.id;
    if (names.has(name.toLowerCase())) {
      ctx.finding({ kind: 'teams', code: 'conflict', reason: 'two teams have the same name; the second gets a number', ref: doc.path });
      name = `${name} (${doc.id.slice(0, 4)})`;
    }
    names.add(name.toLowerCase());
    let status = toText(d.status) ?? 'pending';
    if (!TEAM_STATUSES.has(status)) {
      ctx.finding({ kind: 'teams', code: 'unmapped', reason: `team status "${status}" has no column value; imported as pending`, ref: doc.path });
      status = 'pending';
    }
    rows.add(s.teams, {
      tournamentId: state.tournamentId, id: doc.id, name, tag: toText(d.tag), logoUrl: toText(d.logoUrl), motto: toText(d.motto),
      status, captainUserId: ctx.user(d.captainId, 'teams:captainId'),
      captainDiscord: state.options.anonymize ? null : toText(d.captainDiscordUsername) ?? toText(d.discordUsername),
      seedMmr: toInt(d.seedMmr), mmrCapAtRegistration: toInt(d.mmrCap),
      bannedAt: timeOf(state, 'teams', doc, 'bannedAt', d.bannedAt), bannedBy: ctx.user(d.bannedBy, 'teams:bannedBy'),
      banReason: toText(d.banReason), registeredAt: createdOf(state, 'teams', doc), updatedAt: updatedOf(state, 'teams', doc),
    });
    state.teamIds.add(doc.id);
    state.teamNames.set(doc.id, name);
    ctx.outcome('teams', 'mapped');

    const groupId = toText(d.divisionId) ?? toText(d.division) ?? swissGroup;
    if (groupId && state.groupStage.has(groupId)) {
      rows.add(s.groupTeams, { tournamentId: state.tournamentId, groupId, teamId: doc.id, seed: toInt(d.seedPosition) });
    } else if (groupId) {
      ctx.finding({ kind: 'teams', code: 'unmapped', reason: 'the team names a division that does not exist; not placed in a group', ref: `${doc.path} -> ${groupId}` });
    }
    if (d.coach) mapCoach(state, doc);
  }
  mapPlayers(state, new Map(docs.map((d) => [d.id, obj(d.data.roster)])));
  checkRosterCopies(state, docs);
}

/** The old `mostPlayedHeroes` cache (`lastUpdated`) in the shape of `players.top_heroes` (`fetchedAt`). */
function topHeroes(value: unknown): unknown {
  const v = obj(value);
  if (!Array.isArray(v.overall) && !Array.isArray(v.recent)) return value;
  const fetched = toText(v.lastUpdated) ?? toText(v.fetchedAt);
  return withoutNulls({ overall: v.overall ?? [], recent: v.recent ?? [], fetchedAt: fetched && !Number.isNaN(Date.parse(fetched)) ? new Date(fetched).toISOString() : undefined });
}

/** `teams.coach` → a team member of kind coach (Steam64 from the profile link when it has one). */
function mapCoach(state: MapState, team: Doc): void {
  const c = obj(team.data.coach);
  const url = toText(c.steamProfileUrl);
  const steamId64 = steam64FromProfileUrl(url);
  const id = toText(c.id) ?? `${team.id}-coach`;
  state.ctx.player(steamId64, { nickname: toText(c.nickname) });
  state.rows.add(s.teamMembers, {
    tournamentId: state.tournamentId, id, teamId: team.id, steamId64, kind: 'coach', position: null,
    nickname: toText(c.nickname) ?? 'Coach', mmr: null, mmrProofUrl: null, profileUrl: steamId64 ? null : url,
    smurfAccounts: [], joinedAt: timeOf(state, 'teams', team, 'coach.updatedAt', c.updatedAt) ?? createdOf(state, 'teams', team),
    leftAt: null, leftReason: null, updatedAt: updatedOf(state, 'teams', team),
  });
  state.members.set(id, { teamId: team.id, steamId64, kind: 'coach', nickname: toText(c.nickname) ?? 'Coach' });
}

/** Steam ids that the tournament's game data uses, to settle rosters whose two Steam fields disagree. */
function steamIdsInGames(state: MapState): Set<string> {
  const ids = new Set<string>();
  for (const p of docsOf(state.capture, 'matches.games.performances')) {
    for (const v of [p.id, p.data.playerId, p.data.steamId]) if (isSteam64(v)) ids.add(v);
  }
  return ids;
}

function rosterSteamId(state: MapState, doc: Doc, played: Set<string>): string | null {
  const d = doc.data;
  const s64 = toSteam64(d.steamId64);
  const sid = toSteam64(d.steamId);
  const s32 = toSteam64(d.steamId32);
  if (s64 && sid && s64 !== sid) {
    const chosen = played.has(sid) && !played.has(s64) ? sid : s64;
    state.ctx.finding({
      kind: 'teams.players', code: 'conflict',
      reason: 'steamId and steamId64 differ: the one the games were played on is used, else steamId64 (owner to confirm)',
      ref: `${doc.path} steamId=${sid} steamId64=${s64} steamId32=${String(d.steamId32)} -> ${chosen}`,
    });
    return chosen;
  }
  return s64 ?? sid ?? s32;
}

/**
 * Roster documents. In some tournaments the nickname, MMR and pictures live only in the team's
 * `roster` map (keyed by Steam64), not in the roster document: a value missing on the document is
 * taken from the map.
 */
function mapPlayers(state: MapState, rosters: Map<string, Record<string, unknown>>): void {
  const { ctx } = state;
  const docs = docsOf(state.capture, 'teams.players');
  ctx.read('teams.players', docs);
  const played = steamIdsInGames(state);
  const active = new Map<string, { id: string; joinedAt: Date; row: Record<string, unknown> }>();
  for (const doc of docs) {
    ctx.checkFields('teams.players', doc, PLAYER_FIELDS);
    const teamId = ancestorId(doc);
    const fromMap = obj(rosters.get(teamId)?.[String(toSteam64(doc.data.steamId64) ?? toSteam64(doc.data.steamId) ?? '')]);
    const d: Record<string, unknown> = { ...fromMap, ...withoutNulls(doc.data) };
    for (const k of ['nickname', 'profileScreenshotUrl', 'avatar', 'avatarmedium', 'avatarfull']) if (d[k] === '' && fromMap[k]) d[k] = fromMap[k];
    if (!state.teamIds.has(teamId)) {
      ctx.outcome('teams.players', 'unmapped', 'the roster entry\'s team does not exist', doc.path);
      continue;
    }
    const steamId64 = rosterSteamId(state, { ...doc, data: d }, played);
    if (!steamId64) {
      ctx.outcome('teams.players', 'unmapped', 'the roster entry has no Steam id', doc.path);
      continue;
    }
    const role = toText(d.role)?.toLowerCase() ?? '';
    const position = POSITION[role] ?? null;
    if (role && !position) ctx.finding({ kind: 'teams.players', code: 'unmapped', reason: `role "${String(d.role)}" is not a position; left empty`, ref: doc.path });
    const nickname = toText(d.nickname) ?? toText(d.personaname) ?? steamId64;
    const top = d.mostPlayedHeroes ? topHeroesSchema.safeParse(topHeroes(d.mostPlayedHeroes)) : null;
    if (top && !top.success) ctx.finding({ kind: 'teams.players', code: 'unmapped', reason: 'mostPlayedHeroes has another shape than players.top_heroes; not imported', ref: doc.path });
    ctx.player(steamId64, {
      nickname, personaName: toText(d.personaname), avatarUrl: toText(d.avatar), avatarMediumUrl: toText(d.avatarmedium),
      avatarFullUrl: toText(d.avatarfull), topHeroes: top?.success ? top.data : undefined,
    });
    const smurfs = fitJson(state, smurfAccountsSchema, arr(d.smurfAccounts).map(obj).map((a) => withoutNulls({
      steamId64: toSteam64(a.steamId64) ?? toSteam64(a.steamId32), profileUrl: toText(a.steamProfileUrl),
    })), `teams.players ${doc.path} smurfAccounts`);
    const row: Record<string, unknown> = {
      tournamentId: state.tournamentId, id: doc.id, teamId, steamId64, kind: 'player', position, nickname,
      mmr: toInt(d.mmr), mmrProofUrl: toText(d.profileScreenshotUrl), profileUrl: null, smurfAccounts: smurfs,
      joinedAt: createdOf(state, 'teams.players', doc), leftAt: null, leftReason: null, updatedAt: updatedOf(state, 'teams.players', doc),
    };
    const earlier = active.get(steamId64);
    if (earlier) {
      // One active roster spot per player (SCHEMA.md 9): the later entry stays, the earlier one left.
      const [keep, leave] = earlier.joinedAt <= (row.joinedAt as Date) ? [row, earlier.row] : [earlier.row, row];
      leave.leftAt = keep.joinedAt;
      leave.leftReason = 'transfer';
      ctx.finding({ kind: 'teams.players', code: 'conflict', reason: 'a player is on two rosters at once: the later entry stays active, the earlier one gets left_at', ref: `${String(leave.id)} (team ${String(leave.teamId)}) and ${String(keep.id)} (team ${String(keep.teamId)})` });
      if (keep === row) active.set(steamId64, { id: doc.id, joinedAt: row.joinedAt as Date, row });
    } else {
      active.set(steamId64, { id: doc.id, joinedAt: row.joinedAt as Date, row });
    }
    state.rows.add(s.teamMembers, row);
    state.members.set(doc.id, { teamId, steamId64, kind: 'player', nickname });
    state.memberBySteam.set(`${teamId}/${steamId64}`, doc.id);
    ctx.outcome('teams.players', 'mapped');
  }
}

/**
 * `teams.roster` repeats the roster documents and, in some tournaments, holds values they lack.
 * Values the document lacks were taken from it above; here, entries with no document and values
 * that disagree are reported (the document wins).
 */
function checkRosterCopies(state: MapState, teams: readonly Doc[]): void {
  const docs = new Map(docsOf(state.capture, 'teams.players').map((d) => [`${ancestorId(d)}/${toSteam64(d.data.steamId64) ?? toSteam64(d.data.steamId) ?? ''}`, d]));
  let filled = 0;
  for (const team of teams) {
    for (const [key, raw] of Object.entries(obj(team.data.roster))) {
      const entry = obj(raw);
      const doc = docs.get(`${team.id}/${toSteam64(key) ?? key}`);
      if (!doc) {
        state.ctx.finding({ kind: 'teams', code: 'conflict', reason: 'teams.roster names a player with no roster document (the entry is not imported)', ref: `${team.path} roster.${key}` });
        continue;
      }
      for (const field of ['nickname', 'mmr', 'role']) {
        const own = doc.data[field];
        if (own === undefined || own === null || own === '') {
          if (entry[field] !== undefined && entry[field] !== null && entry[field] !== '') filled++;
        } else if (entry[field] !== undefined && entry[field] !== null && String(entry[field]) !== String(own)) {
          state.ctx.finding({ kind: 'teams', code: 'conflict', reason: `teams.roster has another ${field} than the roster document; the document is used`, ref: `${team.path} roster.${key}` });
        }
      }
    }
  }
  if (filled) state.ctx.finding({ kind: 'teams.players', code: 'decision', reason: 'values the roster document lacks (nickname, MMR, role) were taken from the team roster map', ref: `${filled} values` });
}

/** Letnia's stand-in pool: `standins/{uid}` → `standin_registrations`. */
export function mapStandinRegistrations(state: MapState): void {
  const { ctx } = state;
  const docs = docsOf(state.capture, 'standins');
  ctx.read('standins', docs);
  for (const doc of docs) {
    ctx.checkFields('standins', doc, STANDIN_FIELDS);
    const d = doc.data;
    const userId = ctx.user(d.userId ?? doc.id, 'standins:userId');
    const steamId64 = toSteam64(d.steamId) ?? toSteam64(d.steamId32) ?? steam64FromProfileUrl(d.steamProfileUrl);
    if (!userId || !steamId64) {
      ctx.outcome('standins', 'unmapped', 'a stand-in registration without a user id or Steam id', doc.path);
      continue;
    }
    const nickname = toText(d.nickname) ?? steamId64;
    ctx.player(steamId64, { nickname });
    const positions = arr(d.roles).map((r) => POSITION[String(r).toLowerCase()] ?? String(r));
    let description = toText(d.description);
    if (description && description.length > 300) {
      ctx.finding({ kind: 'standins', code: 'conflict', reason: 'description longer than 300 characters; cut to 300', ref: doc.path });
      description = description.slice(0, 300);
    }
    const status = d.status === 'verified' ? 'verified' : 'pending';
    if (d.status !== 'verified' && d.status !== 'pending') ctx.finding({ kind: 'standins', code: 'unmapped', reason: `status "${String(d.status)}" imported as pending`, ref: doc.path });
    state.rows.add(s.standinRegistrations, {
      tournamentId: state.tournamentId, userId, steamId64, nickname,
      discordUsername: state.options.anonymize ? null : toText(d.discordUsername),
      mmr: toInt(d.mmr), mmrProofUrl: toText(d.profileScreenshotUrl), positions, description, status,
      verifiedAt: timeOf(state, 'standins', doc, 'verifiedAt', d.verifiedAt), createdAt: createdOf(state, 'standins', doc),
    });
    state.registrations.set(userId, { steamId64, nickname, mmr: toInt(d.mmr) });
    ctx.outcome('standins', 'mapped');
  }
}
