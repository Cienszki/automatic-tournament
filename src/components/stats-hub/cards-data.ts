// The card game's card set, built from the season's data: a FUT-style card for every player and
// team, "moment" cards for the season's best facts (and its roasts), and secret cards that only
// exist when something rare happened. Plus pack odds and the collection format. Pure data.
import type { Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { pctRank, topPerfs } from '@/lib/stats-lab/derive';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { eloTable, buildFacts, type Fact } from '@/lib/stats-lab/teasers';
import { heroName } from '@/lib/stats-lab/heroes';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'cursed' | 'mythic';

export const RARITY: Record<Rarity, { label: string; color: string; order: number }> = {
  common: { label: 'Brązowa', color: '#c98a55', order: 0 },
  rare: { label: 'Srebrna', color: '#c9d1db', order: 1 },
  epic: { label: 'Złota', color: '#f2c94c', order: 2 },
  legendary: { label: 'Legendarna', color: '#b072ff', order: 3 },
  cursed: { label: 'Przeklęta', color: '#ff8a3d', order: 4 },
  mythic: { label: 'Mityczna', color: '#5ef0ff', order: 5 },
};
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'cursed', 'mythic'];

export interface Attr { abbr: string; name: string; desc: string; score: number; shown: string }

interface CardBase { id: string; rarity: Rarity; name: string; heroId?: number }
export interface PlayerCard extends CardBase { kind: 'player'; player: PlayerX; ovr: number; attrs: Attr[]; records: MetricKey[] }
export interface TeamCard extends CardBase { kind: 'team'; team: TeamX; ovr: number; elo: number; attrs: Attr[] }
export interface MomentCard extends CardBase { kind: 'moment'; fact: Fact }
export interface SecretCard extends CardBase {
  kind: 'secret';
  /** What the album hints before it is found */
  hint: string;
  title: string;
  big: string;
  sub: string;
  player?: PlayerX;
  team?: TeamX;
}
export type Card = PlayerCard | TeamCard | MomentCard | SecretCard;

/** Ratings run 45–99 on a percentile, so this is roughly 42% bronze, 30% silver, 20% gold, 8% legendary */
const tierOf = (ovr: number): Rarity => (ovr >= 95 ? 'legendary' : ovr >= 84 ? 'epic' : ovr >= 68 ? 'rare' : 'common');

/** Player attributes: per-game averages as percentiles among regulars (30–99, like FUT) */
const P_ATTRS: Array<{ key: MetricKey; abbr: string; name: string }> = [
  { key: 'kda', abbr: 'WAL', name: 'Walka' },
  { key: 'gpm', abbr: 'FAR', name: 'Farma' },
  { key: 'xpm', abbr: 'ROZ', name: 'Rozwój' },
  { key: 'hdpm', abbr: 'OBR', name: 'Obrażenia' },
  { key: 'wards', abbr: 'WIZ', name: 'Wizja' },
  { key: 'kp', abbr: 'DRU', name: 'Drużynowość' },
];

/** The attribute names a duel can be played on (player cards) */
export const DUEL_ATTRS = P_ATTRS.map(a => ({ abbr: a.abbr, name: a.name }));

