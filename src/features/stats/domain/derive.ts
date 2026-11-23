// Turns the stats dataset into the cross-referenced season model every stats hub page reads:
// games ↔ performances ↔ players ↔ teams ↔ heroes, plus per-entity aggregates and season totals.
// The types are in model.ts and the queries on the model in rank.ts; both are re-exported here,
// where the hub's pages import them from.

import { deriveGames, derivePerfs, scorePerfs } from './derive-games';
import { deriveHeroes } from './derive-heroes';
import { derivePlayers } from './derive-players';
import { deriveTeams, emptyTeam } from './derive-teams';
import type { GameX, Model, Perf, PlayerX, SeasonTotals, TeamX } from './model';
import type { StatsDataset } from './types';

export type { GameX, HeroUse, HeroX, MetricAgg, Model, Perf, PlayerX, SeasonTotals, TeamAverages, TeamX } from './model';
export { opponentOf, pctRank, rankPlayers, topPerfs, type RankMode, type RankRow } from './rank';

function seasonTotals(perfs: Perf[], games: GameX[]): SeasonTotals {
  const tot = (f: (p: Perf) => number) => perfs.reduce((s, p) => s + f(p), 0);
  return {
    kills: tot(p => p.kills), deaths: tot(p => p.deaths), assists: tot(p => p.assists),
    rampages: tot(p => p.rampages), ultraKills: tot(p => p.ultraKills), tripleKills: tot(p => p.tripleKills),
    roshans: tot(p => p.roshanKills), towers: tot(p => p.towerKills),
    wards: tot(p => p.obsPlaced + p.senPlaced), dewards: tot(p => p.observerKills + p.sentryKills),
    stacks: tot(p => p.campsStacked), runes: tot(p => p.runesPickedUp), buybacks: tot(p => p.buybackCount),
    couriers: tot(p => p.courierKills), heroDamage: tot(p => p.heroDamage), gold: tot(p => p.totalGold),
    healing: tot(p => p.heroHealing), lastHits: tot(p => p.lastHits), denies: tot(p => p.denies),
    hours: games.reduce((s, g) => s + g.duration, 0) / 3600,
  };
}

/** Half the median games of the named players, at least 2: who counts as "qualified" for averages. */
function minGamesOf(players: PlayerX[]): number {
  const gameCounts = players.map(p => p.games).sort((a, b) => a - b);
  const median = gameCounts.length ? gameCounts[Math.floor(gameCounts.length / 2)] : 0;
  return Math.max(2, Math.round(median * 0.5));
}

export function deriveModel(ds: StatsDataset): Model {
  const teamById = new Map<string, TeamX>(ds.teams.map(t => [t.id, emptyTeam(t)]));
  const games = deriveGames(ds, teamById);
  const perfs = derivePerfs(ds, games);
  scorePerfs(ds, perfs, games);

  const playerById = derivePlayers(ds, perfs, teamById);
  for (const p of perfs) p.team = teamById.get(p.tid);
  const players = [...playerById.values()];
  for (const p of players) p.team?.players.push(p);

  const teams = deriveTeams(ds, games, teamById);
  const draftGames = games.filter(g => g.pb.length > 0).length;
  const { heroes, heroById } = deriveHeroes(perfs, games, draftGames);

  return {
    ds, games, perfs, players, playerById, teams, teamById, heroes, heroById, draftGames,
    parsedGames: games.filter(g => g.parsed).length,
    minGames: minGamesOf(players),
    totals: seasonTotals(perfs, games),
  };
}
