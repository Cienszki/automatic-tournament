// Games and performances of the season model, with the per-game numbers the hub reads (kill
// participation, per-minute values, whether the replay was parsed) and the performance score.

import { calcPerformanceScore, MIN_SCORED_GAME_MINS } from './performance-score';
import type { GameX, Perf, TeamX } from './model';
import { PERF_NUM_FIELDS, type StatsDataset } from './types';

export function deriveGames(ds: StatsDataset, teamById: Map<string, TeamX>): GameX[] {
  const matchById = new Map(ds.matches.map(m => [m.id, m]));
  return ds.games.map((g, idx) => ({
    ...g, idx, match: matchById.get(g.matchId),
    radiantTeam: teamById.get(g.radiant), direTeam: teamById.get(g.dire),
    winnerId: g.radiantWin ? g.radiant : g.dire, loserId: g.radiantWin ? g.dire : g.radiant,
    perfs: [], radiantKills: 0, direKills: 0, kills: 0, radiantNW: 0, direNW: 0, parsed: false,
  }));
}

export function derivePerfs(ds: StatsDataset, games: GameX[]): Perf[] {
  const perfs: Perf[] = ds.perfs.map((row, idx) => {
    const game = games[row[0]];
    const p = { idx, game, pid: row[1], tid: row[2] } as Perf;
    PERF_NUM_FIELDS.forEach((f, i) => { p[f] = (row[3 + i] as number) ?? 0; });
    p.radiant = p.tid === game.radiant;
    p.win = p.radiant === game.radiantWin;
    p.min = Math.max(1, game.duration / 60);
    p.kda = (p.kills + p.assists) / Math.max(1, p.deaths);
    p.hdpm = p.heroDamage / p.min;
    p.lhpm = p.lastHits / p.min;
    game.perfs.push(p);
    return p;
  });

  for (const g of games) {
    for (const p of g.perfs) {
      if (p.radiant) { g.radiantKills += p.kills; g.radiantNW += p.netWorth; } else { g.direKills += p.kills; g.direNW += p.netWorth; }
      // A replay is parsed when OpenDota reported what only a parsed replay has.
      if (p.runesPickedUp > 0 || p.obsPlaced > 0) g.parsed = true;
    }
    g.kills = g.radiantKills + g.direKills;
    for (const p of g.perfs) {
      p.parsed = g.parsed;
      p.teamKills = p.radiant ? g.radiantKills : g.direKills;
      p.kp = p.teamKills > 0 ? Math.min(1, (p.kills + p.assists) / p.teamKills) : 0;
      if (g.parsed && p.firstBloodClaimed) g.fbPerf = p;
    }
  }
  return perfs;
}

/** The game length every score is normalised to: the average over the scored performances. */
export function scoringMinutes(scored: readonly Perf[]): number {
  return scored.length ? scored.reduce((a, p) => a + p.min, 0) / scored.length : 40;
}

/**
 * The performance score of every performance that can be scored, and each game's MVP. Scored:
 * roster players with a role, playing for their own team, in games of at least
 * MIN_SCORED_GAME_MINS; the score is normalised to the average length of those games.
 */
export function scorePerfs(ds: StatsDataset, perfs: Perf[], games: GameX[]): void {
  const rosterOf = new Map(ds.players.map(p => [p.id, p]));
  const eligible = perfs.filter(p => {
    const info = rosterOf.get(p.pid);
    return !!info?.role && !info.standin && (!info.teamId || info.teamId === p.tid) && p.min >= MIN_SCORED_GAME_MINS;
  });
  const avgGameMins = scoringMinutes(eligible);
  for (const p of perfs) p.score = NaN;
  for (const p of eligible) {
    p.score = calcPerformanceScore(rosterOf.get(p.pid)!.role!, { ...p, firstBloodClaimed: p.firstBloodClaimed > 0 }, p.min, avgGameMins).total;
  }
  for (const g of games) {
    for (const p of g.perfs) if (Number.isFinite(p.score) && (!g.mvp || p.score > g.mvp.score)) g.mvp = p;
    if (!g.mvp) g.mvp = [...g.perfs].sort((a, b) => b.fantasyPoints - a.fantasyPoints)[0];
  }
}
