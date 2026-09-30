// src/lib/swiss/pairing.ts
//
// Swiss-system standings and pairing.
//
// Pure functions only — no Firestore, no React, no clock, no randomness. That
// keeps the whole thing unit-testable and makes every generated round
// reproducible from its inputs, which matters because a round's pairings are
// permanent once committed.
//
// The scoring rule for this platform: a team's Swiss score is the number of
// GAMES it has won, not the number of series. A 1-1 bo2 therefore awards one
// point to each side, which removes the notion of a draw entirely and gives a
// finer-grained signal for pairing than a win/loss record would.
//
// Consequence worth knowing: match format changes a round's weight. A bo1 round
// is worth at most 1 point, bo2/bo3 at most 2, bo5 at most 3. Callers should
// keep one format per round and warn when rounds differ.

import type { SwissStandingRow } from '@/types/tournament';

/**
 * Sentinel opponent used to give a team a bye when the field is odd.
 *
 * NOT named `__SWISS_BYE__` like the playoff sentinel it otherwise mirrors
 * (`BYE_TEAM_SENTINEL` in src/lib/playoff-bracket-generator.ts), because this
 * one is used as an actual Firestore DOCUMENT ID — `ensureByeTeam()` writes a
 * hidden team document under it. Firestore rejects any document id matching
 * `__.*__` as reserved, so the double-underscore form fails at write time for
 * every odd-sized field. The playoff sentinel is only ever a field value, so it
 * is unaffected.
 *
 * Must stay a legal Firestore document id — see the guard in
 * src/__tests__/swiss-pairing.test.ts.
 */
export const SWISS_BYE_TEAM_ID = 'swiss-bye';

export function isSwissByeTeam(teamId: string | null | undefined): boolean {
  return teamId === SWISS_BYE_TEAM_ID;
}

export function isSwissByeMatch(teamAId: string, teamBId: string): boolean {
  return isSwissByeTeam(teamAId) || isSwissByeTeam(teamBId);
}

/** A completed (or pending) Swiss series, flattened to what pairing needs. */
export interface SwissMatchResult {
  teamAId: string;
  teamBId: string;
  /** Games won by team A. */
  scoreA: number;
  /** Games won by team B. */
  scoreB: number;
  round: number;
  /** Only completed series contribute to points and Buchholz. */
  completed: boolean;
}

/** Derived view of who has already played whom, and who has had a bye. */
export interface SwissHistory {
  /** Opponent each team faced in `lastRound`. Absent if they did not play. */
  lastOpponent: Record<string, string | undefined>;
  /** Most recent round in which a pair met, keyed by `pairKey`. */
  lastMet: Record<string, number>;
  /** How many times a pair has met, keyed by `pairKey`. */
  meetCount: Record<string, number>;
  /** How many byes each team has received. */
  byeCount: Record<string, number>;
  /** Highest round seen. 0 when nothing has been played. */
  lastRound: number;
}

/** Order-independent key for a pair of teams. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildSwissHistory(results: SwissMatchResult[]): SwissHistory {
  const history: SwissHistory = {
    lastOpponent: {},
    lastMet: {},
    meetCount: {},
    byeCount: {},
    lastRound: 0,
  };

  for (const r of results) {
    if (r.round > history.lastRound) history.lastRound = r.round;
  }

  for (const r of results) {
    const key = pairKey(r.teamAId, r.teamBId);
    history.meetCount[key] = (history.meetCount[key] ?? 0) + 1;
    history.lastMet[key] = Math.max(history.lastMet[key] ?? 0, r.round);

    if (r.round === history.lastRound) {
      history.lastOpponent[r.teamAId] = r.teamBId;
      history.lastOpponent[r.teamBId] = r.teamAId;
    }

    // A bye is recorded against the real team, never against the sentinel.
    if (isSwissByeTeam(r.teamAId)) {
      history.byeCount[r.teamBId] = (history.byeCount[r.teamBId] ?? 0) + 1;
    } else if (isSwissByeTeam(r.teamBId)) {
      history.byeCount[r.teamAId] = (history.byeCount[r.teamAId] ?? 0) + 1;
    }
  }

  return history;
}

/**
 * Build the Swiss table.
 *
 * Two passes are required: Buchholz is the sum of each opponent's points, so
 * every team's points must be final before any Buchholz can be computed.
 *
 * Byes contribute 0 to Buchholz. Without that, facing the bye team would look
 * like facing a 0-point opponent anyway — but stating it explicitly stops a
 * future change to bye scoring from silently distorting schedule strength.
 */
