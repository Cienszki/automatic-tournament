// Heroes of the season model: picks, wins, bans, contest and pick rates, sides, and who played them.

import { mean, type GameX, type HeroX, type Perf, type PlayerX } from './model';

function emptyHero(heroId: number): HeroX {
  return {
    heroId, picks: 0, wins: 0, bans: 0, contest: 0, pickRate: 0, banRate: 0, contestRate: 0, wr: 0,
    radiant: { picks: 0, wins: 0 }, dire: { picks: 0, wins: 0 }, firstPhaseBans: 0, perfs: [],
    avgK: 0, avgD: 0, avgA: 0, avgGpm: 0, players: [],
  };
}

function finish(h: HeroX, games: number, draftGames: number): void {
  h.contest = h.picks + h.bans;
  h.pickRate = games ? h.picks / games : 0;
  h.banRate = draftGames ? h.bans / draftGames : 0;
  h.contestRate = games ? Math.min(1, h.contest / games) : 0;
  h.wr = h.picks ? h.wins / h.picks : 0;
  h.avgK = mean(h.perfs.map(p => p.kills));
  h.avgD = mean(h.perfs.map(p => p.deaths));
  h.avgA = mean(h.perfs.map(p => p.assists));
  h.avgGpm = mean(h.perfs.map(p => p.gpm));
  const users = new Map<string, { player: PlayerX; games: number; wins: number }>();
  for (const p of h.perfs) {
    if (!p.player) continue;
    const u = users.get(p.pid) ?? { player: p.player, games: 0, wins: 0 };
    u.games++; if (p.win) u.wins++;
    users.set(p.pid, u);
  }
  h.players = [...users.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
}

/** Every hero picked or banned, most contested first. */
export function deriveHeroes(perfs: Perf[], games: GameX[], draftGames: number): { heroes: HeroX[]; heroById: Map<number, HeroX> } {
  const heroById = new Map<number, HeroX>();
  const hero = (id: number): HeroX => {
    let h = heroById.get(id);
    if (!h) { h = emptyHero(id); heroById.set(id, h); }
    return h;
  };
  for (const p of perfs) {
    if (!p.heroId) continue;
    const h = hero(p.heroId);
    h.picks++; if (p.win) h.wins++;
    const s = p.radiant ? h.radiant : h.dire;
    s.picks++; if (p.win) s.wins++;
    h.perfs.push(p);
  }
  for (const g of games) {
    const bans = g.pb.filter(x => !x[1]).sort((a, b) => a[3] - b[3]);
    bans.forEach(([id], i) => { const h = hero(id); h.bans++; if (i < 4) h.firstPhaseBans++; });
  }
  for (const h of heroById.values()) finish(h, games.length, draftGames);
  const heroes = [...heroById.values()].sort((a, b) => b.contest - a.contest || b.picks - a.picks);
  return { heroes, heroById };
}
