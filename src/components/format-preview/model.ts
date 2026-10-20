// src/components/format-preview/model.ts
// View model of the LAN qualifier for the Swiss / Tabela / LAN views. The format itself lives in
// src/lib/lan-qualifier/engine.ts; this file turns the engine's matches into what the views draw:
//   - simulateFormat: the preview — every result simulated, browsed round by round (`after`);
//   - realFormat: a real tournament — played matches as played, scheduled ones without a score,
//     and the not-yet-created rest projected (drawn as TBD) so the chart keeps its full shape.

import {
  derive, mulberry32, pairKey, plan, project, scheduleOf, seedSim, GSL_LABEL,
  type GslSlot, type LQConfig, type LQDecisions, type LQMatch, type LQPairing, type LQStage, type Projection, type Rec,
} from '@/lib/lan-qualifier/engine';

export type { Rec };

export interface FPTeam {
  id: string;
  name: string;
  logoUrl?: string;
  /** 1 = best seed. */
  seed: number;
  seedMmr?: number;
  /** Stand-in for a team that has not registered yet. */
  placeholder?: boolean;
}

export type StageId = LQStage | 'L';
export type MatchState = 'played' | 'next' | 'future';

export interface FPMatch {
  id: string;
  stage: StageId;
  /** Global round number, 1-based; matches with the same round are played at the same time. */
  round: number;
  label?: string;
  a: string;
  /** null = bye for `a`. */
  b: string | null;
  sa: number;
  sb: number;
  /** Records inside the stage BEFORE this match. */
  recA: Rec;
  recB: Rec;
  bestOf: 3 | 5;
  /** Real tournaments: fixed state. Preview: unset, derived from the round being browsed. */
  state?: MatchState;
  /** Projected match of a real tournament: which of its two teams are already certain (shown instead of TBD). */
  known?: [boolean, boolean];
}

export interface Placement {
  place: number;
  label: string;
  teamId: string;
  /** Round after which this place is certain. */
  round: number;
  lan: boolean;
}

export interface LanConfig { semis: 3 | 5; final: 3 | 5 }

export interface FormatSim {
  teams: Record<string, FPTeam>;
  groupA: string[];
  groupB: string[];
  swissRounds: number;
  finalStart: number;
  /** Last qualifier round. */
  totalRounds: number;
  /** LAN semis and final are played in totalRounds + 1 and + 2 (preview only). */
  lastRound: number;
  matches: FPMatch[];
  gslPlacesA: string[];
  gslPlacesF: string[];
  b1: string;
  b2: string;
  tiebreakTeams: string[];
  /** The organiser's call for the last Swiss spot (null when the record alone decided). */
  tiebreak: { teams: string[]; advanced: string[]; record: Rec; round: number; decided: boolean } | null;
  restOrder: string[];
  placements: Placement[];
  /** Short outcome text for a team's last qualifier match ("LAN", "6. miejsce"). */
  outcome: Record<string, { text: string; lan: boolean; round: number }>;
  /** Preview only: the simulated LAN bracket. Real tournaments read their playoff matches. */
  lan: { seeds: string[]; semis: FPMatch[]; final: FPMatch; config: LanConfig } | null;
  /** Real tournament (states fixed per match) rather than the preview. */
  real: boolean;
}

export function matchState(m: FPMatch, after: number): MatchState {
  if (m.state) return m.state;
  if (m.round <= after) return 'played';
  if (m.round === after + 1) return 'next';
  return 'future';
}

/** Wins/losses over the qualifier matches played so far (byes count as a win). */
export function records(matches: FPMatch[], after: number): Record<string, Rec> {
  const out: Record<string, Rec> = {};
  const add = (id: string, won: boolean) => {
    const r = out[id] ?? [0, 0];
    out[id] = won ? [r[0] + 1, r[1]] : [r[0], r[1] + 1];
  };
  for (const m of matches) {
    if (m.stage === 'L' || matchState(m, after) !== 'played') continue;
    if (!m.b) { add(m.a, true); continue; }
    add(m.a, m.sa > m.sb);
    add(m.b, m.sb > m.sa);
  }
  return out;
}