export function computeSwissStandings(
  teamIds: string[],
  results: SwissMatchResult[],
  seedMmrByTeam: Record<string, number | undefined> = {}
): SwissStandingRow[] {
  const rows = new Map<string, SwissStandingRow>();

  for (const teamId of teamIds) {
    rows.set(teamId, {
      teamId,
      points: 0,
      gamesWon: 0,
      gamesLost: 0,
      matchWins: 0,
      matchLosses: 0,
      buchholz: 0,
      opponentIds: [],
      byeCount: 0,
      seedMmr: seedMmrByTeam[teamId],
    });
  }

  // Pass 1 — points, games, match record, opponents faced.
  for (const r of results) {
    if (!r.completed) continue;
    const a = rows.get(r.teamAId);
    const b = rows.get(r.teamBId);

    if (a) {
      a.gamesWon += r.scoreA;
      a.gamesLost += r.scoreB;
      a.points += r.scoreA;
      if (r.scoreA > r.scoreB) a.matchWins += 1;
      else if (r.scoreA < r.scoreB) a.matchLosses += 1;
      a.opponentIds.push(r.teamBId);
      if (isSwissByeTeam(r.teamBId)) a.byeCount += 1;
    }

    if (b) {
      b.gamesWon += r.scoreB;
      b.gamesLost += r.scoreA;
      b.points += r.scoreB;
      if (r.scoreB > r.scoreA) b.matchWins += 1;
      else if (r.scoreB < r.scoreA) b.matchLosses += 1;
      b.opponentIds.push(r.teamAId);
      if (isSwissByeTeam(r.teamAId)) b.byeCount += 1;
    }
  }

  // Pass 2 — Buchholz (schedule strength).
  for (const row of rows.values()) {
    row.buchholz = row.opponentIds.reduce((sum, oppId) => {
      if (isSwissByeTeam(oppId)) return sum;
      return sum + (rows.get(oppId)?.points ?? 0);
    }, 0);
  }

  const ordered = [...rows.values()].sort(compareForTable);
  ordered.forEach((row, i) => {
    row.seedPosition = i + 1;
  });
  return ordered;
}

/**
 * Display order for the Swiss table.
 *
 * Playoff qualification is seeded manually by an admin, so this ordering is
 * presentational — it does not decide who advances. Buchholz sits directly
 * under points because seed-adjacent pairing lets a mid-seed team accumulate a
 * high score against weak opposition, and schedule strength is what exposes it.
 */
export function compareForTable(a: SwissStandingRow, b: SwissStandingRow): number {
  // The bye sentinel always sorts last, whatever its numbers say.
  if (isSwissByeTeam(a.teamId) !== isSwissByeTeam(b.teamId)) {
    return isSwissByeTeam(a.teamId) ? 1 : -1;
  }
  if (a.points !== b.points) return b.points - a.points;
  if (a.buchholz !== b.buchholz) return b.buchholz - a.buchholz;
  if (a.matchWins !== b.matchWins) return b.matchWins - a.matchWins;

  const gdA = a.gamesWon - a.gamesLost;
  const gdB = b.gamesWon - b.gamesLost;
  if (gdA !== gdB) return gdB - gdA;

  // Final tiebreak is the team id, purely so the order is stable and
  // reproducible rather than dependent on input order.
  return a.teamId.localeCompare(b.teamId);
}

