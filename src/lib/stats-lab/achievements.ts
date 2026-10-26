// Tiered achievements (bronze / silver / gold) — thresholds tuned on real PDL & Wiosenna data
// so bronze is roughly a top-10% game, silver top-1%, gold at or beyond the current records.
import type { Model, Perf, PlayerX } from './derive';
import { plural } from '../plural';

export type Tier = 0 | 1 | 2;
export const TIER_NAME = ['Brąz', 'Srebro', 'Złoto'] as const;
/** Genitive, for "3 do złota" */
export const TIER_GEN = ['brązu', 'srebra', 'złota'] as const;
export const TIER_COLOR = ['#c98a55', '#c9d1db', '#f2c94c'] as const;

export interface Achievement {
  id: string;
  name: string;
  /** Hover text; `{t}` is replaced with the tier thresholds, `{one|few|many}` with the form agreeing with the last one */
  desc: string;
  /** Single game (perf) or whole tournament (player) */
  scope: 'game' | 'career';
  thresholds: [number, number, number];
  value: (x: { perf?: Perf; player?: PlayerX }) => number;
  parsedOnly?: boolean;
  /** Short value suffix for chips */
  unit?: string;
}

const g = (f: (p: Perf) => number) => ({ perf }: { perf?: Perf }) => (perf ? f(perf) : 0);
const c = (f: (p: PlayerX) => number) => ({ player }: { player?: PlayerX }) => (player ? f(player) : 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'butcher', name: 'Rzeźnik', desc: 'Co najmniej {t} zabójstw w jednej grze', scope: 'game', thresholds: [15, 20, 26], value: g(p => p.kills) },
  { id: 'helper', name: 'Wszędzie obecny', desc: 'Co najmniej {t} asyst w jednej grze', scope: 'game', thresholds: [27, 35, 45], value: g(p => p.assists) },
  { id: 'immortal', name: 'Nieśmiertelny', desc: 'Gra bez śmierci z co najmniej {t} zabójstwami + asystami', scope: 'game', thresholds: [10, 18, 28], value: g(p => (p.deaths === 0 ? p.kills + p.assists : 0)) },
  { id: 'streak', name: 'Beyond Godlike', desc: 'Seria co najmniej {t} zabójstw bez śmierci', scope: 'game', thresholds: [7, 10, 15], value: g(p => p.highestKillStreak), parsedOnly: true },
  { id: 'multi', name: 'Multi-kill', desc: 'Triple kill (brąz), ultra kill (srebro), rampage (złoto)', scope: 'game', thresholds: [1, 2, 3], value: g(p => (p.rampages ? 3 : p.ultraKills ? 2 : p.tripleKills ? 1 : 0)), parsedOnly: true },
  { id: 'midas', name: 'Złota rączka', desc: 'Co najmniej {t} złota na minutę', scope: 'game', thresholds: [700, 820, 950], value: g(p => p.gpm), unit: 'GPM' },
  { id: 'scholar', name: 'Mędrzec', desc: 'Co najmniej {t} doświadczenia na minutę', scope: 'game', thresholds: [950, 1150, 1350], value: g(p => p.xpm), unit: 'XPM' },
  { id: 'farmer', name: 'Kombajn', desc: 'Co najmniej {t} last hitów w jednej grze', scope: 'game', thresholds: [400, 620, 850], value: g(p => p.lastHits), unit: 'LH' },
  { id: 'artillery', name: 'Artyleria', desc: 'Co najmniej {t} obrażeń bohaterom w jednej grze', scope: 'game', thresholds: [45000, 70000, 100000], value: g(p => p.heroDamage), unit: 'DMG' },
  { id: 'siege', name: 'Taran', desc: 'Co najmniej {t} obrażeń budynkom w jednej grze', scope: 'game', thresholds: [9000, 18000, 30000], value: g(p => p.towerDamage), unit: 'BLD' },
  { id: 'medic', name: 'Medyk', desc: 'Co najmniej {t} wyleczonego zdrowia sojusznikom', scope: 'game', thresholds: [6000, 18000, 40000], value: g(p => p.heroHealing), unit: 'HP' },
  { id: 'rich', name: 'Krezus', desc: 'Wartość netto co najmniej {t} na koniec gry', scope: 'game', thresholds: [30000, 42000, 55000], value: g(p => p.netWorth), unit: 'NW' },
  { id: 'eyes', name: 'Oko na mapie', desc: 'Co najmniej {t} postawionych wardów w jednej grze', scope: 'game', thresholds: [28, 45, 65], value: g(p => p.obsPlaced + p.senPlaced), parsedOnly: true, unit: 'W' },
  { id: 'hunter', name: 'Łowca wardów', desc: 'Co najmniej {t} {zniszczony wrogi ward|zniszczone wrogie wardy|zniszczonych wrogich wardów}', scope: 'game', thresholds: [9, 15, 22], value: g(p => p.observerKills + p.sentryKills), parsedOnly: true },
  { id: 'stacker', name: 'Stacker', desc: 'Co najmniej {t} zestackowanych obozów w jednej grze', scope: 'game', thresholds: [5, 10, 18], value: g(p => p.campsStacked), parsedOnly: true },
  { id: 'runes', name: 'Kolekcjoner run', desc: 'Co najmniej {t} podniesionych run w jednej grze', scope: 'game', thresholds: [11, 18, 28], value: g(p => p.runesPickedUp), parsedOnly: true },
  { id: 'courier', name: 'Poczta nie dojdzie', desc: 'Co najmniej {t} {zabity kurier|zabite kuriery|zabitych kurierów} w jednej grze', scope: 'game', thresholds: [1, 2, 4], value: g(p => p.courierKills), parsedOnly: true },
  { id: 'rosh', name: 'Pogromca Roshana', desc: 'Co najmniej {t} {dobity Roshan|dobite Roshany|dobitych Roshanów} w jednej grze', scope: 'game', thresholds: [1, 2, 4], value: g(p => p.roshanKills), parsedOnly: true },
  { id: 'denier', name: 'Skąpiec', desc: 'Co najmniej {t} denies w jednej grze', scope: 'game', thresholds: [16, 28, 45], value: g(p => p.denies) },
  { id: 'fb', name: 'Pierwsza krew', desc: 'Pierwsza krew zdobyta w co najmniej {t} grach turnieju', scope: 'career', thresholds: [1, 3, 6], value: c(p => p.fbCount) },
  { id: 'winstreak', name: 'Passa', desc: 'Co najmniej {t} wygranych gier z rzędu', scope: 'career', thresholds: [3, 6, 10], value: c(p => p.bestWinStreak) },
  { id: 'pool', name: 'Wszechstronny', desc: 'Co najmniej {t} różnych bohaterów w turnieju', scope: 'career', thresholds: [5, 9, 14], value: c(p => p.heroes.length) },
  { id: 'veteran', name: 'Weteran', desc: 'Co najmniej {t} {rozegrana gra|rozegrane gry|rozegranych gier}', scope: 'career', thresholds: [6, 14, 24], value: c(p => p.games) },
];

