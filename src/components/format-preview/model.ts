// src/components/format-preview/model.ts
// View model of the LAN qualifier for the Swiss / Tabela / LAN views. The format itself lives in
// src/lib/lan-qualifier/engine.ts; this file turns the engine's matches into what the views draw:
//   - simulateFormat: the preview — every result simulated, browsed round by round (`after`);
//   - realFormat: a real tournament — played matches as played, scheduled ones without a score,
//     and the not-yet-created rest projected (drawn as TBD) so the chart keeps its full shape.

import {
  derive, mulberry32, project, scheduleOf, seedSim, GSL_LABEL,
  type GslSlot, type LQConfig, type LQDecisions, type LQMatch, type LQStage, type Rec,
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
  const view = buildView(teams, cfg, pr.matches, pr.decisions, stateOf, pr.pickProjected);
  let after = 0;
  while (view.matches.some(m => m.round === after + 1) && view.matches.filter(m => m.round === after + 1).every(m => m.state === 'played')) after++;
  return { sim: { ...view, lastRound: view.totalRounds, lan: null }, after };
}