const T_ATTRS: Array<{ abbr: string; name: string; desc: string; get: (t: TeamX) => number | null; low?: boolean; fmt: (v: number) => string }> = [
  { abbr: 'WAL', name: 'Walka', desc: 'Zabójstwa na grę', get: t => t.avg.kills, fmt: v => v.toFixed(1) },
  { abbr: 'FAR', name: 'Farma', desc: 'Suma GPM drużyny', get: t => t.avg.gpm, fmt: v => Math.round(v).toString() },
  { abbr: 'WIZ', name: 'Wizja', desc: 'Postawione wardy na grę', get: t => t.avg.wards || null, fmt: v => v.toFixed(1) },
  { abbr: 'CEL', name: 'Cele', desc: 'Obrażenia budynkom na grę', get: t => t.avg.towerDamage, fmt: v => `${(v / 1000).toFixed(1)}k` },
  { abbr: 'PRZ', name: 'Przetrwanie', desc: 'Śmierci na grę — mniej znaczy lepiej', get: t => t.avg.deaths, low: true, fmt: v => v.toFixed(1) },
  { abbr: 'TEM', name: 'Tempo', desc: 'Średni czas wygranej — szybciej znaczy lepiej', get: t => t.avg.winDuration, low: true, fmt: v => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` },
];

const EPIC_FACTS = new Set(['mvp', 'collector', 'elo', 'streak', 'race', 'hero', 'duo']);

export function buildCards(model: Model): Card[] {
  const cards: Card[] = [];

  // ── Players ────────────────────────────────────────────────────────
  const regulars = model.players.filter(p => p.games >= model.minGames);
  const scorePool = regulars.map(p => p.agg.score.avg ?? 0);
  const pools = Object.fromEntries(P_ATTRS.map(a => [a.key, regulars.map(p => p.agg[a.key].avg ?? 0)]));
  const recordKeys: MetricKey[] = ['kills', 'assists', 'kda', 'gpm', 'xpm', 'lastHits', 'heroDamage', 'towerDamage', 'wards', 'dewards', 'stacks', 'heroHealing', 'netWorth', 'score'];
  const holders = new Map<string, MetricKey[]>();
  for (const k of recordKeys) {
    const rec = topPerfs(model, k, 1)[0];
    if (rec?.player) holders.set(rec.pid, [...(holders.get(rec.pid) ?? []), k]);
  }
  for (const p of model.players) {
    if (p.games < 2) continue;
    const attrs: Attr[] = P_ATTRS.map(a => {
      const m = metric(a.key); const raw = p.agg[a.key].avg ?? 0;
      return { abbr: a.abbr, name: a.name, desc: m.desc, score: Math.round(30 + 69 * pctRank(pools[a.key], raw)), shown: a.key === 'kp' ? m.fmt(raw) : raw.toFixed(m.avgDigits) };
    });
    const ovr = p.agg.score.avg != null && scorePool.length
      ? Math.round(45 + 54 * pctRank(scorePool, p.agg.score.avg))
      : Math.round(attrs.reduce((s, a) => s + a.score, 0) / attrs.length);
    // Few games → the rating is shaky; such cards stay bronze whatever the number says
    const rarity = p.games < model.minGames ? 'common' : tierOf(ovr);
    cards.push({ id: `p:${p.id}`, kind: 'player', rarity, name: p.name, heroId: p.heroes[0]?.heroId, player: p, ovr, attrs, records: holders.get(p.id) ?? [] });
  }

  // ── Teams ──────────────────────────────────────────────────────────
  const elo = eloTable(model);
  const eloOf = new Map(elo.map(e => [e.t.id, e.v]));
  const teams = model.teams.filter(t => t.games.length >= 2);
  for (const t of teams) {
    const attrs: Attr[] = T_ATTRS.map(a => {
      const pool = teams.map(a.get).filter((v): v is number => v != null);
      const raw = a.get(t);
      const pr = raw == null ? 0 : pctRank(pool, raw);
      return { abbr: a.abbr, name: a.name, desc: a.desc, score: raw == null ? 30 : Math.round(30 + 69 * (a.low ? 1 - pr : pr)), shown: raw == null ? '–' : a.fmt(raw) };
    });
    const e = eloOf.get(t.id) ?? 1500;
    const ovr = Math.round(45 + 54 * pctRank([...eloOf.values()], e));
    cards.push({ id: `t:${t.id}`, kind: 'team', rarity: tierOf(ovr), name: t.name, heroId: t.heroPicks[0]?.heroId, team: t, ovr, elo: e, attrs });
  }

  // ── Season moments ─────────────────────────────────────────────────
  for (const f of buildFacts(model)) {
    const rarity: Rarity = f.tone === 'roast' ? 'cursed' : f.id.startsWith('rec-') ? 'epic' : EPIC_FACTS.has(f.id) ? 'legendary' : 'rare';
    cards.push({ id: `m:${f.id}`, kind: 'moment', rarity, name: f.kicker, heroId: f.heroId, fact: f });
  }

  // ── Secrets: only exist when the rare thing happened ───────────────
  const secret = (c: Omit<SecretCard, 'kind' | 'rarity'>) => cards.push({ ...c, kind: 'secret', rarity: 'mythic' });
  const line = (p: Perf) => `${heroName(p.heroId)} · ${p.kills}/${p.deaths}/${p.assists}`;
  const rampage = model.perfs.filter(p => p.rampages > 0 && p.player).sort((a, b) => a.game.start - b.game.start)[0];
  if (rampage) secret({ id: 's:rampage', name: 'RAMPAGE!', hint: 'Pięć zabójstw, jedna walka…', title: rampage.player!.name, big: 'RAMPAGE', sub: `pierwsza w sezonie · ${line(rampage)}`, heroId: rampage.heroId, player: rampage.player, team: rampage.team });
  const immortal = model.perfs.filter(p => p.player && p.deaths === 0 && p.min >= 25).sort((a, b) => b.kills + b.assists - (a.kills + a.assists))[0];
  if (immortal) secret({ id: 's:immortal', name: 'Aegis', hint: 'Ktoś przeszedł całą grę i nikt go nie dotknął.', title: immortal.player!.name, big: `${immortal.kills}/0/${immortal.assists}`, sub: `cała gra bez śmierci · ${heroName(immortal.heroId)}`, heroId: immortal.heroId, player: immortal.player, team: immortal.team });
  const courier = model.perfs.filter(p => p.player && p.courierKills > 0).sort((a, b) => b.courierKills - a.courierKills)[0];
  if (courier) secret({ id: 's:courier', name: 'Poczta nie dojdzie', hint: 'Nawet osiołek nie jest bezpieczny.', title: courier.player!.name, big: `${courier.courierKills}×`, sub: `zabite kuriery w jednej grze · ${heroName(courier.heroId)}`, heroId: courier.heroId, player: courier.player, team: courier.team });
  const roshPerf = model.perfs.filter(p => p.player && p.roshanKills > 0).sort((a, b) => b.roshanKills - a.roshanKills)[0];
  if (roshPerf && roshPerf.roshanKills >= 2) secret({ id: 's:roshan', name: 'Pogromca Roshana', hint: 'Jaskinia w rzece zna to imię.', title: roshPerf.player!.name, big: `${roshPerf.roshanKills}×`, sub: `Roshan dobity w jednej grze · ${heroName(roshPerf.heroId)}`, heroId: roshPerf.heroId, player: roshPerf.player, team: roshPerf.team });
  const once = model.heroes.filter(h => h.picks === 1 && h.wins === 1).sort((a, b) => (b.perfs[0]?.kills ?? 0) - (a.perfs[0]?.kills ?? 0))[0];
  const onceP = once?.perfs[0];
  if (once && onceP?.player) secret({ id: 's:once', name: 'Jeden strzał', hint: 'Wybrany raz w całym sezonie. I wystarczyło.', title: heroName(once.heroId), big: '1/1', sub: `jedyny pick sezonu — i wygrana · zagrał ${onceP.player.name}`, heroId: once.heroId, player: onceP.player, team: onceP.team });
  const longest = [...model.games].sort((a, b) => b.duration - a.duration)[0];
  if (longest && longest.duration >= 60 * 60) {
    const w = longest.radiantWin ? longest.radiantTeam : longest.direTeam;
    secret({ id: 's:marathon', name: 'Maraton', hint: 'Gra, po której wszyscy poszli spać.', title: w?.name ?? '', big: `${Math.floor(longest.duration / 60)} min`, sub: `najdłuższa gra sezonu — wygrali ją`, heroId: longest.mvp?.heroId, team: w });
  }
  return cards;
}

// ── Packs ────────────────────────────────────────────────────────────────

export const PACK_SIZE = 5;
/** Odds per slot; the last slot is the "rare slot" */
const SLOT_ODDS: Array<Partial<Record<Rarity, number>>> = [
  { common: 62, rare: 30, epic: 6, cursed: 1.5, mythic: 0.5 },
  { common: 62, rare: 30, epic: 6, cursed: 1.5, mythic: 0.5 },
  { common: 45, rare: 40, epic: 12, cursed: 2.5, mythic: 0.5 },
  { rare: 55, epic: 33, legendary: 8, cursed: 3, mythic: 1 },
  { epic: 55, legendary: 33, cursed: 8, mythic: 4 },
];
/** A card can drop as a shiny foil — collected separately, purely for bragging */
export const FOIL_CHANCE = 1 / 30;

export interface Pull { card: Card; foil: boolean; isNew: boolean }

function pickWeighted<T extends string>(odds: Partial<Record<T, number>>, rnd: () => number): T {
  const entries = Object.entries(odds) as Array<[T, number]>;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = rnd() * total;
  for (const [k, w] of entries) { x -= w; if (x <= 0) return k; }
  return entries[entries.length - 1][0];
}

/**
 * Five cards: each slot rolls a rarity (falling back to the nearest rarity that exists), then a
 * card of it — preferring ones the collector does not have yet. `luck` forces the rare slot to
 * mythic (the secret code).
 */
export function openPack(cards: Card[], owned: Set<string>, rnd: () => number = Math.random, luck = false): Pull[] {
  const byRarity = new Map<Rarity, Card[]>(RARITIES.map(r => [r, cards.filter(c => c.rarity === r)]));
  const fallback: Record<Rarity, Rarity[]> = {
    mythic: ['legendary', 'epic'], cursed: ['epic', 'rare'], legendary: ['epic', 'rare'], epic: ['rare', 'legendary'], rare: ['common', 'epic'], common: ['rare'],
  };
  const out: Pull[] = [];
  const taken = new Set<string>();
  SLOT_ODDS.forEach((odds, i) => {
    let r: Rarity = luck && i === SLOT_ODDS.length - 1 ? 'mythic' : pickWeighted(odds, rnd);
    if (!byRarity.get(r)?.length) r = fallback[r].find(x => byRarity.get(x)?.length) ?? 'common';
    const pool = (byRarity.get(r) ?? cards).filter(c => !taken.has(c.id));
    const fresh = pool.filter(c => !owned.has(c.id));
    const src = fresh.length && rnd() < 0.7 ? fresh : pool;
    const card = src[Math.floor(rnd() * src.length)] ?? cards[Math.floor(rnd() * cards.length)];
    if (!card) return;
    taken.add(card.id);
    out.push({ card, foil: rnd() < FOIL_CHANCE, isNew: !owned.has(card.id) });
  });
  return out.sort((a, b) => RARITY[a.card.rarity].order - RARITY[b.card.rarity].order);
}

// ── Saved collection ─────────────────────────────────────────────────────

export interface Collection {
  /** card id → copies */
  owned: Record<string, number>;
  /** card ids pulled as foil at least once */
  foils: string[];
  /** packs waiting to be opened */
  packs: number;
  /** last time a free pack was granted (ms) */
  lastRefill: number;
  opened: number;
  duels: { won: number; lost: number; streak: number; best: number };
  secretCode?: boolean;
}

export const STARTER_PACKS = 3;
export const PACK_EVERY_MS = 30 * 60 * 1000;
export const MAX_STORED_PACKS = 5;

export const emptyCollection = (): Collection => ({ owned: {}, foils: [], packs: STARTER_PACKS, lastRefill: Date.now(), opened: 0, duels: { won: 0, lost: 0, streak: 0, best: 0 } });

/** Free packs that accumulated since the last visit (one per PACK_EVERY_MS, up to the cap) */
export function refill(c: Collection, now = Date.now()): Collection {
  if (c.packs >= MAX_STORED_PACKS) return { ...c, lastRefill: now };
  const n = Math.floor((now - c.lastRefill) / PACK_EVERY_MS);
  if (n <= 0) return c;
  return { ...c, packs: Math.min(MAX_STORED_PACKS, c.packs + n), lastRefill: c.lastRefill + n * PACK_EVERY_MS };
}

export const cardsKey = (statsKey: string) => `stats-hub:${statsKey}:cards`;