/** Builds the view from a complete match list (real + simulated/projected results). */
function buildView(
  teams: Record<string, FPTeam>,
  cfg: LQConfig,
  all: LQMatch[],
  decisions: LQDecisions,
  stateOf: ((m: LQMatch) => MatchState) | null,
  pickProjected: boolean,
): Omit<FormatSim, 'lan' | 'lastRound'> {
  const d = derive(cfg, all, decisions);
  const matches: FPMatch[] = all.map(m => ({
    id: m.id,
    stage: m.stage,
    round: m.round,
    label: m.slot && m.slot !== 'tb' ? GSL_LABEL[m.slot as GslSlot] : undefined,
    a: m.a,
    b: m.b,
    sa: m.sa,
    sb: m.sb,
    recA: d.recBefore[m.id]?.[0] ?? [0, 0],
    recB: d.recBefore[m.id]?.[1] ?? [0, 0],
    bestOf: 3,
    ...(stateOf ? { state: stateOf(m) } : {}),
  }));
  const totalRounds = all.reduce((mx, m) => Math.max(mx, m.round), 0);
  const roundOf = (stage: 'A' | 'F', slot: GslSlot) => all.find(m => m.stage === stage && m.slot === slot)?.round ?? totalRounds;
  const lastRoundOf = (id: string) => all.filter(m => m.a === id || m.b === id).reduce((mx, m) => Math.max(mx, m.round), 0);

  const A = d.aPlaces as string[];
  const F = d.fPlaces as string[];
  const placeRound = [roundOf('A', 'w'), roundOf('A', 'd'), roundOf('F', 'w'), roundOf('F', 'd'), roundOf('F', 'd'), roundOf('F', 'l')];
  const placements: Placement[] = d.placements.map((p, i) => ({
    place: p.place,
    label: p.label,
    teamId: p.teamId!,
    lan: p.lan,
    round: i < 6 ? placeRound[i] : lastRoundOf(p.teamId!),
  }));

  const outcome: FormatSim['outcome'] = {};
  placements.forEach(p => {
    outcome[p.teamId] = { text: p.lan ? 'LAN' : `${p.label}. miejsce`, lan: p.lan, round: p.round };
  });

  const r = scheduleOf(cfg).r;
  return {
    teams,
    groupA: cfg.groupA,
    groupB: cfg.groupB,
    swissRounds: r,
    finalStart: d.finalStart,
    totalRounds,
    matches,
    gslPlacesA: A,
    gslPlacesF: F,
    b1: d.b1!,
    b2: d.b2!,
    tiebreakTeams: d.tie?.teams ?? [],
    tiebreak: d.tie
      ? { teams: d.tie.teams, advanced: [d.b1!, d.b2!].filter(id => d.tie!.teams.includes(id)), record: d.tie.record, round: r, decided: !pickProjected }
      : null,
    restOrder: d.restOrder,
    placements,
    outcome,
    real: !!stateOf,
  };
}

const configOf = (teamList: FPTeam[], groupA?: string[]): LQConfig => {
  const seedOf = Object.fromEntries(teamList.map(t => [t.id, t.seed]));
  const bySeed = [...teamList].sort((a, b) => a.seed - b.seed).map(t => t.id);
  const A = groupA && groupA.length === 4 && groupA.every(id => id in seedOf)
    ? [...groupA].sort((x, y) => seedOf[x] - seedOf[y])
    : bySeed.slice(0, 4);
  return { groupA: A, groupB: bySeed.filter(id => !A.includes(id)), seed: seedOf, placementRounds: 3 };
};

