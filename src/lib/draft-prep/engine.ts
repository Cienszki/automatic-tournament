// Draft preparation engine — pure data, no React. Turns three histories per player (this
// tournament, league lobbies on OpenDota, public games on OpenDota) into hero pools with
// relevance weights, predicts what the opponents pick, in which order and on which player,
// and scores every pick and ban for "us" at any step of a Captains Mode draft.
//
// Relevance is per player: every game is weighted by its source (tournament > league lobby >
// public), how recent it is, whether it is on the current patch and — for public games — whether
// the player played their tournament role there. A source's say grows with the evidence it has,
// so a player with 3 tournament games and 400 recent pubs is read mostly from pubs, and one with
// 30 league lobbies mostly from those.

import type { Model } from '@/lib/stats-lab/derive';
import { getHeroData } from '@/lib/hero-mapping';
import type { DpHistory, DpMeta } from './types';
import { count } from '@/lib/plural';

// ── Draft order ─────────────────────────────────────────────────────────────

export interface DraftStep { pick: boolean; first: boolean }
/**
 * Captains Mode order as shown in the game client (A = the starting team):
 *  1-7   bans  A A B B A B B
 *  8-9   picks A B
 *  10-12 bans  A A B
 *  13-18 picks B A A B B A
 *  19-22 bans  A B A B
 *  23-24 picks A B
 */
const CM_ORDER = 'bAbAbBbBbAbBbB' + 'PAPB' + 'bAbAbB' + 'PBPAPAPBPBPA' + 'bAbBbAbB' + 'PAPB';

export function draftOrder(): DraftStep[] {
  const out: DraftStep[] = [];
  for (let i = 0; i < CM_ORDER.length; i += 2) out.push({ pick: CM_ORDER[i] === 'P', first: CM_ORDER[i + 1] === 'A' });
  return out;
}

// ── Roles ───────────────────────────────────────────────────────────────────

export const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
export const ROLE_SHORT: Record<string, string> = { Carry: '1', Mid: '2', Offlane: '3', 'Soft Support': '4', 'Hard Support': '5' };

/** 0..1 — how well a hero suits a position, from its Dota roles and from who plays it in the league */
export function makeRoleFit(model: Model | null) {
  const played = new Map<number, Map<string, number>>();
  for (const p of model?.perfs ?? []) {
    const role = p.player?.role; if (!role || !p.heroId) continue;
    const m = played.get(p.heroId) ?? new Map(); m.set(role, (m.get(role) ?? 0) + 1); played.set(p.heroId, m);
  }
  const cache = new Map<string, number>();
  return (hero: number, role?: string): number => {
    if (!role) return 0.6;
    const key = `${hero}|${role}`; const hit = cache.get(key); if (hit != null) return hit;
    const roles = getHeroData(hero)?.roles ?? [];
    const has = (r: string) => roles.includes(r);
    const sup = has('Support');
    let base: number;
    if (role === 'Carry') base = has('Carry') ? 1 : sup ? 0.08 : 0.3;
    else if (role === 'Mid') base = (has('Nuker') || has('Carry') || has('Escape')) && !(sup && !has('Nuker')) ? 0.85 : sup ? 0.25 : 0.5;
    else if (role === 'Offlane') base = has('Initiator') || has('Durable') ? 0.9 : has('Carry') ? 0.45 : sup ? 0.3 : 0.5;
    else base = sup ? 1 : has('Disabler') ? 0.55 : 0.15;
    const m = played.get(hero); let fit = base;
    if (m) {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      const share = (m.get(role) ?? 0) / total;
      const w = total / (total + 6); // trust league usage as it accumulates
      fit = (1 - w) * base + w * Math.min(1, share * 2.2);
    }
    cache.set(key, fit);
    return fit;
  };
}
export type RoleFit = ReturnType<typeof makeRoleFit>;

// ── Player profiles ─────────────────────────────────────────────────────────

export type Source = 'T' | 'L' | 'P';
export type Window = 'all' | '6m' | '3m' | 'patch';
export const SOURCES: Source[] = ['T', 'L', 'P'];
export const WINDOWS: Window[] = ['all', '6m', '3m', 'patch'];
export const SOURCE_LABEL: Record<Source, string> = { T: 'Turniej', L: 'Ligi / lobby', P: 'Publiki' };
export const WINDOW_LABEL: Record<Window, string> = { all: 'Całość', '6m': '6 mies.', '3m': '3 mies.', patch: 'Patch' };

const RELIABILITY: Record<Source, number> = { T: 1, L: 0.75, P: 0.32 };
const HALF_LIFE_DAYS = 90;

export interface Cell { g: number; w: number }
export interface HeroStat {
  hero: number;
  cells: Record<Source, Record<Window, Cell>>;
  /** Evidence-weighted games / wins over all sources (relevance applied) */
  wg: number; ww: number;
  last: number;
  /** Lane roles seen in parsed public / lobby games: [safe, mid, off, jungle] */
  lanes: [number, number, number, number];
  /** Tournament picks of this hero by this player: their team's pick number (0-4) */
  slots: number[];
  /** Games per position 1-5 (STRATZ; tournament games use the roster role) */
  pos: [number, number, number, number, number];
}

export interface Profile {
  key: string;
  sid32: string;
  sid64: string;
  name: string;
  role?: string;
  heroes: Map<number, HeroStat>;
  /** How much each source counts for this player (sums to 1) */
  share: Record<Source, number>;
  /** Weighted games per source (recency + patch) and raw totals */
  evidence: Record<Source, number>;
  totals: Record<Source, Record<Window, Cell>>;
  /** Share of public games played at (or on heroes fitting) the player's tournament role */
  pubRoleFit: number;
  /** Games per position across non-tournament sources, when STRATZ knows it */
  posGames: [number, number, number, number, number];
  why: string[];
  rankTier?: number;
}

