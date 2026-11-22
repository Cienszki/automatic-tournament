import { PUB, type GameRow } from './game-row';
import { DAY_SECONDS } from './window';

export interface HeroCount {
  heroId: number;
  games: number;
  /** Games won */
  win: number;
}

/** The teams view's lists: "Puby — ogólnie" and "Puby — ostatnie 6 miesięcy" */
export interface MostPlayedHeroes {
  overall: HeroCount[];
  recent: HeroCount[];
}

export interface HeroListOptions {
  top?: number;
  recentDays?: number;
}

/**
 * Most-played heroes in pub games, from a stored history. Ties are broken by wins, then by hero
 * id, so the same history always gives the same list. Games of every account of a player
 * (smurfs) may be passed together; a game listed twice is counted once.
 */
export function mostPlayedHeroes(rows: readonly GameRow[], nowUnix: number, options: HeroListOptions = {}): MostPlayedHeroes {
  const top = options.top ?? 5;
  const since = nowUnix - (options.recentDays ?? 180) * DAY_SECONDS;
  const seen = new Set<number>();
  const pubs = rows.filter((r) => {
    if (r[4] !== PUB || seen.has(r[0])) return false;
    seen.add(r[0]);
    return true;
  });
  return {
    overall: count(pubs, top),
    recent: count(pubs.filter((r) => r[1] >= since), top),
  };
}

function count(rows: readonly GameRow[], top: number): HeroCount[] {
  const byHero = new Map<number, HeroCount>();
  for (const r of rows) {
    const h = byHero.get(r[2]) ?? { heroId: r[2], games: 0, win: 0 };
    h.games++;
    h.win += r[3];
    byHero.set(r[2], h);
  }
  return [...byHero.values()]
    .sort((a, b) => b.games - a.games || b.win - a.win || a.heroId - b.heroId)
    .slice(0, top);
}
