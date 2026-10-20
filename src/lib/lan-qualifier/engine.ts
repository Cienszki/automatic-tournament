// src/lib/lan-qualifier/engine.ts
//
// The LAN qualifier format, as a pure engine (no Firestore, no React). It works from the matches
// played so far, so the same code generates the real tournament's rounds in the admin panel,
// projects the not-yet-played part of the chart, and runs the preview simulation.
//
// Format (all series bo3):
//   Rounds 1–3 (in parallel)
//     A — the 4 best seeds play a GSL group (= 4-team Swiss; openers 1–2 and 3–4): 1st/2nd → LAN, 3rd/4th → Final.
//     B — everyone else plays ceil(log2 n) Swiss rounds on series records (no MMR band, no Buchholz).
//         The best record goes to the Final; if more teams share the record at the 2nd spot than
//         there are spots, the organiser decides who advances (admin panel) — no extra round.
//   Rounds 4–6 (in parallel)
//     F — GSL of A3, A4, B1, B2 (A3–B2, A4–B1): 1st/2nd go to LAN, 3rd/4th are places 5–6.
//     P — the rest of B keeps playing Swiss (records carried) for places 7+.
//   Then teams still level on record in P play extra rounds among themselves (bracket-style:
//   a pair once, four twice, an odd group's best seed sits a round out) until every place is set.
//   LAN — the tournament's own playoff bracket, seeded by the admin.

export type LQStage = 'A' | 'B' | 'F' | 'P';
export type GslSlot = 'o1' | 'o2' | 'w' | 'l' | 'd';
/** Series record [wins, losses]. */
export type Rec = [number, number];

export interface LQMatch {
  id: string;
  stage: LQStage;
  /** GSL slot for A/F; 'tb' for P's tie-settling matches. */
  slot?: GslSlot | 'tb';
  round: number;
  a: string;
  /** null = bye for `a` (counts as a win). */
  b: string | null;
  sa: number;
  sb: number;
  done: boolean;
  /** Winner once done; null for a double forfeit. */
  winner: string | null;
}

export interface LQConfig {
  groupA: string[];
  groupB: string[];
  /** 1 = best seed. */
  seed: Record<string, number>;
  placementRounds: number;
}

export interface LQDecisions {
  /** The organiser's pick among the teams level at the Swiss cut. */
  advanced?: string[] | null;
}

export interface LQPairing {
  stage: LQStage;
  slot?: GslSlot | 'tb';
  a: string;
  b: string | null;
}

export type LQPlan =
  | { kind: 'pairings'; round: number; pairings: LQPairing[] }
  | { kind: 'wait'; reason: string }
  | { kind: 'decide'; teams: string[]; spots: number; record: Rec }
  | { kind: 'done' };

export const PLACEMENT_ROUNDS = 3;
export const GSL_LABEL: Record<GslSlot, string> = {
  o1: 'Mecz otwarcia',
  o2: 'Mecz otwarcia',
  w: 'Mecz zwycięzców',
  l: 'Mecz przegranych',
  d: 'Mecz decydujący',
};

export function swissRoundsFor(nB: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, nB))));
}