const emptyCells = (): Record<Source, Record<Window, Cell>> =>
  Object.fromEntries(SOURCES.map(s => [s, Object.fromEntries(WINDOWS.map(w => [w, { g: 0, w: 0 }]))])) as Record<Source, Record<Window, Cell>>;

export interface PlayerInput { key: string; sid32: string; sid64: string; name: string; role?: string }

export function buildProfile(input: PlayerInput, model: Model | null, history: DpHistory | undefined, meta: DpMeta | null, fit: RoleFit, now = Date.now() / 1000): Profile {
  const patchStart = meta?.patches[meta.patches.length - 1]?.start ?? now - 90 * 86400;
  const tourIds = new Set((model?.games ?? []).map(g => g.id));
  const heroes = new Map<number, HeroStat>();
  const totals = emptyCells();
  const evidence: Record<Source, number> = { T: 0, L: 0, P: 0 };
  let pubFitW = 0; let pubW = 0;
  const stat = (h: number) => { let s = heroes.get(h); if (!s) { s = { hero: h, cells: emptyCells(), wg: 0, ww: 0, last: 0, lanes: [0, 0, 0, 0], slots: [], pos: [0, 0, 0, 0, 0] }; heroes.set(h, s); } return s; };
  const rolePos = input.role ? ROLES.indexOf(input.role as typeof ROLES[number]) + 1 : 0;
  const posGames: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const raw: Array<{ s: Source; hero: number; win: boolean; t: number; w: number }> = [];

  const add = (s: Source, hero: number, win: boolean, t: number, lane = 0, pos = 0) => {
    const age = Math.max(0, (now - t) / 86400);
    const st = stat(hero);
    const wins = (cell: Cell) => { cell.g++; if (win) cell.w++; };
    const windows: Window[] = ['all'];
    if (age <= 182) windows.push('6m');
    if (age <= 91) windows.push('3m');
    if (t >= patchStart) windows.push('patch');
    for (const w of windows) { wins(st.cells[s][w]); wins(totals[s][w]); }
    st.last = Math.max(st.last, t);
    if (lane >= 1 && lane <= 4) st.lanes[lane - 1]++;
    if (pos >= 1 && pos <= 5) { st.pos[pos - 1]++; if (s !== 'T') posGames[pos - 1]++; }
    let weight = Math.pow(0.5, age / HALF_LIFE_DAYS) * (t >= patchStart ? 1.5 : 1);
    // in the draft they play their tournament position: games elsewhere say less about their picks
    if (s !== 'T' && rolePos && pos) weight *= pos === rolePos ? 1 : 0.35;
    if (s === 'P') { const f = rolePos && pos ? (pos === rolePos ? 1 : 0) : fit(hero, input.role); pubFitW += weight * f; pubW += weight; }
    evidence[s] += weight;
    raw.push({ s, hero, win, t, w: weight });
  };

  // Tournament games (with the pick number inside the team's draft)
  for (const p of model?.perfs ?? []) {
    if (p.pid !== input.sid64 || !p.heroId) continue;
    add('T', p.heroId, p.win, p.game.start, 0, rolePos);
    const side = p.radiant ? 0 : 1;
    const picks = [...p.game.pb].filter(x => x[1] && x[2] === side).sort((a, b) => a[3] - b[3]);
    const k = picks.findIndex(x => x[0] === p.heroId);
    if (k >= 0) stat(p.heroId).slots.push(k);
  }
  for (const r of history?.rows ?? []) {
    if (tourIds.has(String(r[0]))) continue;
    add(r[4] === 1 ? 'L' : 'P', r[2], r[3] === 1, r[1], r[5], r[6] ?? 0);
  }

  // How much each source counts: reliability × role consistency × saturating evidence
  const pubRoleFit = pubW ? pubFitW / pubW : 0.5;
  const rawShare: Record<Source, number> = {
    T: RELIABILITY.T * (1 - Math.exp(-evidence.T / 4)),
    L: RELIABILITY.L * (1 - Math.exp(-evidence.L / 6)),
    P: RELIABILITY.P * (0.35 + 0.65 * pubRoleFit) * (1 - Math.exp(-evidence.P / 12)),
  };
  const sum = rawShare.T + rawShare.L + rawShare.P;
  const share: Record<Source, number> = sum ? { T: rawShare.T / sum, L: rawShare.L / sum, P: rawShare.P / sum } : { T: 0, L: 0, P: 0 };

  for (const x of raw) {
    const st = heroes.get(x.hero)!;
    const k = evidence[x.s] ? (share[x.s] / evidence[x.s]) * 20 : 0; // normalise so a source's games sum to share×20
    st.wg += x.w * k; if (x.win) st.ww += x.w * k;
  }

  const why: string[] = [];
  const tg = totals.T.all.g; const lg = totals.L['6m'].g; const pg = totals.P['3m'].g;
  if (!tg && !totals.L.all.g && !totals.P.all.g) why.push('Brak danych — przewidywania opierają się na roli i mecie.');
  else {
    const top = (Object.entries(share) as Array<[Source, number]>).sort((a, b) => b[1] - a[1])[0];
    why.push(`Najwięcej mówią: ${SOURCE_LABEL[top[0]].toLowerCase()} (${Math.round(top[1] * 100)}% wagi).`);
    if (tg > 0 && tg < 6) why.push(`Tylko ${count(tg, 'gra', 'gry', 'gier')} w turnieju — za mało, by na nich polegać.`);
    if (tg >= 6) why.push(`${count(tg, 'gra', 'gry', 'gier')} w turnieju — wiarygodna próbka.`);
    if (lg >= 5) why.push(`${count(lg, 'gra', 'gry', 'gier')} w lobby ligowych w ostatnich 6 miesiącach.`);
    const knownPos = posGames.reduce((a, b) => a + b, 0) >= 15 && !!rolePos;
    if (pg >= 20 && pubRoleFit < 0.5 && !knownPos) why.push(`W publikach gra głównie inne role (${Math.round(pubRoleFit * 100)}% gier pasuje do roli ${input.role ?? '?'}) — publiki ważą mniej.`);
    else if (pg >= 20) why.push(`${count(pg, 'publik', 'publiki', 'publików')} w 3 miesiące — aktualna forma i pula.`);
    if (pg < 5 && totals.P.all.g > 50) why.push('Ostatnio prawie nie gra publików — starsze gry ważą mniej.');
    const known = posGames.reduce((a, b) => a + b, 0);
    if (known >= 15 && rolePos) {
      const main = posGames.indexOf(Math.max(...posGames)) + 1;
      const atRole = posGames[rolePos - 1] / known;
      why.push(main === rolePos && atRole >= 0.5 ? `Poza turniejem też gra głównie pozycję ${rolePos} (${Math.round(atRole * 100)}% gier) — te gry ważą najwięcej.` : main === rolePos ? `Poza turniejem gra różne pozycje — swoją ${rolePos} w ${Math.round(atRole * 100)}% gier; gry na innych pozycjach ważą ok. 1/3.` : `Poza turniejem najczęściej gra pozycję ${main}, a swoją ${rolePos} tylko w ${Math.round(atRole * 100)}% gier — gry na innych pozycjach ważą ok. 1/3.`);
    }
  }
  return { ...input, heroes, share, evidence, totals, pubRoleFit, posGames, why, rankTier: history?.rankTier };
}