/**
 * Pairing order: points first, then seed MMR so that teams of similar declared
 * strength end up adjacent in the list and therefore get paired together.
 */
function compareForPairing(a: SwissStandingRow, b: SwissStandingRow): number {
  if (isSwissByeTeam(a.teamId) !== isSwissByeTeam(b.teamId)) {
    return isSwissByeTeam(a.teamId) ? 1 : -1;
  }
  if (a.points !== b.points) return b.points - a.points;
  const mmrA = a.seedMmr ?? 0;
  const mmrB = b.seedMmr ?? 0;
  if (mmrA !== mmrB) return mmrB - mmrA;
  return a.teamId.localeCompare(b.teamId);
}

export interface PairingWeights {
  /** Per prior meeting between the two teams. */
  rematch: number;
  /** Added for a rematch, scaled by how recently it happened. */
  rematchRecency: number;
  /** Per bye the real team has already received. */
  repeatBye: number;
  /**
   * Per point already scored by the team receiving a bye.
   *
   * Without this a bye costs nothing, so it is the cheapest possible partner for
   * whichever team the solver reaches first — the top of the table — and the
   * leader collects free points. Standard Swiss gives the bye to the LOWEST
   * ranked eligible team, and this is what pulls it down there.
   */
  byeToLeader: number;
  /** Per point of difference in Swiss score. */
  pointsGap: number;
  /** Per 100 MMR of difference in declared seed MMR. */
  mmrGap: number;
  /**
   * Flat penalty for pairing two teams further apart than the configured band.
   *
   * Deliberately a very large COST rather than a hard filter. A hard filter can
   * make a round unpairable — an isolated team may have nobody inside its band —
   * and the solver would then have to fail or fall back. As a cost, the band is
   * respected whenever it can be, quietly exceeded when it cannot, and the
   * search remains total.
   */
  bandViolation: number;
  /** Additional cost per 100 MMR beyond the band, so an unavoidable breach is
   *  as small as possible. */
  bandExcess: number;
}

export const DEFAULT_PAIRING_WEIGHTS: PairingWeights = {
  // A rematch costs roughly as much as a 6-point score gap, so the solver will
  // accept a repeat rather than create a hopeless mismatch, but not otherwise.
  rematch: 300,
  rematchRecency: 300,
  repeatBye: 800,
  // Slightly above pointsGap, so sending the bye one place further down the
  // table always beats widening a real pairing by the same margin — but well
  // under repeatBye, which still dominates.
  byeToLeader: 60,
  // Points dominate MMR by design: score is the Swiss mechanic, declared MMR is
  // only a tiebreaker for choosing among otherwise-equivalent pairings.
  pointsGap: 50,
  mmrGap: 1,
  // Larger than any realistic combination of the other costs, so the band is
  // only ever broken when there is no alternative.
  bandViolation: 5000,
  bandExcess: 20,
};

export interface PairingOptions {
  /**
   * Permit a rematch against the immediately-previous opponent. Normally false.
   * Used as an automatic fallback for the degenerate 2-team field, and exposed
   * to admins as a per-round escape hatch for tiny or heavily polarised fields.
   */
  allowConsecutiveRematch?: boolean;
  /**
   * How far down the sorted table a team may be paired. Bounds the search;
   * also encodes the intent that pairings stay local to a score group.
   */
  windowSize?: number;
  weights?: Partial<PairingWeights>;
  /**
   * Maximum MMR difference the organiser wants inside a match. null/undefined
   * disables the band entirely, which is also the right value when a tournament
   * collects no MMR at all.
   *
   * Not a hard limit: a team with nobody inside its band still gets paired, by
   * the smallest possible breach. The result reports how often that happened.
   */
  maxMmrGap?: number | null;
  /** Safety valve on the branch-and-bound search. */
  maxNodes?: number;
}

