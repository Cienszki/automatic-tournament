// Card-game prototypes (the /[slug]/card-lab page): one player card per series played, the pack
// rule, and the practice opponent's deck. Pure data, no React.
//
// PROTOTYPE RATING: each series is rated against every series of the same role in this tournament.
// The real system is meant to use a fixed baseline from past tournaments instead (frozen numbers).
import type { Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { pctRank } from '@/lib/stats-lab/derive';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { bestSeries, seasonPeriods } from '@/lib/stats-lab/season';
import { calcPerformanceScore, MIN_SCORED_GAME_MINS } from '@/lib/performance-score';
// Only called at run time (outposts.ts imports from this file too)
import { baseMight } from './outposts';

export const ROLE_KEYS = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
export type RoleKey = typeof ROLE_KEYS[number];
export const POS: Record<RoleKey, number> = { Carry: 1, Mid: 2, Offlane: 3, 'Soft Support': 4, 'Hard Support': 5 };
export const ROLE_SHORT: Record<RoleKey, string> = { Carry: 'Carry', Mid: 'Mid', Offlane: 'Offlane', 'Soft Support': 'Support', 'Hard Support': 'Hard Supp' };

export const ATTRS = [
  { abbr: 'WAL', name: 'Walka', key: 'kda' },
  { abbr: 'FAR', name: 'Farma', key: 'gpm' },
  { abbr: 'ROZ', name: 'Rozwój', key: 'xpm' },
  { abbr: 'OBR', name: 'Obrażenia', key: 'hdpm' },
  { abbr: 'WIZ', name: 'Wizja', key: 'wards' },
  { abbr: 'DRU', name: 'Drużynowość', key: 'kp' },
] as const satisfies ReadonlyArray<{ abbr: string; name: string; key: MetricKey }>;
export type AttrKey = typeof ATTRS[number]['abbr'];

export interface GCard {
  /** `${playerId}:${matchId}`, plus `:totw` for the boosted card */
  id: string;
  pid: string;
  name: string;
  player: PlayerX;
  team?: TeamX;
  role: RoleKey;
  pos: number;
  /** 45–99 */
  ovr: number;
  /** 30–99 */
  attrs: Record<AttrKey, number>;
  /** Hero of the player's best game in the series */
  heroId: number;
  series: { matchId: string; opp?: TeamX; result: string; games: number; start: number; label?: string };
  standin: boolean;
  totw: boolean;
}

/** A team-of-the-week / round card keeps its series' rating and plays +1 stronger (see baseMight) */
export const TOTW_STRENGTH = 1;

export type Tier = 'wood' | 'bronze' | 'silver' | 'gold' | 'elite' | 'totw';
export const TIER: Record<Tier, { label: string; color: string }> = {
  wood: { label: 'Drewniana', color: '#9c7a58' },
  bronze: { label: 'Brązowa', color: '#d6873f' },
  silver: { label: 'Srebrna', color: '#c9d1db' },
  gold: { label: 'Złota', color: '#f2c94c' },
  elite: { label: 'Elitarna', color: '#b072ff' },
  totw: { label: 'Drużyna kolejki', color: '#5ef0ff' },
};
/** Rarity = the strength the card shows (SIŁA): 1–2 wooden, 3–4 bronze, 5–6 silver, 7–8 gold,
 *  9+ elite. Worked out from the card each time, so every card ever issued follows it. */
export function tierOf(c: GCard): Tier {
  if (c.totw) return 'totw';
  const m = baseMight(c);
  return m >= 9 ? 'elite' : m >= 7 ? 'gold' : m >= 5 ? 'silver' : m >= 3 ? 'bronze' : 'wood';
}

interface Raw { pid: string; player: PlayerX; team?: TeamX; role: RoleKey; standin: boolean; perfs: Perf[]; score: number; vals: Record<AttrKey, number> }

/** The role a standin filled: the roster role missing from their team in that game */
function standinRole(p: Perf, model: Model): RoleKey | null {
  const team = p.team ?? model.teamById.get(p.tid);
  if (!team) return null;
  const present = new Set(p.game.perfs.filter(x => x.tid === p.tid).map(x => x.pid));
  const missing = team.players.filter(r => !r.standin && r.role && !present.has(r.id)).map(r => r.role as RoleKey);
  const standins = p.game.perfs.filter(x => x.tid === p.tid && !team.players.some(r => r.id === x.pid && !r.standin));
  const i = standins.indexOf(p);
  return missing[i] ?? missing[0] ?? null;
}

export function buildSeriesCards(model: Model, tournamentType?: string): GCard[] {
  const scoredPerfs = model.perfs.filter(p => Number.isFinite(p.score));
  const avgGameMins = scoredPerfs.length ? scoredPerfs.reduce((a, p) => a + p.min, 0) / scoredPerfs.length : 40;

  // Group every performance into (player, series)
  const groups = new Map<string, Raw>();
  for (const p of model.perfs) {
    if (!p.player) continue;
    const rosterRole = !p.player.standin && p.player.team?.id === p.tid ? p.player.role as RoleKey | undefined : undefined;
    const role = rosterRole ?? standinRole(p, model);
    if (!role || !ROLE_KEYS.includes(role)) continue;
    const k = `${p.pid}:${p.game.matchId}`;
    if (!groups.has(k)) groups.set(k, { pid: p.pid, player: p.player, team: p.team ?? model.teamById.get(p.tid), role, standin: !rosterRole, perfs: [], score: 0, vals: {} as Raw['vals'] });
    groups.get(k)!.perfs.push(p);
  }
  for (const g of groups.values()) {
    const long = g.perfs.filter(p => p.min >= MIN_SCORED_GAME_MINS);
    const use = long.length ? long : g.perfs;
    g.score = use.reduce((a, p) => a + calcPerformanceScore(g.role, { ...p, firstBloodClaimed: p.firstBloodClaimed > 0 }, p.min, avgGameMins).total, 0) / use.length;
    for (const a of ATTRS) g.vals[a.abbr] = use.reduce((s, p) => s + metric(a.key).get(p), 0) / use.length;
  }

  // Percentiles within the role
  const byRole = new Map<RoleKey, Raw[]>();
  for (const g of groups.values()) byRole.set(g.role, [...(byRole.get(g.role) ?? []), g]);
  const cards: GCard[] = [];
  for (const [, list] of byRole) {
    const scores = list.map(g => g.score);
    const pools = Object.fromEntries(ATTRS.map(a => [a.abbr, list.map(g => g.vals[a.abbr])])) as Record<AttrKey, number[]>;
    for (const g of list) {
      const f = g.perfs[0]; const game = f.game; const m = game.match;
      const result = m?.teamA === f.tid ? `${m.scoreA}:${m.scoreB}` : m?.teamB === f.tid ? `${m.scoreB}:${m.scoreA}`
        : `${g.perfs.filter(x => x.win).length}:${g.perfs.filter(x => !x.win).length}`;
      const best = [...g.perfs].sort((a, b) => (b.kills + b.assists - b.deaths) - (a.kills + a.assists - a.deaths))[0];
      cards.push({
        id: `${g.pid}:${game.matchId}`, pid: g.pid, name: g.player.name, player: g.player, team: g.team, role: g.role, pos: POS[g.role],
        ovr: Math.round(45 + 54 * pctRank(scores, g.score)),
        attrs: Object.fromEntries(ATTRS.map(a => [a.abbr, Math.round(30 + 69 * pctRank(pools[a.abbr], g.vals[a.abbr]))])) as GCard['attrs'],
        heroId: best.heroId,
        series: { matchId: game.matchId, opp: game.radiant === f.tid ? game.direTeam : game.radiantTeam, result, games: g.perfs.length, start: Math.min(...g.perfs.map(x => x.game.start)) },
        standin: g.standin, totw: false,
      });
    }
  }

  // Team of the week / round: the best series of each role in each period gets a boosted twin
  const periods = seasonPeriods(model, tournamentType);
  const byId = new Map(cards.map(c => [c.id, c]));
  for (const per of periods.list) {
    const top = new Map<string, string>();
    for (const e of bestSeries(per.perfs)) if (e.player.role && !top.has(e.player.role)) top.set(e.player.role, `${e.player.id}:${e.perfs[0].game.matchId}`);
    for (const id of top.values()) {
      const c = byId.get(id);
      if (!c) continue;
      c.series.label = per.label;
      cards.push({ ...c, id: `${c.id}:totw`, totw: true });
    }
  }
  return cards.sort((a, b) => a.series.start - b.series.start);
}

// ── Packs (the agreed rule) ───────────────────────────────────────────────

/** Chance that a pack slot gives the player's current TOTW card instead of the regular one (balance: later) */
export const TOTW_CHANCE = 0.25;

/** Cards packs can give now: per role, each team's LAST series (whoever played that role in it) */
export function packPool(cards: GCard[]): Map<RoleKey, Array<{ base: GCard; totw?: GCard }>> {
  const last = new Map<string, { matchId: string; start: number }>();
  for (const c of cards) {
    if (!c.team) continue;
    const l = last.get(c.team.id);
    if (!l || c.series.start > l.start) last.set(c.team.id, { matchId: c.series.matchId, start: c.series.start });
  }
  const totwOf = new Map(cards.filter(c => c.totw).map(c => [c.id.replace(/:totw$/, ''), c]));
  const pool = new Map<RoleKey, Array<{ base: GCard; totw?: GCard }>>(ROLE_KEYS.map(r => [r, []]));
  for (const c of cards) {
    if (c.totw || !c.team || last.get(c.team.id)?.matchId !== c.series.matchId) continue;
    pool.get(c.role)!.push({ base: c, totw: totwOf.get(c.id) });
  }
  return pool;
}

/** How likely each card is next to a wooden one (per card, not per rarity: a rarity only a couple
 *  of cards have would otherwise hand those few out all the time). Sim on real seasons: ~40 packs
 *  give 4.5–5.5 elite cards in a deck, no card is more than ~11 % of its position's draws. */
export const RARITY_WEIGHT: Record<Exclude<Tier, 'totw'>, number> = { wood: 1, bronze: 0.95, silver: 0.9, gold: 0.8, elite: 0.65 };
const weightOf = (c: GCard) => RARITY_WEIGHT[tierOf({ ...c, totw: false }) as keyof typeof RARITY_WEIGHT];

/** One pack: a card for each role — a random team's last series, better cards a bit less likely */
export function openPack(pool: ReturnType<typeof packPool>, rnd = Math.random): GCard[] {
  const out: GCard[] = [];
  for (const r of ROLE_KEYS) {
    const list = pool.get(r)!;
    if (!list.length) continue;
    let x = rnd() * list.reduce((a, e) => a + weightOf(e.base), 0);
    const e = list.find(c => (x -= weightOf(c.base)) <= 0) ?? list[list.length - 1];
    out.push(e.totw && rnd() < TOTW_CHANCE ? e.totw : e.base);
  }
  return out;
}

/** A simulated collection: `packs` packs opened by the rule (duplicates kept) */
export function simCollection(cards: GCard[], packs: number, rnd = Math.random): GCard[] {
  const pool = packPool(cards);
  return Array.from({ length: packs }, () => openPack(pool, rnd)).flat();
}

// ── Decks ─────────────────────────────────────────────────────────────────

export interface DeckRule {
  size: number;
  /** Minimum cards per role */
  perRole: number;
  /** Plain-language summary for the deck screen */
  text: string;
}

/** Rating with the team-of-the-round bonus counted in (+1 strength ≈ +7 rating), for matching deck strength */
const rating = (c: GCard) => c.ovr + (c.totw ? 7 : 0);
export const avgOvr = (d: GCard[]) => (d.length ? d.reduce((s, c) => s + rating(c), 0) / d.length : 0);
/** Strongest first (what the card hits for in the game), then by rating */
export const byStrength = (a: GCard, b: GCard) => baseMight(b) - baseMight(a) || b.ovr - a.ovr;

/** One card per player and team: a player who also stood in for another team may bring a card from each */
export const deckKey = (c: { pid: string; team?: { id: string } | null }) => `${c.pid}|${c.team?.id ?? ''}`;
export const ONE_PER_PLAYER = 'Każdy gracz może być w talii raz z każdej drużyny';

/** Why a deck is not legal (null = fine). One card per player and team. */
export function deckProblem(deck: GCard[], rule: DeckRule): string | null {
  if (deck.length !== rule.size) return `Talia musi mieć ${rule.size} kart (masz ${deck.length})`;
  if (new Set(deck.map(deckKey)).size !== deck.length) return ONE_PER_PLAYER;
  for (const r of ROLE_KEYS) if (deck.filter(c => c.role === r).length < rule.perRole) return `Potrzeba co najmniej ${rule.perRole} kart na pozycji ${ROLE_SHORT[r]}`;
  return null;
}

/** The strongest legal deck from a collection (greedy: role minimums first, then best rated) */
export function autoDeck(collection: GCard[], rule: DeckRule): GCard[] {
  // One card per player and team: the best one (a Map keeps the last value set, so best goes in last)
  const uniq = [...new Map([...collection].sort((a, b) => byStrength(b, a)).map(c => [deckKey(c), c])).values()].sort(byStrength);
  const deck: GCard[] = [];
  for (const r of ROLE_KEYS) deck.push(...uniq.filter(c => c.role === r).slice(0, rule.perRole));
  for (const c of uniq) if (deck.length < rule.size && !deck.includes(c)) deck.push(c);
  return deck.slice(0, rule.size);
}

/**
 * The practice opponent's deck: random cards from the whole tournament (never someone's real
 * deck), nudged until its average rating is within ~1.5 of the player's.
 */
export function cpuDeck(all: GCard[], rule: DeckRule, target: number, avoid: Set<string>, rnd = Math.random): GCard[] {
  const pool = all.filter(c => !avoid.has(c.pid));
  const pick = (list: GCard[]) => list[Math.floor(rnd() * list.length)];
  const deck: GCard[] = [];
  const has = (c: GCard) => deck.some(d => d.pid === c.pid);
  for (const r of ROLE_KEYS) for (let i = 0; i < rule.perRole; i++) { const c = pick(pool.filter(x => x.role === r && !has(x))); if (c) deck.push(c); }
  while (deck.length < rule.size) { const c = pick(pool.filter(x => !has(x))); if (!c) break; deck.push(c); }
  for (let i = 0; i < 400 && Math.abs(avgOvr(deck) - target) > 1.5; i++) {
    const j = Math.floor(rnd() * deck.length);
    const old = deck[j];
    const cand = pick(pool.filter(x => x.role === old.role && !has(x)));
    if (!cand) continue;
    const before = Math.abs(avgOvr(deck) - target);
    deck[j] = cand;
    if (Math.abs(avgOvr(deck) - target) > before) deck[j] = old;
  }
  return deck;
}

export function shuffle<T>(a: T[], rnd = Math.random): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