// ── Hero meta ───────────────────────────────────────────────────────────────

export interface HeroMetaRow { id: number; wr: number; contest: number; hiShare: number }

export function heroMeta(meta: DpMeta | null) {
  const map = new Map<number, HeroMetaRow>();
  if (!meta) return map;
  const totalHi = meta.heroes.reduce((a, h) => a + h.hiPick, 0) / 10 || 1;
  const maxPro = Math.max(1, ...meta.heroes.map(h => h.proPick + h.proBan));
  for (const h of meta.heroes) {
    if (!h.cm) continue;
    const wr = (h.hiWin + 0.5 * 400) / (h.hiPick + 400); // high-rank pubs, shrunk
    map.set(h.id, { id: h.id, wr, contest: (h.proPick + h.proBan) / maxPro, hiShare: h.hiPick / totalHi });
  }
  return map;
}

// ── Per-player hero likelihood and strength ─────────────────────────────────

export interface PlayerModel {
  p: Profile;
  /** Probability this player picks the hero, over every CM hero */
  like: Map<number, number>;
  /** Expected win rate on the hero (shrunk to the hero's meta) */
  strength: (hero: number) => number;
  comfort: (hero: number) => number;
}

export function playerModel(p: Profile, metaRows: Map<number, HeroMetaRow>, fit: RoleFit): PlayerModel {
  const all = [...metaRows.keys()];
  const totalW = [...p.heroes.values()].reduce((a, h) => a + h.wg, 0);
  // role-and-meta prior for heroes the player never showed
  const prior = new Map<number, number>();
  let ps = 0;
  for (const id of all) { const v = fit(id, p.role) ** 2 * (0.3 + (metaRows.get(id)?.hiShare ?? 0.05)); prior.set(id, v); ps += v; }
  const lambda = 0.08 + 0.55 * Math.exp(-totalW / 8);
  const like = new Map<number, number>();
  for (const id of all) {
    const own = totalW ? (p.heroes.get(id)?.wg ?? 0) / totalW : 0;
    like.set(id, (1 - lambda) * own + lambda * (prior.get(id)! / (ps || 1)));
  }
  const strength = (h: number) => {
    const s = p.heroes.get(h); const m = metaRows.get(h)?.wr ?? 0.5;
    const k = 5;
    return s ? (s.ww + k * m) / (s.wg + k) : m - 0.02; // unknown hero: slightly below meta
  };
  const comfort = (h: number) => 1 - Math.exp(-(p.heroes.get(h)?.wg ?? 0) / 2.5);
  return { p, like, strength, comfort };
}

// ── Team tendencies from tournament drafts ─────────────────────────────────

export interface TeamHabits {
  /** For the team's k-th pick (0-4): how often each role took it */
  slotRole: Array<Record<string, number>>;
  bans: Map<number, number>;
  firstPhaseBans: Map<number, number>;
  games: number;
  /** The team's own drafts behind each pick slot (the rest is the league's typical order) */
  slotGames: number[];
}