/** The preview: every result simulated from the seed order with a seeded RNG. */
export function simulateFormat(teamList: FPTeam[], seed: number, lanConfig: LanConfig = { semis: 3, final: 5 }): FormatSim {
  const teams: Record<string, FPTeam> = Object.fromEntries(teamList.map(t => [t.id, t]));
  const cfg = configOf(teamList);
  const sim = seedSim(cfg.seed, teamList.length, mulberry32(seed));
  const pr = project(cfg, [], {}, { play: (a, b) => sim.play(a, b), pick: sim.pick });
  const view = buildView(teams, cfg, pr.matches, pr.decisions, null, false);

  // LAN — the admin seeds it by hand; the preview uses 1–4 and 2–3 in the order above.
  const lanFour = view.placements.slice(0, 4).map(p => p.teamId);
  const mkLan = (id: string, round: number, a: string, b: string, bestOf: 3 | 5): FPMatch => {
    const [sa, sb] = sim.play(a, b, bestOf);
    return { id, stage: 'L', round, a, b, sa, sb, recA: [0, 0], recB: [0, 0], bestOf };
  };
  const s1 = mkLan('L-s1', view.totalRounds + 1, lanFour[0], lanFour[3], lanConfig.semis);
  const s2 = mkLan('L-s2', view.totalRounds + 1, lanFour[1], lanFour[2], lanConfig.semis);
  const win = (m: FPMatch) => (m.sa > m.sb ? m.a : m.b!);
  const fin = mkLan('L-f', view.totalRounds + 2, win(s1), win(s2), lanConfig.final);
  return { ...view, lastRound: view.totalRounds + 2, lan: { seeds: lanFour, semis: [s1, s2], final: fin, config: lanConfig } };
}

// ─── Teams already certain in the next round ───────────────────────────────

/** Up to 2^10 ways the open matches can end are all tried; beyond that, this many random ones. */
const EXACT_OPEN = 10;
const SAMPLES = 1024;

const recText = (r: Rec) => `${r[0]}:${r[1]}`;

/** Every `k`-team subset of `ids`. */
function subsets(ids: string[], k: number): string[][] {
  if (k === 0) return [[]];
  if (ids.length < k) return [];
  const [x, ...rest] = ids;
  return [...subsets(rest, k - 1).map(s => [x, ...s]), ...subsets(rest, k)];
}

/** Where a team plays in one version of the round: what makes two versions "the same card". */
interface Spot { stage: LQStage; slot?: string; pair: string; group: string; single: boolean }

/** Spot of each team in `pairings`; `before` are the (finished) matches before the round. */
function spots(pairings: LQPairing[], before: LQMatch[]): Map<string, Spot> {
  // Swiss records carried over B and P (byes count as a win) — the record groups the chart draws
  const rec: Record<string, Rec> = {};
  const add = (id: string, won: boolean) => {
    const r = rec[id] ?? [0, 0];
    rec[id] = won ? [r[0] + 1, r[1]] : [r[0], r[1] + 1];
  };
  for (const m of before) {
    if (!m.done || (m.stage !== 'B' && m.stage !== 'P')) continue;
    if (!m.b) { add(m.a, true); continue; }
    add(m.a, m.winner === m.a);
    add(m.b, m.winner === m.b);
  }
  const groupOf = (p: LQPairing) => {
    const ra = recText(rec[p.a] ?? [0, 0]);
    const rb = p.b ? recText(rec[p.b] ?? [0, 0]) : ra;
    return `${p.stage}|${ra === rb ? ra : `${ra} – ${rb}`}`;
  };
  const size = new Map<string, number>();
  for (const p of pairings) size.set(groupOf(p), (size.get(groupOf(p)) ?? 0) + 1);
  const out = new Map<string, Spot>();
  for (const p of pairings) {
    const spot: Spot = { stage: p.stage, slot: p.slot, pair: p.b ? pairKey(p.a, p.b) : `${p.a}|bye`, group: groupOf(p), single: size.get(groupOf(p)) === 1 };
    out.set(p.a, spot);
    if (p.b) out.set(p.b, spot);
  }
  return out;
}

/**
 * Teams of the next round — not created yet, so projected — that are already certain. The
 * round's pairings depend only on the results before it, so it is planned for every way the
 * still-open matches can end (and every pick the organiser can still make at the Swiss cut). A
 * team is shown in its projected card when it lands in that same card in all of them: the same
 * GSL slot (A / Final), or in Swiss the same pairing, or the same record group when that group is
 * a single match. Returns the known sides of each projected match of that round.
 */