export interface SwissPairing {
  teamAId: string;
  teamBId: string;
  isBye: boolean;
}

export interface PairingResult {
  pairings: SwissPairing[];
  /** Total cost of the chosen matching. Lower is better; for diagnostics. */
  cost: number;
  /** Human-readable notes for the admin preview (rematches, byes, fallbacks). */
  warnings: string[];
  /** True when the no-consecutive-rematch rule had to be relaxed to finish. */
  relaxedConsecutiveRematch: boolean;
  /**
   * Pairings that had to exceed the configured band because the team had no
   * eligible opponent inside it. Normal for isolated teams at the very top or
   * bottom of the field; worth showing the admin rather than hiding.
   */
  bandExceeded: SwissPairing[];
}

/**
 * Generate the next round's pairings.
 *
 * ## Why this always succeeds
 *
 * The only hard constraints are (1) a perfect matching and (2) no rematch
 * against the immediately-previous round's opponent. That combination is always
 * satisfiable for a field of 4 or more:
 *
 *   K_N minus a perfect matching is (N-2)-regular. For N >= 4 that is at least
 *   N/2, so the graph is Hamiltonian by Dirac's theorem, and a Hamiltonian
 *   cycle on an even number of vertices contains a perfect matching.
 *
 * The single degenerate case is N = 2, where only one pairing exists and a
 * rematch is forced; that falls back to allowing it and reports a warning.
 * Every other preference (older rematches, repeat byes, score gap, MMR gap) is
 * a weighted cost rather than a filter, so nothing else can deadlock the search.
 *
 * Odd fields get `SWISS_BYE_TEAM_ID` injected here rather than by the caller,
 * so a caller cannot forget to do it.
 */
export function generatePairings(
  standings: SwissStandingRow[],
  history: SwissHistory,
  options: PairingOptions = {}
): PairingResult {
  const weights: PairingWeights = { ...DEFAULT_PAIRING_WEIGHTS, ...options.weights };
  const windowSize = options.windowSize ?? 8;
  const maxNodes = options.maxNodes ?? 200_000;

  const warnings: string[] = [];

  // Inject the bye sentinel for an odd field so the matcher sees an even count.
  let field = [...standings];
  const hasByeAlready = field.some(r => isSwissByeTeam(r.teamId));
  if (field.length % 2 === 1 && !hasByeAlready) {
    field.push({
      teamId: SWISS_BYE_TEAM_ID,
      points: 0,
      gamesWon: 0,
      gamesLost: 0,
      matchWins: 0,
      matchLosses: 0,
      buchholz: 0,
      opponentIds: [],
      byeCount: 0,
    });
  }

  if (field.length === 0) {
    return { pairings: [], cost: 0, warnings, relaxedConsecutiveRematch: false, bandExceeded: [] };
  }

  field = field.sort(compareForPairing);

  const attempt = (allowConsecutive: boolean) =>
    searchMatching(field, history, weights, windowSize, maxNodes, allowConsecutive, options.maxMmrGap);

  const allowConsecutive = options.allowConsecutiveRematch ?? false;
  let solution = attempt(allowConsecutive);
  let relaxed = false;

  // Only reachable for N = 2 given the proof above, but the fallback keeps the
  // function total rather than throwing in the field on some unforeseen input.
  if (!solution && !allowConsecutive) {
    solution = attempt(true);
    relaxed = true;
    if (solution) {
      warnings.push(
        'Nie da się rozstawić tej rundy bez powtórzenia pary z poprzedniej kolejki ' +
        '(zbyt mała liczba drużyn). Reguła została tymczasowo zniesiona.'
      );
    }
  }

  if (!solution) {
    return {
      pairings: [],
      cost: Infinity,
      warnings: [...warnings, 'Nie udało się wygenerować parowań dla tej rundy.'],
      relaxedConsecutiveRematch: relaxed,
      bandExceeded: [],
    };
  }

  // Describe anything the admin should look at before committing.
  for (const p of solution.pairings) {
    if (p.isBye) {
      const real = isSwissByeTeam(p.teamAId) ? p.teamBId : p.teamAId;
      const priorByes = history.byeCount[real] ?? 0;
      if (priorByes > 0) {
        warnings.push(`Drużyna ${real} otrzymuje kolejny wolny los (już ${priorByes}).`);
      }
      continue;
    }
    const key = pairKey(p.teamAId, p.teamBId);
    const met = history.meetCount[key] ?? 0;
    if (met > 0) {
      warnings.push(
        `Powtórzenie pary: ${p.teamAId} vs ${p.teamBId} (już ${met}x, ostatnio w rundzie ${history.lastMet[key]}).`
      );
    }
  }

  // Flag pairings that had to break the band, so the admin can see them rather
  // than wonder why a mismatch appeared despite the setting.
  const rowOf = new Map(field.map(r => [r.teamId, r]));
  const bandExceeded = options.maxMmrGap
    ? solution.pairings.filter(p => {
        const a = rowOf.get(p.teamAId), b = rowOf.get(p.teamBId);
        return a && b && exceedsBand(a, b, options.maxMmrGap);
      })
    : [];

  for (const p of bandExceeded) {
    const a = rowOf.get(p.teamAId)!, b = rowOf.get(p.teamBId)!;
    warnings.push(
      `Poza zakresem MMR: ${p.teamAId} vs ${p.teamBId} ` +
      `(różnica ${Math.abs((a.seedMmr ?? 0) - (b.seedMmr ?? 0))}, limit ${options.maxMmrGap}). ` +
      `Brak innego przeciwnika w zakresie.`
    );
  }

  return {
    pairings: solution.pairings,
    cost: solution.cost,
    warnings,
    relaxedConsecutiveRematch: relaxed,
    bandExceeded,
  };
}