export function teamHabits(model: Model | null, teamId: string | null): TeamHabits {
  const league: Array<Record<string, number>> = Array.from({ length: 5 }, () => ({}));
  const own: Array<Record<string, number>> = Array.from({ length: 5 }, () => ({}));
  const bans = new Map<number, number>(); const firstPhaseBans = new Map<number, number>();
  let games = 0;
  for (const g of model?.games ?? []) {
    const pb = [...g.pb].sort((a, b) => a[3] - b[3]);
    for (const side of [0, 1]) {
      const tid = side === 0 ? g.radiant : g.dire;
      const picks = pb.filter(x => x[1] && x[2] === side);
      const mine = tid === teamId;
      if (mine) games++;
      // a standin has no role of their own: they play the role of the roster player who is missing
      const sidePerfs = g.perfs.filter(p => (p.radiant ? 0 : 1) === side);
      const present = new Set(sidePerfs.map(p => p.player?.role).filter(Boolean));
      const rosterRoles = (model?.teamById.get(tid)?.players ?? []).filter(p => !p.standin && p.role).map(p => p.role!);
      const missing = rosterRoles.filter(r => !present.has(r));
      picks.forEach((x, k) => {
        if (k > 4) return;
        const pf = sidePerfs.find(p => p.heroId === x[0]);
        const role = pf?.player?.role ?? (missing.length === 1 ? missing[0] : undefined);
        if (!role) return;
        league[k][role] = (league[k][role] ?? 0) + 1;
        if (mine) own[k][role] = (own[k][role] ?? 0) + 1;
      });
      if (mine) pb.forEach((x, i) => { if (x[1] || x[2] !== side) return; bans.set(x[0], (bans.get(x[0]) ?? 0) + 1); if (i < 7) firstPhaseBans.set(x[0], (firstPhaseBans.get(x[0]) ?? 0) + 1); });
    }
  }
  // smooth the team's habits with the league's (3 games' worth)
  const slotRole = own.map((o, k) => {
    const lt = Object.values(league[k]).reduce((a, b) => a + b, 0) || 1;
    const out: Record<string, number> = {};
    for (const r of ROLES) out[r] = (o[r] ?? 0) + 3 * ((league[k][r] ?? 1) / lt);
    return out;
  });
  return { slotRole, bans, firstPhaseBans, games, slotGames: own.map(o => Object.values(o).reduce((a, b) => a + b, 0)) };
}

// ── Matchups ───────────────────────────────────────────────────────────────

/** heroMatchups[e] = Map<h, [games, winsOfE]> from OpenDota pro data */
export type MatchupTable = Map<number, Map<number, [number, number]>>;

/** Tournament head-to-head and same-team records, keyed "a|b" */
export function tournamentPairs(model: Model | null) {
  const vs = new Map<string, [number, number]>(); const tog = new Map<string, [number, number]>();
  const add = (m: Map<string, [number, number]>, k: string, win: boolean) => { const r = m.get(k) ?? [0, 0]; r[0]++; if (win) r[1]++; m.set(k, r); };
  for (const g of model?.games ?? []) {
    const r = g.perfs.filter(p => p.radiant).map(p => p.heroId); const d = g.perfs.filter(p => !p.radiant).map(p => p.heroId);
    for (const a of r) for (const b of d) { add(vs, `${a}|${b}`, g.radiantWin); add(vs, `${b}|${a}`, !g.radiantWin); }
    for (const [side, win] of [[r, g.radiantWin], [d, !g.radiantWin]] as const) for (const a of side) for (const b of side) if (a !== b) add(tog, `${a}|${b}`, win);
  }
  return { vs, tog };
}

/** Win-rate shift of hero h when facing hero e (positive = h is good into e) */
export function counterShift(h: number, e: number, mu: MatchupTable, pairs: ReturnType<typeof tournamentPairs>): { v: number; n: number } {
  let num = 0; let den = 0;
  const od = mu.get(e)?.get(h); // e's record vs h
  if (od && od[0] >= 15) { const wrH = 1 - od[1] / od[0]; const w = Math.min(1, od[0] / 80); num += (wrH - 0.5) * w; den += w; }
  const od2 = mu.get(h)?.get(e); // h's record vs e
  if (od2 && od2[0] >= 15) { const wrH = od2[1] / od2[0]; const w = Math.min(1, od2[0] / 80); num += (wrH - 0.5) * w; den += w; }
  const t = pairs.vs.get(`${h}|${e}`);
  if (t && t[0] >= 2) { const w = Math.min(0.6, t[0] / 10); num += ((t[1] + 1) / (t[0] + 2) - 0.5) * w; den += w; }
  return { v: den ? num / den : 0, n: (od?.[0] ?? 0) + (od2?.[0] ?? 0) + (t?.[0] ?? 0) };
}

// ── Draft state ─────────────────────────────────────────────────────────────

export interface Side { team: string | null; players: PlayerModel[] }
export interface DraftInput {
  order: DraftStep[];
  /** Does "us" have first pick? */
  usFirst: boolean;
  /** Hero chosen at every step so far (null = not yet) */
  steps: Array<number | null>;
  /** Manual hero → player assignments (player key) */
  assign: Record<number, string>;
  us: Side; them: Side;
  habitsThem: TeamHabits; habitsUs: TeamHabits;
  meta: Map<number, HeroMetaRow>;
  mu: MatchupTable;
  pairs: ReturnType<typeof tournamentPairs>;
  fit: RoleFit;
  /** Elo of us and them (1500 when unknown) */
  elo: [number, number];
}

export const isUs = (d: Pick<DraftInput, 'order' | 'usFirst'>, i: number) => d.order[i].first === d.usFirst;

export interface DraftView {
  next: number; // index of the next empty step (or order.length)
  picksUs: number[]; picksThem: number[]; bans: number[];
  taken: Set<number>;
  /** hero → player key, for both sides */
  owner: Map<number, string>;
  freeUs: PlayerModel[]; freeThem: PlayerModel[];
}

