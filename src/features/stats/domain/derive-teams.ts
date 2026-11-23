// Teams of the season model: series record, game record, per-game averages, sides, heroes picked
// and bans by and against them.

import { inc, mean, type GameX, type HeroUse, type Perf, type TeamAverages, type TeamX } from './model';
import type { DsTeam, StatsDataset } from './types';

export function emptyTeam(t: DsTeam): TeamX {
  return {
    ...t, players: [], games: [], wins: 0, losses: 0, wr: 0, series: { w: 0, d: 0, l: 0 },
    avg: null as unknown as TeamAverages, radiant: { games: 0, wins: 0 }, dire: { games: 0, wins: 0 },
    heroPicks: [], bansBy: [], bansAgainst: [], form: [],
  };
}

interface Side { g: GameX; mine: Perf[]; radiant: boolean; win: boolean }

function averages(t: TeamX, side: Side[]): TeamAverages {
  const sum = (s: Side, f: (p: Perf) => number) => s.mine.reduce((x, p) => x + f(p), 0);
  const parsedSide = side.filter(s => s.g.parsed);
  const fbKnown = parsedSide.filter(s => s.g.fbPerf);
  return {
    kills: mean(side.map(s => sum(s, p => p.kills))),
    deaths: mean(side.map(s => sum(s, p => p.deaths))),
    assists: mean(side.map(s => sum(s, p => p.assists))),
    gpm: mean(side.map(s => sum(s, p => p.gpm))),
    heroDamage: mean(side.map(s => sum(s, p => p.heroDamage))),
    towerDamage: mean(side.map(s => sum(s, p => p.towerDamage))),
    heroHealing: mean(side.map(s => sum(s, p => p.heroHealing))),
    netWorth: mean(side.map(s => sum(s, p => p.netWorth))),
    wards: mean(parsedSide.map(s => sum(s, p => p.obsPlaced + p.senPlaced))),
    dewards: mean(parsedSide.map(s => sum(s, p => p.observerKills + p.sentryKills))),
    stacks: mean(parsedSide.map(s => sum(s, p => p.campsStacked))),
    roshans: mean(parsedSide.map(s => sum(s, p => p.roshanKills))),
    duration: mean(side.map(s => s.g.duration)),
    winDuration: side.some(s => s.win) ? mean(side.filter(s => s.win).map(s => s.g.duration)) : null,
    lossDuration: side.some(s => !s.win) ? mean(side.filter(s => !s.win).map(s => s.g.duration)) : null,
    fbRate: fbKnown.length ? fbKnown.filter(s => s.g.fbPerf!.tid === t.id).length / fbKnown.length : null,
  };
}

function heroesAndBans(t: TeamX, side: Side[]): void {
  const picks = new Map<number, HeroUse>();
  const bansBy = new Map<number, number>();
  const bansAgainst = new Map<number, number>();
  for (const s of side) {
    for (const p of s.mine) {
      const h = picks.get(p.heroId) ?? { heroId: p.heroId, games: 0, wins: 0 };
      h.games++; if (p.win) h.wins++;
      picks.set(p.heroId, h);
    }
    const mySide = s.radiant ? 0 : 1;
    for (const [hero, isPick, team] of s.g.pb) {
      if (isPick) continue;
      inc(team === mySide ? bansBy : bansAgainst, hero);
    }
  }
  t.heroPicks = [...picks.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
  t.bansBy = [...bansBy.entries()].map(([heroId, count]) => ({ heroId, count })).sort((a, b) => b.count - a.count);
  t.bansAgainst = [...bansAgainst.entries()].map(([heroId, count]) => ({ heroId, count })).sort((a, b) => b.count - a.count);
}

/** Fills every team's numbers. Returns the teams that played at least one game. */
export function deriveTeams(ds: StatsDataset, games: GameX[], teamById: Map<string, TeamX>): TeamX[] {
  for (const g of games) {
    g.radiantTeam?.games.push(g);
    g.direTeam?.games.push(g);
  }
  for (const m of ds.matches) {
    const a = teamById.get(m.teamA); const b = teamById.get(m.teamB);
    if (m.scoreA === m.scoreB) { if (a) a.series.d++; if (b) b.series.d++; continue; }
    const aWon = m.scoreA > m.scoreB;
    if (a) { if (aWon) a.series.w++; else a.series.l++; }
    if (b) { if (aWon) b.series.l++; else b.series.w++; }
  }
  for (const t of teamById.values()) {
    const side: Side[] = t.games.map(g => ({ g, mine: g.perfs.filter(p => p.tid === t.id), radiant: g.radiant === t.id, win: g.winnerId === t.id }));
    t.wins = side.filter(s => s.win).length;
    t.losses = side.length - t.wins;
    t.wr = side.length ? t.wins / side.length : 0;
    t.form = side.map(s => s.win);
    t.avg = averages(t, side);
    t.radiant = { games: side.filter(s => s.radiant).length, wins: side.filter(s => s.radiant && s.win).length };
    t.dire = { games: side.filter(s => !s.radiant).length, wins: side.filter(s => !s.radiant && s.win).length };
    heroesAndBans(t, side);
    t.players.sort((a, b) => b.games - a.games);
  }
  return [...teamById.values()].filter(t => t.games.length > 0);
}