export function scheduleOf(cfg: LQConfig) {
  const r = swissRoundsFor(cfg.groupB.length);
  const finalStart = Math.max(3, r) + 1;
  return { r, finalStart, placementEnd: finalStart + cfg.placementRounds - 1 };
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const loserOf = (m: LQMatch) => (m.winner === m.a ? m.b : m.a);

// ─── GSL ────────────────────────────────────────────────────────────────────

/**
 * Pairings of GSL step 1–3, or a reason to wait. `seeds` in seed order. The opening matches pair
 * neighbouring seeds (1–2, 3–4: similar MMR meets similar MMR, as in the league's Swiss round 1)
 * or cross (1–4, 2–3: the Final, so A3–B2 and A4–B1 and no group-mates meet straight away).
 */
function gslStep(stage: 'A' | 'F', seeds: string[], step: number, ms: LQMatch[], opening: 'adjacent' | 'cross'): LQPairing[] | string {
  const by = (slot: GslSlot) => ms.find(m => m.slot === slot);
  const need = (...slots: GslSlot[]) => {
    for (const s of slots) {
      const m = by(s);
      if (!m || !m.done) return `${stage === 'A' ? 'Grupa A' : 'Finał'}: brak wyniku meczu ${GSL_LABEL[s].toLowerCase()}`;
      if (!m.winner) return `${stage === 'A' ? 'Grupa A' : 'Finał'}: mecz bez zwycięzcy — ustaw wynik`;
    }
    return null;
  };
  if (step === 1) {
    return opening === 'adjacent'
      ? [
        { stage, slot: 'o1', a: seeds[0], b: seeds[1] },
        { stage, slot: 'o2', a: seeds[2], b: seeds[3] },
      ]
      : [
        { stage, slot: 'o1', a: seeds[0], b: seeds[3] },
        { stage, slot: 'o2', a: seeds[1], b: seeds[2] },
      ];
  }
  if (step === 2) {
    const wait = need('o1', 'o2');
    if (wait) return wait;
    const o1 = by('o1')!;
    const o2 = by('o2')!;
    return [
      { stage, slot: 'w', a: o1.winner!, b: o2.winner! },
      { stage, slot: 'l', a: loserOf(o1)!, b: loserOf(o2)! },
    ];
  }
  if (step === 3) {
    const wait = need('w', 'l');
    if (wait) return wait;
    return [{ stage, slot: 'd', a: loserOf(by('w')!)!, b: by('l')!.winner! }];
  }
  return [];
}

/** 1st–4th of a finished (or partly finished) GSL group; null where not decided yet. */
function gslPlaces(ms: LQMatch[]): (string | null)[] {
  const by = (slot: GslSlot) => ms.find(m => m.slot === slot && m.done && m.winner);
  const w = by('w');
  const l = by('l');
  const d = by('d');
  return [w?.winner ?? null, d?.winner ?? null, d ? loserOf(d) : null, l ? loserOf(l) : null];
}

// ─── Swiss ──────────────────────────────────────────────────────────────────

interface SwissState {
  rec: Record<string, Rec>;
  opps: Record<string, string[]>;
  played: Set<string>;
  byes: Set<string>;
}

/** Records etc. of `ids` from the finished matches among them (B and P, in round order). */
function swissState(ids: string[], ms: LQMatch[]): SwissState {
  const s: SwissState = { rec: {}, opps: {}, played: new Set(), byes: new Set() };
  for (const id of ids) { s.rec[id] = [0, 0]; s.opps[id] = []; }
  for (const m of [...ms].sort((x, y) => x.round - y.round)) {
    if (!m.done || !(m.a in s.rec)) continue;
    if (!m.b) { s.rec[m.a] = [s.rec[m.a][0] + 1, s.rec[m.a][1]]; s.byes.add(m.a); continue; }
    if (!(m.b in s.rec)) continue;
    s.played.add(pairKey(m.a, m.b));
    s.opps[m.a].push(m.b);
    s.opps[m.b].push(m.a);
    for (const id of [m.a, m.b]) {
      const won = m.winner === id;
      s.rec[id] = [s.rec[id][0] + (won ? 1 : 0), s.rec[id][1] + (won ? 0 : 1)];
    }
  }
  return s;
}

const byRecord = (s: SwissState, seed: Record<string, number>) => (x: string, y: string) =>
  s.rec[y][0] - s.rec[x][0] || s.rec[x][1] - s.rec[y][1] || (seed[x] ?? 999) - (seed[y] ?? 999);

/**
 * Score-group pairing, no MMR band. Every pairing has a cost: a 1-win gap 2, a 2-win gap 20, a
 * rematch 3, a rematch of the last round 8 — so a team floats one group down rather than meet
 * someone again, but meets someone again rather than face a team two wins apart (small placement
 * groups otherwise force that). The cheapest pairing of the whole round is found by iterative
 * deepening on cost; within a group the top half meets the bottom half — except in the first
 * round (everyone 0:0), where neighbouring seeds meet (similar MMR, as the league's round 1 does).
 * The bye (odd field) goes to the lowest-ranked team that has not had one.
 */
export function pairSwissRound(s: SwissState, ids: string[], seed: Record<string, number>): [string, string | null][] {
  const order = [...ids].sort(byRecord(s, seed));
  const pairs: [string, string | null][] = [];
  if (order.length % 2 === 1) {
    let idx = order.length - 1;
    while (idx > 0 && s.byes.has(order[idx])) idx--;
    pairs.push([order[idx], null]);
    order.splice(idx, 1);
  }
  const groupKey = (id: string) => `${s.rec[id][0]}:${s.rec[id][1]}`;
  const groups: Record<string, string[]> = {};
  for (const id of order) (groups[groupKey(id)] ??= []).push(id);
  const posIn = (id: string) => groups[groupKey(id)].indexOf(id);
  const sizeOf = (id: string) => groups[groupKey(id)].length;
  const lastOpp = (id: string) => s.opps[id][s.opps[id].length - 1];
  const firstRound = ids.every(id => s.rec[id][0] + s.rec[id][1] === 0);
  const cost = (t: string, c: string) => {
    const gap = Math.abs(s.rec[c][0] - s.rec[t][0]);
    const met = s.played.has(pairKey(t, c));
    return (gap === 0 ? 0 : gap === 1 ? 2 : 20 * (gap - 1)) + (met ? (lastOpp(t) === c ? 8 : 3) : 0);
  };

  let overshoot = Infinity;
  const solve = (list: string[], budget: { n: number }, costLeft: number): [string, string][] | null => {
    if (list.length === 0) return [];
    if (budget.n-- <= 0) return null;
    const [t, ...rest] = list;
    const target = posIn(t) + (firstRound ? 1 : Math.floor(sizeOf(t) / 2));
    const cands = [...rest].sort((x, y) => {
      const cx = cost(t, x);
      const cy = cost(t, y);
      if (cx !== cy) return cx - cy;
      const sx = groupKey(x) === groupKey(t) ? Math.abs(posIn(x) - target) : posIn(x);
      const sy = groupKey(y) === groupKey(t) ? Math.abs(posIn(y) - target) : posIn(y);
      return sx - sy;
    });
    for (const c of cands) {
      const k = cost(t, c);
      if (k > costLeft) { overshoot = Math.min(overshoot, k - costLeft); continue; }
      const sub = solve(rest.filter(x => x !== c), budget, costLeft - k);
      if (sub) return [[t, c], ...sub];
    }
    return null;
  };

  let solved: [string, string][] | null = null;
  for (let limit = 0, pass = 0; !solved && pass < 40; pass++) {
    overshoot = Infinity;
    solved = solve(order, { n: 3000 }, limit);
    if (solved || overshoot === Infinity) break;
    limit += overshoot;
  }
  if (!solved) {
    // Safety net for a search that ran out of budget: cheapest partner first, top of the table down.
    const left = [...order];
    solved = [];
    while (left.length) {
      const t = left.shift()!;
      let best = 0;
      for (let i = 1; i < left.length; i++) if (cost(t, left[i]) < cost(t, left[best])) best = i;
      solved.push([t, left.splice(best, 1)[0]]);
    }
  }
  return [...solved, ...pairs];
}

// ─── Derived state ──────────────────────────────────────────────────────────

export interface LQPlacement {
  place: number;
  /** "9–10" while teams are still level. */
  label: string;
  teamId: string | null;
  lan: boolean;
}

export interface LQDerived {
  r: number;
  finalStart: number;
  placementEnd: number;
  aPlaces: (string | null)[];
  fPlaces: (string | null)[];
  bDone: boolean;
  /** Teams level at the Swiss cut when the organiser must choose; null when not needed (yet). */
  tie: { teams: string[]; spots: number; record: Rec } | null;
  /** The two Swiss teams going to the Final, once known. */
  b1: string | null;
  b2: string | null;
  /** The rest of B (places 7+), once the cut is known. */
  rest: string[] | null;
  /** Rest in place order and whether every place is settled. */
  restOrder: string[];
  restSettled: boolean;
  /** Each rest team's tie-settling path (W / S / L) — orders teams within a level group. */
  paths: Record<string, string>;
  placements: LQPlacement[];
  /** Stage-internal records before each match (GSL record for A/F, carried Swiss record for B/P). */
  recBefore: Record<string, [Rec, Rec]>;
}

export function derive(cfg: LQConfig, matches: LQMatch[], decisions: LQDecisions = {}): LQDerived {
  const { r, finalStart, placementEnd } = scheduleOf(cfg);
  const of = (stage: LQStage) => matches.filter(m => m.stage === stage);
  const recBefore: Record<string, [Rec, Rec]> = {};

  // GSL records before each match
  for (const stage of ['A', 'F'] as const) {
    const rec: Record<string, Rec> = {};
    for (const m of of(stage).sort((x, y) => x.round - y.round)) {
      const ra = rec[m.a] ?? [0, 0];
      const rb = m.b ? rec[m.b] ?? [0, 0] : [0, 0] as Rec;
      recBefore[m.id] = [[...ra], [...rb]];
      if (!m.done || !m.b) continue;
      rec[m.a] = m.winner === m.a ? [ra[0] + 1, ra[1]] : [ra[0], ra[1] + 1];
      rec[m.b] = m.winner === m.b ? [rb[0] + 1, rb[1]] : [rb[0], rb[1] + 1];
    }
  }

  // Swiss (B then P, records carried) records before each match
  {
    const rec: Record<string, Rec> = Object.fromEntries(cfg.groupB.map(id => [id, [0, 0] as Rec]));
    for (const m of [...of('B'), ...of('P')].sort((x, y) => x.round - y.round)) {
      const ra = rec[m.a] ?? [0, 0];
      const rb = m.b ? rec[m.b] ?? [0, 0] : [0, 0] as Rec;
      recBefore[m.id] = [[...ra], [...rb]];
      if (!m.done) continue;
      if (!m.b) { rec[m.a] = [ra[0] + 1, ra[1]]; continue; }
      rec[m.a] = m.winner === m.a ? [ra[0] + 1, ra[1]] : [ra[0], ra[1] + 1];
      rec[m.b] = m.winner === m.b ? [rb[0] + 1, rb[1]] : [rb[0], rb[1] + 1];
    }
  }

  const aPlaces = gslPlaces(of('A'));
  const fPlaces = gslPlaces(of('F'));

  // Swiss cut
  const bMatches = of('B');
  const bDone = Array.from({ length: r }, (_, i) => i + 1).every(rd => {
    const ms = bMatches.filter(m => m.round === rd);
    return ms.length > 0 && ms.every(m => m.done);
  });
  let tie: LQDerived['tie'] = null;
  let b1: string | null = null;
  let b2: string | null = null;
  let rest: string[] | null = null;
  if (bDone) {
    const s = swissState(cfg.groupB, bMatches);
    const ranked = [...cfg.groupB].sort(byRecord(s, cfg.seed));
    const cutWins = s.rec[ranked[1]][0];
    const above = ranked.filter(id => s.rec[id][0] > cutWins);
    const level = ranked.filter(id => s.rec[id][0] === cutWins).sort((x, y) => cfg.seed[x] - cfg.seed[y]);
    const spots = 2 - above.length;
    let advanced: string[] | null = level;
    if (level.length > spots) {
      tie = { teams: level, spots, record: [...s.rec[level[0]]] as Rec };
      const pick = decisions.advanced ?? null;
      advanced = pick && pick.length === spots && pick.every(id => level.includes(id)) ? pick : null;
    }
    if (advanced) {
      [b1, b2] = [...above, ...advanced];
      rest = cfg.groupB.filter(id => id !== b1 && id !== b2);
    }
  }

  // Rest: placement Swiss, then tie-settling rounds ordered by path
  let restOrder: string[] = [];
  let restSettled = false;
  const paths: Record<string, string> = {};
  if (rest) {
    const pMatches = of('P');
    const base = swissState(cfg.groupB, [...bMatches, ...pMatches.filter(m => m.slot !== 'tb')]);
    for (const id of rest) paths[id] = '';
    const placementDone = Array.from({ length: cfg.placementRounds }, (_, i) => finalStart + i).every(rd => {
      const ms = pMatches.filter(m => m.round === rd && m.slot !== 'tb');
      return ms.length > 0 && ms.every(m => m.done);
    }) || rest.length < 2;
    const key = (id: string) => `${base.rec[id][0]}:${base.rec[id][1]}|${paths[id]}`;
    let tbOpen = false;
    if (placementDone) {
      const tbRounds = [...new Set(pMatches.filter(m => m.slot === 'tb').map(m => m.round))].sort((x, y) => x - y);
      for (const rd of tbRounds) {
        const ms = pMatches.filter(m => m.slot === 'tb' && m.round === rd);
        if (!ms.every(m => m.done && m.winner)) { tbOpen = true; break; }
        const groups = new Map<string, string[]>();
        for (const id of rest) groups.set(key(id), [...(groups.get(key(id)) ?? []), id]);
        const playing = new Set(ms.flatMap(m => [m.a, m.b!]));
        for (const g of groups.values()) {
          if (g.length < 2) continue;
          for (const id of g) if (!playing.has(id)) paths[id] += 'S';
        }
        for (const m of ms) {
          paths[m.a] += m.winner === m.a ? 'W' : 'L';
          paths[m.b!] += m.winner === m.b ? 'W' : 'L';
        }
      }
    }
    const pathRank = (a: string, b: string) => {
      const rk = (c: string | undefined) => (c === undefined ? 1 : 'WSL'.indexOf(c));
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return rk(a[i]) - rk(b[i]);
      return 0;
    };
    restOrder = [...rest].sort((x, y) =>
      base.rec[y][0] - base.rec[x][0] || base.rec[x][1] - base.rec[y][1] || pathRank(paths[x], paths[y]) || cfg.seed[x] - cfg.seed[y]);
    const keys = rest.map(key);
    restSettled = placementDone && !tbOpen && new Set(keys).size === keys.length;
  }

  // Places
  const placements: LQPlacement[] = [
    { place: 1, label: '1', teamId: aPlaces[0], lan: true },
    { place: 2, label: '2', teamId: aPlaces[1], lan: true },
    { place: 3, label: '3', teamId: fPlaces[0], lan: true },
    { place: 4, label: '4', teamId: fPlaces[1], lan: true },
    { place: 5, label: '5', teamId: fPlaces[2], lan: false },
    { place: 6, label: '6', teamId: fPlaces[3], lan: false },
  ];
  const restCount = cfg.groupB.length - 2;
  for (let i = 0; i < restCount; i++) {
    placements.push({ place: 7 + i, label: String(7 + i), teamId: restSettled ? restOrder[i] ?? null : null, lan: false });
  }

  return { r, finalStart, placementEnd, aPlaces, fPlaces, bDone, tie, b1, b2, rest, restOrder, restSettled, paths, placements, recBefore };
}

// ─── Planning ───────────────────────────────────────────────────────────────

/** What round `round` should be, given every match before it. */
export function plan(cfg: LQConfig, matches: LQMatch[], decisions: LQDecisions, round: number): LQPlan {
  const before = matches.filter(m => m.round < round);
  const open = before.filter(m => !m.done);
  if (open.length) return { kind: 'wait', reason: `Najpierw zakończ rundę ${Math.max(...open.map(m => m.round))} (${open.length} mecz(e) bez wyniku).` };

  const d = derive(cfg, before, decisions);
  const { r, finalStart, placementEnd } = d;
  const pairings: LQPairing[] = [];
  const waits: string[] = [];
  const add = (p: LQPairing[] | string) => (typeof p === 'string' ? waits.push(p) : pairings.push(...p));

  // Stage 1
  if (round <= 3) add(gslStep('A', cfg.groupA, round, before.filter(m => m.stage === 'A'), 'adjacent'));
  if (round <= r) {
    const s = swissState(cfg.groupB, before.filter(m => m.stage === 'B'));
    for (const [a, b] of pairSwissRound(s, cfg.groupB, cfg.seed)) pairings.push({ stage: 'B', a, b });
  }

  // Stage 2
  if (round >= finalStart) {
    if (d.tie && !d.b1) return { kind: 'decide', teams: d.tie.teams, spots: d.tie.spots, record: d.tie.record };
    if (!d.b1 || !d.b2 || !d.rest || !d.aPlaces[2] || !d.aPlaces[3]) {
      return { kind: 'wait', reason: 'Etap 1 nie jest jeszcze rozstrzygnięty.' };
    }
    if (round <= finalStart + 2) {
      add(gslStep('F', [d.aPlaces[2], d.aPlaces[3], d.b1, d.b2], round - finalStart + 1, before.filter(m => m.stage === 'F'), 'cross'));
    }
    const rest = d.rest;
    if (round <= placementEnd) {
      if (rest.length > 1) {
        // Records over the whole Swiss group: results against B1/B2 still count.
        const s = swissState(cfg.groupB, before.filter(m => m.stage === 'B' || m.stage === 'P'));
        for (const [a, b] of pairSwissRound(s, rest, cfg.seed)) pairings.push({ stage: 'P', a, b });
      }
    } else if (!d.restSettled) {
      // Tie-settling: teams still level (same base record and path) play among themselves.
      const pMatches = before.filter(m => m.stage === 'P' && m.slot !== 'tb');
      const base = swissState(cfg.groupB, [...before.filter(m => m.stage === 'B'), ...pMatches]);
      const key = (id: string) => `${base.rec[id][0]}:${base.rec[id][1]}|${d.paths[id]}`;
      const groups = new Map<string, string[]>();
      for (const id of rest) groups.set(key(id), [...(groups.get(key(id)) ?? []), id]);
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const list = [...g].sort((x, y) => cfg.seed[x] - cfg.seed[y]);
        if (list.length % 2 === 1) list.shift(); // the best seed sits this round out
        for (let j = 0; j < list.length / 2; j++) pairings.push({ stage: 'P', slot: 'tb', a: list[j], b: list[list.length - 1 - j] });
      }
    }
  }

  if (pairings.length) return { kind: 'pairings', round, pairings };
  if (waits.length) return { kind: 'wait', reason: waits[0] };
  const all = derive(cfg, matches, decisions);
  const finished = all.restSettled && all.fPlaces.every(Boolean) && all.aPlaces.every(Boolean);
  return finished ? { kind: 'done' } : { kind: 'wait', reason: 'Brak meczów do rozegrania w tej rundzie.' };
}