/**
 * Who got each picked hero, decided pick by pick with the same model the predictions use:
 * at that step, (chance the player picks now, from the team's habits) × (how likely that player
 * is to choose this hero among those still available). A manual choice always wins. Because the
 * owner is fixed when the hero is picked, a player who already has a hero is never predicted again.
 */
function assignOwners(d: DraftInput): Map<number, string> {
  const owner = new Map<number, string>();
  const reserved = new Set<string>(); // players the user assigned by hand to a picked hero
  for (const h of d.steps) if (h != null && d.assign[h]) reserved.add(d.assign[h]);
  const taken = new Set<number>();
  const done: Record<'us' | 'them', Set<string>> = { us: new Set(), them: new Set() };
  d.order.forEach((st, i) => {
    const h = d.steps[i];
    if (h == null) return;
    if (st.pick) {
      const side: 'us' | 'them' = isUs(d, i) ? 'us' : 'them';
      const players = (side === 'us' ? d.us : d.them).players;
      const manual = d.assign[h];
      if (manual && players.some(p => p.p.key === manual) && !done[side].has(manual)) {
        owner.set(h, manual); done[side].add(manual);
      } else {
        const free = players.filter(p => !done[side].has(p.p.key) && !reserved.has(p.p.key));
        const all = pickStepsOf(d, side);
        const k = all.indexOf(i);
        const sch = balance(free, all.slice(k).map(x => all.indexOf(x)), side === 'us' ? d.habitsUs : d.habitsThem);
        let best: PlayerModel | undefined; let bv = -1;
        for (const pm of free) {
          let norm = 0; for (const [x, l] of pm.like) if (!taken.has(x)) norm += l;
          const post = (sch.get(pm.p.key)?.[0] ?? 0) * ((pm.like.get(h) ?? 0) / (norm || 1)) + 1e-6 * d.fit(h, pm.p.role);
          if (post > bv) { bv = post; best = pm; }
        }
        if (best) { owner.set(h, best.p.key); done[side].add(best.p.key); }
      }
    }
    taken.add(h);
  });
  return owner;
}

export function viewOf(d: DraftInput): DraftView {
  const picksUs: number[] = []; const picksThem: number[] = []; const bans: number[] = [];
  let next = d.order.length;
  d.steps.forEach((h, i) => {
    if (h == null) { if (next === d.order.length) next = i; return; }
    if (!d.order[i].pick) bans.push(h); else (isUs(d, i) ? picksUs : picksThem).push(h);
  });
  const taken = new Set([...picksUs, ...picksThem, ...bans]);
  const owner = assignOwners(d);
  const ownedKeys = new Set(owner.values());
  return { next, picksUs, picksThem, bans, taken, owner, freeUs: d.us.players.filter(p => !ownedKeys.has(p.p.key)), freeThem: d.them.players.filter(p => !ownedKeys.has(p.p.key)) };
}

// ── Predictions for the opponents ──────────────────────────────────────────

export interface Guess { hero: number; p: number; player?: PlayerModel; reason: string }

/** Draft steps at which a side picks, in order */
export function pickStepsOf(d: Pick<DraftInput, 'order' | 'usFirst'>, side: 'us' | 'them'): number[] {
  return d.order.map((st, i) => (st.pick && isUs(d, i) === (side === 'us') ? i : -1)).filter(i => i >= 0);
}
const banStepsOf = (d: Pick<DraftInput, 'order' | 'usFirst'>, side: 'us' | 'them') =>
  d.order.map((st, i) => (!st.pick && isUs(d, i) === (side === 'us') ? i : -1)).filter(i => i >= 0);

/** Sinkhorn balancing of players × pick slots (k = the team's pick number 0-4) */
function balance(free: PlayerModel[], ks: number[], habits: TeamHabits): Map<string, number[]> {
  const w = free.map(pm => ks.map(k => (habits.slotRole[Math.min(4, k)]?.[pm.p.role ?? ''] ?? 0.5) + 0.15));
  const colTarget = ks.length ? free.length / ks.length : 0;
  for (let it = 0; it < 40 && ks.length; it++) {
    for (const row of w) { const t = row.reduce((x, y) => x + y, 0) || 1; for (let j = 0; j < row.length; j++) row[j] /= t; }
    for (let j = 0; j < ks.length; j++) { const t = w.reduce((x, r) => x + r[j], 0) || 1; for (const r of w) r[j] *= colTarget / t; }
  }
  for (const row of w) { const t = row.reduce((x, y) => x + y, 0) || 1; for (let j = 0; j < row.length; j++) row[j] /= t; }
  return new Map(free.map((pm, i) => [pm.p.key, w[i]]));
}

/**
 * Who picks when: for every free player of a side and each of the side's remaining pick steps,
 * the probability that this step is that player's hero. Built from the team's habits (which role
 * the k-th pick usually is) and balanced so every player picks once and every step is one player.
 */
export function pickSchedule(d: DraftInput, v: DraftView, side: 'us' | 'them'): { steps: number[]; p: Map<string, number[]> } {
  const all = pickStepsOf(d, side);
  const steps = all.filter(i => d.steps[i] == null);
  const free = side === 'them' ? v.freeThem : v.freeUs;
  const habits = side === 'them' ? d.habitsThem : d.habitsUs;
  return { steps, p: balance(free, steps.map(i => all.indexOf(i)), habits) };
}

