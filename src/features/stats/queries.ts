// Reads of the stats feature (server only). One loader reads every row a tournament's statistics
// need, in a fixed number of statements however big the tournament is; everything derived is
// computed from those rows by domain/compute.ts. Nothing derived is stored; the public read of the
// dataset is kept in the data cache instead (getCachedDataset).

import 'server-only';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { cachedQuery, tournamentTags } from '@/platform/cache';
import {
  games, getDb, groups, groupTeams, matches, performances, players, scoped, stages, standinRegistrations,
  standinRequests, teamMembers, teams, tournaments, type Db,
} from '@/platform/db';
import { buildDataset } from './domain/dataset/build-dataset';
import type { TournamentInput } from './domain/input';
import type { StatsDataset } from './domain/types';

/**
 * Reads `loadTournamentInput` runs for a tournament it loads: one for the tournament, then ten for
 * its rows, whatever its size. An unknown tournament or a draft costs the first one only.
 */
export const LOAD_READS = 11;

const MEMBER_COLUMNS = {
  id: teamMembers.id, teamId: teamMembers.teamId, steamId64: teamMembers.steamId64, kind: teamMembers.kind,
  position: teamMembers.position, nickname: teamMembers.nickname, mmr: teamMembers.mmr,
  joinedAt: teamMembers.joinedAt, leftAt: teamMembers.leftAt,
  avatarUrl: sql<string | null>`coalesce(${players.avatarMediumUrl}, ${players.avatarFullUrl}, ${players.avatarUrl})`,
};

const MATCH_COLUMNS = {
  id: matches.id, stageId: matches.stageId, groupId: matches.groupId, round: matches.round, matchday: matches.matchday,
  kind: matches.kind, replacesMatchId: matches.replacesMatchId, teamAId: matches.teamAId, teamBId: matches.teamBId,
  status: matches.status, scoreA: matches.scoreA, scoreB: matches.scoreB, winnerTeamId: matches.winnerTeamId,
  completedAt: matches.completedAt, scheduledAt: matches.scheduledAt, forfeitTeamId: matches.forfeitTeamId,
  forfeitScope: matches.forfeitScope, code: matches.code,
};

const GAME_COLUMNS = {
  id: games.id, matchId: games.matchId, number: games.number, radiantTeamId: games.radiantTeamId,
  direTeamId: games.direTeamId, radiantWin: games.radiantWin, isForfeit: games.isForfeit, startedAt: games.startedAt,
  durationSeconds: games.durationSeconds, firstBloodSeconds: games.firstBloodSeconds, picksBans: games.picksBans,
};

/** Every typed column of a performance; `extra` (the long tail of a parsed replay) is not read. */
const p = performances;
const PERFORMANCE_COLUMNS = {
  gameId: p.gameId, steamId64: p.steamId64, teamId: p.teamId, heroId: p.heroId, kills: p.kills, deaths: p.deaths,
  assists: p.assists, lastHits: p.lastHits, denies: p.denies, gpm: p.gpm, xpm: p.xpm, netWorth: p.netWorth,
  totalGold: p.totalGold, goldSpent: p.goldSpent, heroDamage: p.heroDamage, towerDamage: p.towerDamage,
  heroHealing: p.heroHealing, obsPlaced: p.obsPlaced, senPlaced: p.senPlaced, observerKills: p.observerKills,
  sentryKills: p.sentryKills, courierKills: p.courierKills, roshanKills: p.roshanKills, towerKills: p.towerKills,
  neutralKills: p.neutralKills, laneKills: p.laneKills, campsStacked: p.campsStacked, runesPickedUp: p.runesPickedUp,
  buybacks: p.buybacks, firstBlood: p.firstBlood, highestKillStreak: p.highestKillStreak, doubleKills: p.doubleKills,
  tripleKills: p.tripleKills, ultraKills: p.ultraKills, rampages: p.rampages,
};

const APPROVED = ['approved', 'appeal_approved'] as const;

export interface LoadOptions {
  /** Load a draft too. Only for its admins and preview-link holders (ARCHITECTURE.md 2.1); public reads leave it out. */
  drafts?: boolean;
}