/** True when this pairing would exceed the configured band. */
export function exceedsBand(
  a: SwissStandingRow, b: SwissStandingRow, maxMmrGap?: number | null
): boolean {
  if (!maxMmrGap) return false;
  if (isSwissByeMatch(a.teamId, b.teamId)) return false;
  const mmrA = a.seedMmr ?? 0;
  const mmrB = b.seedMmr ?? 0;
  if (mmrA <= 0 || mmrB <= 0) return false; // no MMR collected — band is meaningless
  return Math.abs(mmrA - mmrB) > maxMmrGap;
}

/** Cost of pairing two specific teams. Lower is more desirable. */
function pairCost(
  a: SwissStandingRow,
  b: SwissStandingRow,
  history: SwissHistory,
  weights: PairingWeights,
  maxMmrGap?: number | null
): number {
  const key = pairKey(a.teamId, b.teamId);
  let cost = 0;

  const met = history.meetCount[key] ?? 0;
  if (met > 0) {
    cost += weights.rematch * met;
    const roundsSince = Math.max(1, history.lastRound + 1 - (history.lastMet[key] ?? 0));
    cost += weights.rematchRecency / roundsSince;
  }

  if (isSwissByeMatch(a.teamId, b.teamId)) {
    const realRow = isSwissByeTeam(a.teamId) ? b : a;
    cost += weights.repeatBye * (history.byeCount[realRow.teamId] ?? 0);
    // Push the bye toward the bottom of the table.
    cost += weights.byeToLeader * realRow.points;
  } else {
    // Score and MMR proximity only mean something between two real teams.
    cost += weights.pointsGap * Math.abs(a.points - b.points);
    const mmrA = a.seedMmr ?? 0;
    const mmrB = b.seedMmr ?? 0;
    if (mmrA > 0 && mmrB > 0) {
      const gap = Math.abs(mmrA - mmrB);
      cost += weights.mmrGap * (gap / 100);
      if (maxMmrGap && gap > maxMmrGap) {
        cost += weights.bandViolation + weights.bandExcess * ((gap - maxMmrGap) / 100);
      }
    }
  }

  return cost;
}