/** Probability of every available hero for a side's next pick, with the likely player */
export function predictPick(d: DraftInput, v: DraftView, side: 'us' | 'them'): Guess[] {
  const free = side === 'them' ? v.freeThem : v.freeUs;
  const sch = pickSchedule(d, v, side);
  const nextStep = sch.steps.find(i => i >= v.next) ?? sch.steps[0];
  const col = sch.steps.indexOf(nextStep);
  const acc = new Map<number, { p: number; best?: PlayerModel; bestP: number }>();
  for (const pm of free) {
    const po = sch.p.get(pm.p.key)?.[col] ?? 0;
    let norm = 0; for (const [h, l] of pm.like) if (!v.taken.has(h)) norm += l;
    if (!norm) continue;
    for (const [h, l] of pm.like) {
      if (v.taken.has(h)) continue;
      const c = po * (l / norm);
      const a = acc.get(h) ?? { p: 0, bestP: 0 };
      a.p += c; if (c > a.bestP) { a.bestP = c; a.best = pm; }
      acc.set(h, a);
    }
  }
  return [...acc.entries()].map(([hero, a]) => {
    const st = a.best?.p.heroes.get(hero);
    const reason = st ? `${a.best!.p.name}: ${count(st.cells.T.all.g + st.cells.L.all.g + st.cells.P.all.g, 'gra', 'gry', 'gier')}, ostatnio ${new Date(st.last * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}` : `${a.best?.p.name ?? '?'} — pasuje do roli`;
    return { hero, p: a.p, player: a.best, reason };
  }).sort((x, y) => y.p - x.p);
}

/**
 * How much a ban made now matters against each free player of the target side: fully for picks
 * that come before the banning side's next ban, little for later picks (those can still be banned
 * later, with more information). Also returns each player's most likely pick number.
 */
function banTiming(d: DraftInput, v: DraftView, banner: 'us' | 'them'): Map<string, { w: number; k: number; now: number }> {
  const target = banner === 'us' ? 'them' : 'us';
  const sch = pickSchedule(d, v, target);
  const all = pickStepsOf(d, target);
  // our later ban phases (a phase = consecutive ban steps); each one before their pick is another
  // chance to ban that hero, so a ban spent now matters less for that pick
  const laterPhases: number[] = []; // first step of each later ban phase of the banner
  let prev = v.next;
  for (const b of banStepsOf(d, banner).filter(i => i > v.next)) {
    if (d.order.slice(prev, b).some(x => x.pick)) laterPhases.push(b); // picks in between → a new phase
    prev = b;
  }
  const out = new Map<string, { w: number; k: number; now: number }>();
  for (const [key, row] of sch.p) {
    let w = 0; let best = -1; let bk = 0; let now = 0;
    row.forEach((pr, j) => {
      const step = sch.steps[j];
      const chances = laterPhases.filter(b => b < step).length;
      w += pr * Math.pow(0.3, chances);
      if (!chances) now += pr;
      if (pr > best) { best = pr; bk = all.indexOf(step); }
    });
    out.set(key, { w, k: bk, now });
  }
  return out;
}

/** What a side is likely to ban: its own habits plus the biggest threats from the other side */
export function predictBan(d: DraftInput, v: DraftView, side: 'us' | 'them'): Guess[] {
  const habits = side === 'them' ? d.habitsThem : d.habitsUs;
  const targets = side === 'them' ? v.freeUs : v.freeThem;
  const totalBans = [...habits.bans.values()].reduce((a, b) => a + b, 0);
  const timing = banTiming(d, v, side);
  const out: Guess[] = [];
  for (const h of d.meta.keys()) {
    if (v.taken.has(h)) continue;
    const habit = totalBans ? (habits.bans.get(h) ?? 0) / totalBans : 0;
    let threat = 0; let who: PlayerModel | undefined; let wv = 0;
    for (const pm of targets) { const t = (pm.like.get(h) ?? 0) * Math.max(0, pm.strength(h) - 0.4) * 4 * (timing.get(pm.p.key)?.w ?? 1); threat += t; if (t > wv) { wv = t; who = pm; } }
    const p = 0.45 * habit * Math.min(1, habits.games / 4) + threat + 0.02 * (d.meta.get(h)?.contest ?? 0);
    out.push({ hero: h, p, player: who, reason: habit ? `banują go ${habits.bans.get(h)}× w turnieju` : who ? `groźny w rękach: ${who.p.name}` : 'meta' });
  }
  const s = out.reduce((a, x) => a + x.p, 0) || 1;
  return out.map(x => ({ ...x, p: x.p / s })).sort((a, b) => b.p - a.p);
}

/**
 * Predicted pick order: for each of the team's picks in turn, the most likely of the players still
 * without a hero — the same rule the plan uses, so both always agree.
 */
export function predictOrder(habits: TeamHabits, players: PlayerModel[]) {
  const free = [...players]; const out: Array<{ k: number; pm: PlayerModel; p: number }> = [];
  for (let k = 0; k < 5 && free.length; k++) {
    const m = balance(free, Array.from({ length: 5 - k }, (_, j) => k + j), habits);
    const best = [...free].sort((a, b) => (m.get(b.p.key)?.[0] ?? 0) - (m.get(a.p.key)?.[0] ?? 0))[0];
    out.push({ k, pm: best, p: m.get(best.p.key)?.[0] ?? 0 });
    free.splice(free.indexOf(best), 1);
  }
  return out;
}

// ── Suggestions for us ──────────────────────────────────────────────────────

export interface Part { label: string; v: number }
export interface Suggestion { hero: number; score: number; player?: PlayerModel; parts: Part[]; /** bans: chance the target picks before our next ban phase */ when?: number }

/** Value of a hero in a player's hands: expected win rate with a small comfort bonus */
export const handValue = (pm: PlayerModel, h: number, fit: RoleFit) => pm.strength(h) + 0.05 * pm.comfort(h) - 0.12 * (1 - fit(h, pm.p.role));

