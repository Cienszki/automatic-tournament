// The stats hub's dataset, built from a tournament's rows: every counted game with its
// performances, plus teams, groups, players and series results, packed into one compact payload
// (types.ts). The hub derives everything else from it (derive.ts).

import type { InputGame, InputMatch, InputPerformance, InputStage, TournamentInput } from '../input';
import { PERF_NUM_FIELDS, type DsGame, type DsGroup, type DsMatch, type DsTeam, type PerfNumField, type StatsDataset } from '../types';
import { compareIds, countedGames, countedMatches, startSeconds } from './counted';
import { datasetPlayers } from './players';

/**
 * Each dataset column from a performance row. `fantasyPoints` is 0: the old stored value was a
 * fantasy calculation, which the import does not keep (SCHEMA.md 7.5); fantasy scoring is WP-16.
 */
const PERF_VALUE: Record<PerfNumField, (p: InputPerformance) => number> = {
  heroId: (p) => p.heroId ?? 0, kills: (p) => p.kills, deaths: (p) => p.deaths, assists: (p) => p.assists,
  gpm: (p) => p.gpm, xpm: (p) => p.xpm, lastHits: (p) => p.lastHits, denies: (p) => p.denies, netWorth: (p) => p.netWorth,
  heroDamage: (p) => p.heroDamage, towerDamage: (p) => p.towerDamage, heroHealing: (p) => p.heroHealing,
  obsPlaced: (p) => p.obsPlaced, senPlaced: (p) => p.senPlaced, observerKills: (p) => p.observerKills,
  sentryKills: (p) => p.sentryKills, courierKills: (p) => p.courierKills, firstBloodClaimed: (p) => (p.firstBlood ? 1 : 0),
  highestKillStreak: (p) => p.highestKillStreak, buybackCount: (p) => p.buybacks, fantasyPoints: () => 0,
  doubleKills: (p) => p.doubleKills, tripleKills: (p) => p.tripleKills, ultraKills: (p) => p.ultraKills,
  rampages: (p) => p.rampages, roshanKills: (p) => p.roshanKills, towerKills: (p) => p.towerKills,
  neutralKills: (p) => p.neutralKills, laneKills: (p) => p.laneKills, totalGold: (p) => p.totalGold,
  goldSpent: (p) => p.goldSpent, runesPickedUp: (p) => p.runesPickedUp, campsStacked: (p) => p.campsStacked,
};

function toTeams(input: TournamentInput): DsTeam[] {
  return [...input.teams].sort((a, b) => compareIds(a.id, b.id)).map((t) => ({
    id: t.id, name: t.name.trim(), ...(t.tag ? { tag: t.tag } : {}), ...(t.logoUrl ? { logoUrl: t.logoUrl } : {}),
  }));
}

function toGroups(input: TournamentInput): DsGroup[] {
  const stagePosition = new Map(input.stages.map((s) => [s.id, s.position]));
  return [...input.groups]
    .sort((a, b) => (stagePosition.get(a.stageId) ?? 0) - (stagePosition.get(b.stageId) ?? 0) || a.position - b.position)
    .map((g) => ({ id: g.id, name: g.name, ...(g.tier !== null ? { tier: g.tier } : {}) }));
}

function toMatch(m: InputMatch, stageById: ReadonlyMap<string, InputStage>): DsMatch {
  const playoff = stageById.get(m.stageId)?.kind === 'bracket';
  const completedAt = (m.completedAt ?? m.scheduledAt)?.getTime();
  return {
    id: m.id,
    ...(m.groupId ? { groupId: m.groupId } : {}),
    teamA: m.teamAId ?? '', teamB: m.teamBId ?? '', scoreA: m.scoreA ?? 0, scoreB: m.scoreB ?? 0,
    winnerId: m.winnerTeamId,
    round: m.round,
    ...(m.matchday !== null ? { matchday: m.matchday } : {}),
    ...(playoff ? { isPlayoff: true } : {}),
    ...(playoff && m.code ? { playoffCode: m.code } : {}),
    ...(completedAt !== undefined ? { completedAt } : {}),
  };
}

function toGame(g: InputGame): DsGame {
  return {
    id: g.id, matchId: g.matchId, radiant: g.radiantTeamId!, dire: g.direTeamId!, radiantWin: !!g.radiantWin,
    duration: g.durationSeconds ?? 0, start: startSeconds(g), firstBlood: g.firstBloodSeconds ?? 0,
    pb: g.picksBans.map((x) => [x.heroId, x.isPick ? 1 : 0, x.team, x.order]),
  };
}

function toPerfs(input: TournamentInput, games: readonly InputGame[]): StatsDataset['perfs'] {
  const index = new Map(games.map((g, i) => [g.id, i]));
  return input.performances
    .filter((p) => index.has(p.gameId))
    .sort((a, b) => index.get(a.gameId)! - index.get(b.gameId)! || compareIds(a.steamId64, b.steamId64))
    .map((p) => [index.get(p.gameId)!, p.steamId64, p.teamId ?? '', ...PERF_NUM_FIELDS.map((f) => PERF_VALUE[f](p))]);
}

export function buildDataset(input: TournamentInput): StatsDataset {
  const stageById = new Map(input.stages.map((s) => [s.id, s]));
  const matches = countedMatches(input);
  const games = countedGames(input, matches);
  const perfs = toPerfs(input, games);
  return {
    tournamentId: input.tournament.id,
    generatedAt: input.loadedAt.toISOString(),
    teams: toTeams(input),
    groups: toGroups(input),
    players: datasetPlayers(input, new Set(perfs.map((r) => r[1]))),
    matches: matches.map((m) => toMatch(m, stageById)),
    games: games.map(toGame),
    perfs,
  };
}