function knownInNextRound(cfg: LQConfig, real: LQMatch[], decisions: LQDecisions, pr: Projection): Record<string, [boolean, boolean]> {
  const next = real.reduce((mx, m) => Math.max(mx, m.round), 0) + 1;
  const projected = pr.matches.filter(m => m.round === next && pr.projected.has(m.id));
  if (!projected.length) return {};

  // Each real match whose winner is still open (a double forfeit included, as in `project`)
  const open = real.filter(m => m.b && (!m.done || !m.winner));
  const resolve = (aWins: (i: number) => boolean) => real.map(m => {
    const i = open.indexOf(m);
    if (i >= 0) return { ...m, done: true, winner: aWins(i) ? m.a : m.b };
    return m.done ? m : { ...m, done: true, winner: m.a }; // an open bye
  });
  const outcomes: LQMatch[][] = [];
  if (open.length <= EXACT_OPEN) {
    for (let mask = 0; mask < 2 ** open.length; mask++) outcomes.push(resolve(i => !((mask >> i) & 1)));
  } else {
    const rng = mulberry32(11);
    for (let s = 0; s < SAMPLES; s++) outcomes.push(resolve(() => rng() < 0.5));
  }

  const versions: Map<string, Spot>[] = [];
  for (const ms of outcomes) {
    const p = plan(cfg, ms, decisions, next);
    const picks = p.kind === 'decide' ? subsets(p.teams, p.spots) : [null];
    for (const pick of picks) {
      const q = pick ? plan(cfg, ms, { ...decisions, advanced: pick }, next) : p;
      if (q.kind !== 'pairings') return {}; // the round's shape itself is not settled
      versions.push(spots(q.pairings, ms));
    }
  }

  const base = spots(projected, pr.matches.filter(m => m.round < next));
  const certain = (team: string) => {
    const b = base.get(team)!;
    return versions.every(v => {
      const x = v.get(team);
      if (!x || x.stage !== b.stage) return false;
      if (b.stage === 'A' || b.stage === 'F') return x.slot === b.slot;
      return x.pair === b.pair || (b.single && x.single && x.group === b.group);
    });
  };
  const out: Record<string, [boolean, boolean]> = {};
  for (const m of projected) {
    const k: [boolean, boolean] = [certain(m.a), !!m.b && certain(m.b)];
    if (k[0] || k[1]) out[m.id] = k;
  }
  return out;
}

/**
 * A real tournament: `real` are its committed matches. Whatever is not played yet is projected
 * (fixed seed, so the chart does not jump between renders) only to give the chart its shape —
 * those matches are drawn as TBD, and a projected tiebreak pick is never shown as decided.
 * Returns the view and `after`: the number of rounds that are completely played.
 */
export function realFormat(teamList: FPTeam[], groupA: string[], real: LQMatch[], decisions: LQDecisions): { sim: FormatSim; after: number } {
  const teams: Record<string, FPTeam> = Object.fromEntries(teamList.map(t => [t.id, t]));
  const cfg = configOf(teamList, groupA);
  const sim = seedSim(cfg.seed, teamList.length, mulberry32(7));
  const pr = project(cfg, real, decisions, { play: (a, b) => sim.play(a, b), pick: sim.pick });
  const stateOf = (m: LQMatch): MatchState => (pr.projected.has(m.id) ? 'future' : pr.shadowed.has(m.id) ? 'next' : 'played');
  const built = buildView(teams, cfg, pr.matches, pr.decisions, stateOf, pr.pickProjected);
  const known = knownInNextRound(cfg, real, decisions, pr);
  const view = { ...built, matches: built.matches.map(m => (known[m.id] ? { ...m, known: known[m.id] } : m)) };
  let after = 0;
  while (view.matches.some(m => m.round === after + 1) && view.matches.filter(m => m.round === after + 1).every(m => m.state === 'played')) after++;
  return { sim: { ...view, lastRound: view.totalRounds, lan: null }, after };
}