export function tierOf(a: Achievement, v: number): Tier | -1 {
  if (v >= a.thresholds[2]) return 2;
  if (v >= a.thresholds[1]) return 1;
  if (v >= a.thresholds[0]) return 0;
  return -1;
}

export interface Unlock {
  player: PlayerX;
  tier: Tier;
  value: number;
  /** The game that unlocked it (game scope) */
  perf?: Perf;
  /** How many games reached ≥ bronze */
  times: number;
}

export interface AchievementState {
  a: Achievement;
  unlocks: Unlock[];
  byTier: [number, number, number];
  /** Best value anyone has reached */
  best: number;
}

export function computeAchievements(model: Model): AchievementState[] {
  return ACHIEVEMENTS.map(a => {
    const unlocks: Unlock[] = [];
    for (const player of model.players) {
      if (a.scope === 'career') {
        const v = a.value({ player });
        const tier = tierOf(a, v);
        if (tier >= 0) unlocks.push({ player, tier: tier as Tier, value: v, times: 1 });
        continue;
      }
      let best: Perf | undefined; let bestV = -Infinity; let times = 0;
      for (const perf of player.perfs) {
        if (a.parsedOnly && !perf.parsed) continue;
        const v = a.value({ perf });
        if (v >= a.thresholds[0]) times++;
        if (v > bestV) { bestV = v; best = perf; }
      }
      const tier = tierOf(a, bestV);
      if (tier >= 0) unlocks.push({ player, tier: tier as Tier, value: bestV, perf: best, times });
    }
    unlocks.sort((x, y) => y.tier - x.tier || y.value - x.value || (x.perf?.game.start ?? 0) - (y.perf?.game.start ?? 0));
    const byTier: [number, number, number] = [0, 0, 0];
    unlocks.forEach(u => { byTier[u.tier]++; });
    const best = a.scope === 'career'
      ? Math.max(0, ...model.players.map(player => a.value({ player })))
      : Math.max(0, ...model.perfs.filter(p => p.player && (!a.parsedOnly || p.parsed)).map(perf => a.value({ perf })));
    return { a, unlocks, byTier, best };
  });
}

/** Achievement points per player: bronze 1, silver 3, gold 6 */
export const TIER_POINTS = [1, 3, 6] as const;

export function collectorRanking(states: AchievementState[]) {
  const map = new Map<string, { player: PlayerX; points: number; tiers: [number, number, number] }>();
  for (const s of states) {
    for (const u of s.unlocks) {
      const e = map.get(u.player.id) ?? { player: u.player, points: 0, tiers: [0, 0, 0] as [number, number, number] };
      e.points += TIER_POINTS[u.tier];
      e.tiers[u.tier]++;
      map.set(u.player.id, e);
    }
  }
  return [...map.values()].sort((a, b) => b.points - a.points || b.tiers[2] - a.tiers[2]);
}

export function fmtThreshold(a: Achievement, tier: Tier): string {
  const t = a.thresholds[tier];
  return t >= 1000 ? `${(t / 1000).toLocaleString('pl-PL')}k` : String(t);
}

/** Description with the three thresholds filled in, e.g. "Co najmniej 15 / 20 / 26 zabójstw" */
export function descOf(a: Achievement): string {
  const last = a.thresholds[2];
  return a.desc
    .replace('{t}', ([0, 1, 2] as Tier[]).map(t => fmtThreshold(a, t)).join(' / '))
    .replace(/\{([^|{}]+)\|([^|{}]+)\|([^|{}]+)\}/, (_, one, few, many) => plural(last, one, few, many));
}
