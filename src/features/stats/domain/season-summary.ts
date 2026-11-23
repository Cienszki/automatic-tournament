// The season numbers the stats hub shows, as plain data that can be cached and sent: counts,
// totals, leaders, the best per position, records, top heroes, the team of the latest period,
// achievements, the Elo table and the performance-score ranking. Read off the model and the
// overview, which compute them.

import type { Model, PlayerX } from './derive';
import { rankPlayers } from './rank';
import type { OverviewData } from './overview';
import type { SeasonTotals } from './model';

export interface PlayerRef { id: string; name: string; teamId: string | null }

export interface SeasonSummary {
  counts: {
    teams: number; namedPlayers: number; matches: number; games: number; parsedGames: number; draftGames: number;
    performances: number; minGames: number; heroesPicked: number;
  };
  totals: SeasonTotals;
  leaders: Array<{ player: PlayerRef; value: number }>;
  bestPerRole: Array<{ role: string; player: PlayerRef; value: number }>;
  bestTeam: { teamId: string; value: number } | null;
  records: Array<{ key: string; value: string; gameId: string; matchId: string; playerId: string; teamId: string }>;
  topHeroes: Array<{ heroId: number; picks: number; bans: number; contest: number; wins: number }>;
  teamOfTheWeek: { label: string; picks: Array<{ role: string; player: PlayerRef; avg: number }> } | null;
  achievements: { lit: number; total: number; top: { player: PlayerRef; points: number } | null };
  elo: Array<{ teamId: string; rating: number }>;
  /** Every player with a scored game, by average performance score. */
  scoreRanking: Array<{ player: PlayerRef; games: number; value: number }>;
}

const ref = (p: PlayerX): PlayerRef => ({ id: p.id, name: p.name, teamId: p.team?.id ?? p.teamId ?? null });

export function seasonSummary(model: Model, o: OverviewData): SeasonSummary {
  return {
    counts: {
      teams: model.teams.length, namedPlayers: model.players.length, matches: model.ds.matches.length, games: model.games.length,
      parsedGames: model.parsedGames, draftGames: model.draftGames, performances: model.perfs.length, minGames: model.minGames,
      heroesPicked: model.heroes.filter((h) => h.picks > 0).length,
    },
    totals: model.totals,
    leaders: o.leaders.map((l) => ({ player: ref(l.player), value: l.value })),
    bestPerRole: o.rankings.roles.map((r) => ({ role: r.role, player: ref(r.player), value: r.value })),
    bestTeam: o.rankings.team ? { teamId: o.rankings.team.team.id, value: o.rankings.team.value } : null,
    records: o.records.map((r) => ({ key: r.key, value: r.value, gameId: r.perf.game.id, matchId: r.perf.game.matchId, playerId: r.perf.pid, teamId: r.perf.tid })),
    topHeroes: o.heroes.map((h) => ({ heroId: h.heroId, picks: h.picks, bans: h.bans, contest: h.contest, wins: h.wins })),
    teamOfTheWeek: o.totw ? { label: o.totw.label, picks: o.totw.picks.map((p) => ({ role: p.role, player: ref(p.entry.player), avg: p.entry.avg })) } : null,
    achievements: {
      lit: o.achievements.lit, total: o.achievements.total,
      top: o.achievements.top ? { player: ref(o.achievements.top.player), points: o.achievements.top.points } : null,
    },
    elo: o.elo.map((e) => ({ teamId: e.team.id, rating: e.rating })),
    scoreRanking: rankPlayers(model, 'score', 'avg', 1).map((r) => ({ player: ref(r.player), games: r.player.games, value: r.value })),
  };
}