/**
 * Branch-and-bound over the points-sorted field.
 *
 * Always pairs the first unpaired team, which removes the permutation symmetry
 * that would otherwise blow up the search. Candidates are tried cheapest-first
 * and bounded to `windowSize` positions ahead, so the first complete matching
 * found is already close to optimal and the bound prunes most of the rest.
 */
function searchMatching(
  field: SwissStandingRow[],
  history: SwissHistory,
  weights: PairingWeights,
  windowSize: number,
  maxNodes: number,
  allowConsecutiveRematch: boolean,
  maxMmrGap?: number | null
): { pairings: SwissPairing[]; cost: number } | null {
  const n = field.length;
  const paired = new Array<boolean>(n).fill(false);
  const chosen: Array<[number, number]> = [];

  let best: { pairings: SwissPairing[]; cost: number } | null = null;
  let nodes = 0;

  const isBlocked = (i: number, j: number): boolean => {
    if (allowConsecutiveRematch) return false;
    if (history.lastRound === 0) return false;
    return history.lastOpponent[field[i].teamId] === field[j].teamId;
  };

  const recurse = (costSoFar: number): void => {
    if (nodes++ > maxNodes) return;
    if (best && costSoFar >= best.cost) return; // bound

    let first = -1;
    for (let i = 0; i < n; i++) {
      if (!paired[i]) { first = i; break; }
    }

    if (first === -1) {
      best = {
        cost: costSoFar,
        pairings: chosen.map(([i, j]) => ({
          teamAId: field[i].teamId,
          teamBId: field[j].teamId,
          isBye: isSwissByeMatch(field[i].teamId, field[j].teamId),
        })),
      };
      return;
    }

    // Candidate partners: the next `windowSize` unpaired teams, cheapest first.
    const candidates: Array<{ j: number; cost: number }> = [];
    for (let j = first + 1; j < n && candidates.length < windowSize; j++) {
      if (paired[j]) continue;
      if (isBlocked(first, j)) continue;
      candidates.push({ j, cost: pairCost(field[first], field[j], history, weights, maxMmrGap) });
    }
    candidates.sort((x, y) => x.cost - y.cost || x.j - y.j);

    // If the window yielded nothing (everything blocked or paired), widen to the
    // whole remaining field so a legal matching is never missed on a technicality.
    if (candidates.length === 0) {
      for (let j = first + 1; j < n; j++) {
        if (paired[j] || isBlocked(first, j)) continue;
        candidates.push({ j, cost: pairCost(field[first], field[j], history, weights, maxMmrGap) });
      }
      candidates.sort((x, y) => x.cost - y.cost || x.j - y.j);
    }

    for (const { j, cost } of candidates) {
      paired[first] = true;
      paired[j] = true;
      chosen.push([first, j]);

      recurse(costSoFar + cost);

      chosen.pop();
      paired[first] = false;
      paired[j] = false;

      if (nodes > maxNodes) return;
    }
  };

  recurse(0);
  return best;
}

/**
 * Rounds needed for a Swiss field to produce a meaningful top cut.
 *
 * ceil(log2(N)) + 1 is the usual rule of thumb: enough for the field to
 * separate without so many rounds that it collapses into a round-robin. Past
 * roughly N/2 rounds, Swiss stops buying anything over a full round-robin, and
 * beyond N-1 rounds rematches are mathematically unavoidable.
 */
export function recommendedRounds(teamCount: number): number {
  if (teamCount < 2) return 0;
  return Math.ceil(Math.log2(teamCount)) + 1;
}

/** Point past which rematches become unavoidable: a team has only N-1 opponents. */
export function maxRoundsWithoutRematch(teamCount: number): number {
  return Math.max(0, teamCount - 1);
}