// ─── Simulation (preview, and the projected part of the real chart) ─────────

export interface SimOptions {
  /** Result of a series between a and b. */
  play: (a: string, b: string) => [number, number];
  /** The organiser's pick among tied teams, when not decided yet. */
  pick: (teams: string[], spots: number) => string[];
}

export interface Projection {
  /** Real matches (results filled in by simulation where still open) followed by projected ones. */
  matches: LQMatch[];
  /** Ids of matches that are only projected (not created yet). */
  projected: Set<string>;
  /** Ids of real matches whose result is simulated (not played yet). */
  shadowed: Set<string>;
  decisions: LQDecisions;
  /** True when the tiebreak pick is the projection's guess rather than the organiser's. */
  pickProjected: boolean;
}

/** Plays out everything that has not happened yet, on top of the real matches. */
export function project(cfg: LQConfig, real: LQMatch[], decisions: LQDecisions, opts: SimOptions): Projection {
  const matches: LQMatch[] = [];
  const projected = new Set<string>();
  const shadowed = new Set<string>();
  const decide: LQDecisions = { ...decisions };
  let pickProjected = false;
  const finish = (m: LQMatch): LQMatch => {
    if (m.done) return m;
    if (!m.b) return { ...m, sa: 2, sb: 0, done: true, winner: m.a };
    const [sa, sb] = opts.play(m.a, m.b);
    return { ...m, sa, sb, done: true, winner: sa > sb ? m.a : m.b };
  };
  const maxReal = real.reduce((mx, m) => Math.max(mx, m.round), 0);
  for (let round = 1; round <= 40; round++) {
    const existing = real.filter(m => m.round === round);
    if (round <= maxReal) {
      for (const m of existing) {
        if (!m.done || (m.b && !m.winner)) shadowed.add(m.id);
        matches.push(m.done && (m.winner || !m.b) ? m : finish({ ...m, done: false }));
      }
      continue;
    }
    let p = plan(cfg, matches, decide, round);
    if (p.kind === 'decide') {
      decide.advanced = opts.pick(p.teams, p.spots);
      pickProjected = true;
      p = plan(cfg, matches, decide, round);
    }
    if (p.kind !== 'pairings') break;
    p.pairings.forEach((pr, i) => {
      const m = finish({ id: `proj-${round}-${i}`, stage: pr.stage, slot: pr.slot, round, a: pr.a, b: pr.b, sa: 0, sb: 0, done: false, winner: null });
      projected.add(m.id);
      matches.push(m);
    });
  }
  return { matches, projected, shadowed, decisions: decide, pickProjected };
}

// ─── Seeded RNG for simulations ─────────────────────────────────────────────

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Series simulation where the better seed is more likely to win each map. */
export function seedSim(seed: Record<string, number>, n: number, rng: () => number) {
  const str = (id: string) => (n - (seed[id] ?? n)) / Math.max(1, n - 1);
  const play = (a: string, b: string, bestOf: 3 | 5 = 3): [number, number] => {
    const p = 1 / (1 + Math.exp(-(str(a) - str(b)) * 3.2));
    const need = bestOf === 5 ? 3 : 2;
    let wa = 0;
    let wb = 0;
    while (wa < need && wb < need) { if (rng() < p) wa++; else wb++; }
    return [wa, wb];
  };
  const pick = (teams: string[], spots: number) => {
    const pool = [...teams];
    const out: string[] = [];
    while (out.length < spots && pool.length) {
      const w = pool.map(id => Math.exp(str(id) * 3));
      let x = rng() * w.reduce((s, v) => s + v, 0);
      let i = 0;
      while (x > w[i] && i < pool.length - 1) { x -= w[i]; i++; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  };
  return { play, pick };
}