export function suggestPick(d: DraftInput, v: DraftView): Suggestion[] {
  const k = v.picksUs.length;
  const wDeny = [0.9, 0.7, 0.45, 0.25, 0.1][Math.min(4, k)];
  const wCounter = [0.6, 0.8, 1.1, 1.3, 1.5][Math.min(4, k)];
  const them = predictPick(d, v, 'them');
  const enemyWant = new Map(them.map(g => [g.hero, g.p]));
  const out: Suggestion[] = [];
  for (const h of d.meta.keys()) {
    if (v.taken.has(h)) continue;
    let best: PlayerModel | undefined; let bv = -1; let fits = 0;
    for (const pm of v.freeUs) { const hv = handValue(pm, h, d.fit); if (hv > bv) { bv = hv; best = pm; } if (d.fit(h, pm.p.role) > 0.6) fits++; }
    if (!best) continue;
    const parts: Part[] = [];
    parts.push({ label: `${best.p.name} na tym bohaterze`, v: bv - 0.5 });
    if (v.picksThem.length) {
      const c = v.picksThem.map(e => counterShift(h, e, d.mu, d.pairs).v).reduce((a, b) => a + b, 0) / v.picksThem.length;
      parts.push({ label: 'kontra na ich picki', v: wCounter * c });
    }
    if (v.picksUs.length) {
      const syn = v.picksUs.map(a => { const t = d.pairs.tog.get(`${h}|${a}`); return t && t[0] >= 2 ? (t[1] + 1) / (t[0] + 2) - 0.5 : 0; }).reduce((a, b) => a + b, 0) / v.picksUs.length;
      if (syn) parts.push({ label: 'współpraca z naszymi', v: 0.4 * syn });
    }
    const want = enemyWant.get(h) ?? 0;
    if (want > 0.01) parts.push({ label: 'zabiera im bohatera', v: wDeny * Math.min(0.12, want * 0.8) });
    const m = d.meta.get(h);
    if (m) parts.push({ label: 'meta', v: 0.5 * (m.wr - 0.5) + 0.02 * m.contest });
    if (k <= 1 && fits >= 2) parts.push({ label: 'elastyczny — ukrywa role', v: 0.012 * (fits - 1) });
    const score = parts.reduce((a, p) => a + p.v, 0);
    out.push({ hero: h, score, player: best, parts });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Best suggestion per player (each of our players appears once) */
export function onePerPlayer(list: Suggestion[], n = 5): Suggestion[] {
  const used = new Set<string>(); const out: Suggestion[] = [];
  for (const s of list) { const k = s.player?.p.key ?? `h${s.hero}`; if (used.has(k)) continue; used.add(k); out.push(s); if (out.length >= n) break; }
  return out;
}

export function suggestBan(d: DraftInput, v: DraftView): Suggestion[] {
  const out: Suggestion[] = [];
  const timing = banTiming(d, v, 'us');
  const ourBest = new Map<number, number>();
  for (const h of d.meta.keys()) ourBest.set(h, Math.max(0, ...v.freeUs.map(pm => handValue(pm, h, d.fit))));
  for (const h of d.meta.keys()) {
    if (v.taken.has(h)) continue;
    const parts: Part[] = [];
    let threat = 0; let who: PlayerModel | undefined; let wv = 0; let raw = 0;
    for (const pm of v.freeThem) {
      const l = pm.like.get(h) ?? 0;
      const conc = Math.max(...pm.like.values()); // one-trick players make bans worth more
      const t0 = l * Math.max(0, pm.strength(h) - 0.42) * (1 + conc * 2) * 3;
      const t = t0 * (timing.get(pm.p.key)?.w ?? 1);
      threat += t; if (t > wv) { wv = t; who = pm; raw = t0; }
    }
    if (threat > 0.0005 && who) {
      const now = timing.get(who.p.key)?.now ?? 1;
      parts.push({ label: `odbiera: ${who.p.name} — ${Math.round(now * 100)}% że wybiera przed naszymi następnymi banami`, v: threat });
    }
    if (v.picksUs.length) {
      const danger = v.picksUs.map(a => counterShift(h, a, d.mu, d.pairs).v).reduce((a, b) => a + b, 0) / v.picksUs.length;
      if (danger > 0) parts.push({ label: 'kontruje nasze picki', v: danger * 1.2 });
    }
    const m = d.meta.get(h);
    if (m) parts.push({ label: 'siła w mecie', v: 0.35 * Math.max(0, m.wr - 0.5) + 0.015 * m.contest });
    const mine = ourBest.get(h) ?? 0;
    if (mine > 0.56) parts.push({ label: 'chcemy go sami', v: -(mine - 0.56) * 1.5 });
    out.push({ hero: h, score: parts.reduce((a, p) => a + p.v, 0), player: who, parts, when: who ? timing.get(who.p.key)?.now : undefined });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ── Draft evaluation ────────────────────────────────────────────────────────

export interface Evaluation { pUs: number; us: number; them: number; counter: number; base: number }

/** Win chance of a (partial) draft: Elo base + how well each side plays its heroes + counters */
export function evaluate(d: DraftInput, v: DraftView): Evaluation {
  const playersByKey = new Map([...d.us.players, ...d.them.players].map(pm => [pm.p.key, pm]));
  const sideVal = (picks: number[]) => picks.reduce((a, h) => { const pm = playersByKey.get(v.owner.get(h) ?? ''); return a + (pm ? handValue(pm, h, d.fit) - 0.5 : (d.meta.get(h)?.wr ?? 0.5) - 0.5); }, 0);
  const us = sideVal(v.picksUs); const them = sideVal(v.picksThem);
  let counter = 0; let n = 0;
  for (const a of v.picksUs) for (const b of v.picksThem) { counter += counterShift(a, b, d.mu, d.pairs).v; n++; }
  const c = n ? (counter / n) * Math.min(5, Math.sqrt(n)) : 0;
  const base = 1 / (1 + Math.pow(10, (d.elo[1] - d.elo[0]) / 400));
  const logit = Math.log(base / (1 - base)) + 3.2 * (us - them) + 2.4 * c;
  return { pUs: 1 / (1 + Math.exp(-logit)), us, them, counter: c, base };
}

// ── Look-ahead (used by the engine page) ────────────────────────────────────

function sample<T extends { p: number }>(list: T[], r: number): T | undefined {
  let acc = 0; for (const x of list) { acc += x.p; if (r <= acc) return x; } return list[0];
}

/** One expected draft from the current state: our top suggestion at our steps, their likeliest move at theirs */
export interface PlanStep { i: number; us: boolean; pick: boolean; hero: number; player?: PlayerModel; reason: string; p?: number; when?: number }
export function planDraft(d: DraftInput): PlanStep[] {
  let dd = d; const out: PlanStep[] = [];
  for (let i = viewOf(d).next; i < d.order.length; i++) {
    const v = viewOf(dd); const us = isUs(dd, i); const pick = dd.order[i].pick;
    let st: PlanStep | null = null;
    if (us) { const sg = (pick ? suggestPick(dd, v) : suggestBan(dd, v))[0]; if (sg) st = { i, us, pick, hero: sg.hero, player: sg.player, reason: [...sg.parts].sort((a, b) => b.v - a.v)[0]?.label ?? '', when: sg.when }; }
    else if (pick) {
      // who picks now (from their habits), then that player's likeliest available hero
      const sch = pickSchedule(dd, v, 'them'); const col = sch.steps.indexOf(i);
      const who = [...v.freeThem].sort((a, b) => (sch.p.get(b.p.key)?.[col] ?? 0) - (sch.p.get(a.p.key)?.[col] ?? 0))[0];
      const hero = who ? [...who.like.entries()].filter(([h]) => !v.taken.has(h)).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
      if (who && hero != null) st = { i, us, pick, hero, player: who, reason: `${who.p.name} — ${Math.round((sch.p.get(who.p.key)?.[col] ?? 0) * 100)}% że wybiera teraz`, p: sch.p.get(who.p.key)?.[col] };
    } else { const g = predictBan(dd, v, 'them')[0]; if (g) st = { i, us, pick, hero: g.hero, player: g.player, reason: g.reason, p: g.p }; }
    if (!st) break;
    out.push(st);
    const hero = st.hero;
    dd = { ...dd, steps: dd.steps.map((x, k) => (k === i ? hero : x)) };
  }
  return out;
}

/** The same draft seen from the opponent's side */
export function mirror(d: DraftInput): DraftInput {
  return { ...d, usFirst: !d.usFirst, us: d.them, them: d.us, habitsUs: d.habitsThem, habitsThem: d.habitsUs, elo: [d.elo[1], d.elo[0]] };
}

/** Average final win chance after `hero` at the next step, over `n` random completions */
export function rollout(d: DraftInput, hero: number, n = 24, rnd: () => number = Math.random): number {
  const v0 = viewOf(d);
  if (v0.next >= d.order.length) return evaluate(d, v0).pUs;
  let total = 0;
  for (let r = 0; r < n; r++) {
    const steps = [...d.steps]; steps[v0.next] = hero;
    let dd: DraftInput = { ...d, steps };
    for (let i = v0.next + 1; i < d.order.length; i++) {
      const v = viewOf(dd);
      const us = isUs(dd, i); const pick = dd.order[i].pick;
      let h: number | undefined;
      if (us) h = (pick ? suggestPick(dd, v) : suggestBan(dd, v))[Math.floor(rnd() * 2)]?.hero;
      else if (rnd() < 0.5) {
        // half the time they play their own best move (the same engine from their side)…
        const mv = mirror(dd); const vm = viewOf(mv);
        h = (pick ? suggestPick(mv, vm) : suggestBan(mv, vm))[Math.floor(rnd() * 2)]?.hero;
      } else {
        // …and half the time what their habits say
        const g = (pick ? predictPick(dd, v, 'them') : predictBan(dd, v, 'them')).slice(0, 12); const s = g.reduce((a, x) => a + x.p, 0) || 1; h = sample(g.map(x => ({ ...x, p: x.p / s })), rnd())?.hero;
      }
      if (h == null) break;
      const st = [...dd.steps]; st[i] = h; dd = { ...dd, steps: st };
    }
    total += evaluate(dd, viewOf(dd)).pUs;
  }
  return total / n;
}

/** Hero tables for display: per hero, games/wins in the chosen window and sources */
export function poolRows(p: Profile, window: Window, sources: Source[]) {
  return [...p.heroes.values()].map(s => {
    let g = 0; let w = 0; for (const src of sources) { g += s.cells[src][window].g; w += s.cells[src][window].w; }
    return { hero: s.hero, g, w, st: s };
  }).filter(r => r.g > 0).sort((a, b) => b.g - a.g || b.w - a.w);
}

export const rankName = (tier?: number) => {
  if (!tier) return null;
  const names = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];
  const m = Math.floor(tier / 10); const s = tier % 10;
  return m === 8 ? 'Immortal' : `${names[m] ?? '?'} ${s || ''}`.trim();
};