/**
 * Every row of one tournament that its statistics are computed from; null when there is no such
 * tournament, or it is a draft and `drafts` is not set. All reads run in one read-only
 * repeatable-read transaction, so they see one snapshot even while a game is being recorded.
 * Each is filtered by the tournament (through `scoped`) and none runs in a loop: the count does
 * not grow with the number of teams, matches or games (LOAD_READS).
 */
export async function loadTournamentInput(tournamentId: string, db: Db, options: LoadOptions = {}): Promise<TournamentInput | null> {
  return db.transaction(async (tx) => {
    const [tournament] = await tx.select({ id: tournaments.id, formatPreset: tournaments.formatPreset, status: tournaments.status })
      .from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!tournament || (tournament.status === 'draft' && !options.drafts)) return null;
    return { tournament, loadedAt: new Date(), ...(await readRows(scoped(tx, tournamentId))) };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

async function readRows(t: ReturnType<typeof scoped>): Promise<Omit<TournamentInput, 'tournament' | 'loadedAt'>> {
  const [stageRows, groupRows, groupTeamRows, teamRows, memberRows, registrations, requests, matchRows, gameRows, perfRows] = await Promise.all([
    t.select({ id: stages.id, position: stages.position, kind: stages.kind, name: stages.name, ranking: stages.ranking }).from(stages),
    t.select({ id: groups.id, stageId: groups.stageId, name: groups.name, position: groups.position, tier: groups.tier }).from(groups),
    t.select({ groupId: groupTeams.groupId, teamId: groupTeams.teamId, seed: groupTeams.seed }).from(groupTeams),
    t.select({ id: teams.id, name: teams.name, tag: teams.tag, logoUrl: teams.logoUrl, status: teams.status }).from(teams).orderBy(asc(teams.id)),
    t.select(MEMBER_COLUMNS).from(teamMembers).leftJoin(players, eq(players.steamId64, teamMembers.steamId64)).orderBy(asc(teamMembers.id)),
    t.select({ steamId64: standinRegistrations.steamId64, nickname: standinRegistrations.nickname }).from(standinRegistrations)
      .orderBy(asc(standinRegistrations.userId)),
    t.select({ steamId64: standinRequests.standinSteamId64, nickname: standinRequests.standinNickname })
      .from(standinRequests, inArray(standinRequests.status, [...APPROVED])).orderBy(asc(standinRequests.id)),
    t.select(MATCH_COLUMNS).from(matches).orderBy(asc(matches.id)),
    t.select(GAME_COLUMNS).from(games).orderBy(asc(games.id)),
    t.select(PERFORMANCE_COLUMNS).from(performances).orderBy(asc(performances.gameId), asc(performances.steamId64)),
  ]);
  return {
    stages: stageRows,
    groups: groupRows,
    groupTeams: groupTeamRows,
    teams: teamRows,
    members: memberRows,
    // The pool first, then the requests: a later entry for the same person has the last word.
    standins: [...registrations, ...requests],
    matches: matchRows,
    games: gameRows,
    performances: perfRows,
  };
}

/**
 * The stats hub's dataset for a tournament, computed from all its rows on every call; null when
 * there is no such tournament or it is a draft (a public read). Takes the database handle so tests
 * and jobs run it on their own database; public reads go through `getCachedDataset`.
 */
export async function getDataset(tournamentId: string, db: Db = getDb()): Promise<StatsDataset | null> {
  const input = await loadTournamentInput(tournamentId, db);
  return input ? buildDataset(input) : null;
}

/**
 * `getDataset` kept in the data cache, built on the given `cachedQuery` so a test can run the
 * production wiring on a fake cache. Tagged with teams and matches as well as stats, because the
 * dataset also reads teams, rosters and stand-ins: a renamed team or a recorded game must refresh
 * it. A null (unknown id or draft) is not stored, so ids a crawler makes up never fill the cache,
 * and a draft is public as soon as it is published.
 */
export function createDatasetQuery(cached: typeof cachedQuery): (tournamentId: string) => Promise<StatsDataset | null> {
  return cached((tournamentId: string) => getDataset(tournamentId), {
    name: 'stats.dataset',
    tags: (tournamentId) => tournamentTags(tournamentId, 'stats', 'teams', 'matches'),
    cacheNull: false,
  });
}

/** The public read of the stats hub's dataset (/api/v1/stats/dataset). */
export const getCachedDataset = createDatasetQuery(cachedQuery);
