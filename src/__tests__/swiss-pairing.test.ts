import { describe, it, expect } from 'vitest';
import {
  SWISS_BYE_TEAM_ID,
  isSwissByeTeam,
  isSwissByeMatch,
  pairKey,
  buildSwissHistory,
  computeSwissStandings,
  generatePairings,
  recommendedRounds,
  maxRoundsWithoutRematch,
  type SwissMatchResult,
} from '@/lib/swiss/pairing';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random generator — the engine must stay reproducible. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

function teamIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `t${String(i + 1).padStart(2, '0')}`);
}

/** Spread seed MMR from 6000 down to 1500 so t01 is the strongest team. */
function seedMmrFor(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = 6000 - Math.round((4500 * i) / Math.max(1, ids.length - 1));
  });
  return out;
}

/**
 * Play a full Swiss tournament, resolving each series with `decide`.
 * Returns the accumulated results plus the per-round pairings.
 */
function playTournament(
  ids: string[],
  rounds: number,
  decide: (a: string, b: string, round: number) => [number, number],
  opts: { gamesPerSeries?: number } = {}
) {
  const mmr = seedMmrFor(ids);
  const results: SwissMatchResult[] = [];
  const roundPairings: Array<Array<{ teamAId: string; teamBId: string; isBye: boolean }>> = [];

  for (let round = 1; round <= rounds; round++) {
    const history = buildSwissHistory(results);
    const standings = computeSwissStandings(ids, results, mmr);
    const res = generatePairings(standings, history, {});

    expect(res.pairings.length).toBeGreaterThan(0);
    roundPairings.push(res.pairings);

    for (const p of res.pairings) {
      if (p.isBye) {
        // A bye is a walkover: the real team takes the full series.
        const real = isSwissByeTeam(p.teamAId) ? p.teamBId : p.teamAId;
        const full = opts.gamesPerSeries ?? 2;
        results.push({
          teamAId: real,
          teamBId: SWISS_BYE_TEAM_ID,
          scoreA: full,
          scoreB: 0,
          round,
          completed: true,
        });
        continue;
      }
      const [sa, sb] = decide(p.teamAId, p.teamBId, round);
      results.push({
        teamAId: p.teamAId,
        teamBId: p.teamBId,
        scoreA: sa,
        scoreB: sb,
        round,
        completed: true,
      });
    }
  }

  return { results, roundPairings, mmr };
}

/** Stronger seed (lower index in the id list) always wins 2-0. */
const strongerWins = (a: string, b: string): [number, number] =>
  a < b ? [2, 0] : [0, 2];

// ── sentinel + key helpers ───────────────────────────────────────────────────

describe('swiss bye sentinel', () => {
  it('identifies the sentinel and nothing else', () => {
    expect(isSwissByeTeam(SWISS_BYE_TEAM_ID)).toBe(true);
    expect(isSwissByeTeam('t01')).toBe(false);
    expect(isSwissByeTeam(null)).toBe(false);
    expect(isSwissByeTeam(undefined)).toBe(false);
  });

  it('detects a bye match from either side', () => {
    expect(isSwissByeMatch(SWISS_BYE_TEAM_ID, 't01')).toBe(true);
    expect(isSwissByeMatch('t01', SWISS_BYE_TEAM_ID)).toBe(true);
    expect(isSwissByeMatch('t01', 't02')).toBe(false);
  });

  it('pairKey is order independent', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
  });
});

// ── standings ────────────────────────────────────────────────────────────────

describe('computeSwissStandings', () => {
  it('scores points as games won, so a 1-1 bo2 gives each side one point', () => {
    const rows = computeSwissStandings(
      ['a', 'b'],
      [{ teamAId: 'a', teamBId: 'b', scoreA: 1, scoreB: 1, round: 1, completed: true }]
    );
    const a = rows.find(r => r.teamId === 'a')!;
    const b = rows.find(r => r.teamId === 'b')!;
    expect(a.points).toBe(1);
    expect(b.points).toBe(1);
    // A 1-1 is neither a match win nor a match loss.
    expect(a.matchWins).toBe(0);
    expect(a.matchLosses).toBe(0);
  });

  it('ignores series that are not completed', () => {
    const rows = computeSwissStandings(
      ['a', 'b'],
      [{ teamAId: 'a', teamBId: 'b', scoreA: 2, scoreB: 0, round: 1, completed: false }]
    );
    expect(rows.every(r => r.points === 0)).toBe(true);
  });

  it('lets a team lead on points with a worse match record', () => {
    // a: three 1-2 losses  => 3 points, 0 match wins
    // b: one 2-0 win + two 0-2 losses => 2 points, 1 match win
    const results: SwissMatchResult[] = [
      { teamAId: 'a', teamBId: 'x', scoreA: 1, scoreB: 2, round: 1, completed: true },
      { teamAId: 'a', teamBId: 'y', scoreA: 1, scoreB: 2, round: 2, completed: true },
      { teamAId: 'a', teamBId: 'z', scoreA: 1, scoreB: 2, round: 3, completed: true },
      { teamAId: 'b', teamBId: 'x', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'b', teamBId: 'y', scoreA: 0, scoreB: 2, round: 2, completed: true },
      { teamAId: 'b', teamBId: 'z', scoreA: 0, scoreB: 2, round: 3, completed: true },
    ];
    const rows = computeSwissStandings(['a', 'b', 'x', 'y', 'z'], results);
    const a = rows.find(r => r.teamId === 'a')!;
    const b = rows.find(r => r.teamId === 'b')!;
    expect(a.points).toBe(3);
    expect(b.points).toBe(2);
    expect(a.matchWins).toBe(0);
    expect(b.matchWins).toBe(1);
  });

  it('excludes byes from Buchholz', () => {
    const results: SwissMatchResult[] = [
      { teamAId: 'a', teamBId: SWISS_BYE_TEAM_ID, scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'b', teamBId: 'c', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const rows = computeSwissStandings(['a', 'b', 'c', SWISS_BYE_TEAM_ID], results);
    const a = rows.find(r => r.teamId === 'a')!;
    expect(a.points).toBe(2);
    expect(a.byeCount).toBe(1);
    // Its only opponent was the bye, which contributes nothing.
    expect(a.buchholz).toBe(0);
  });

  it('rewards the harder schedule via Buchholz at equal points', () => {
    // Both 'easy' and 'hard' finish on 4 points, but hard beat strong opposition.
    const results: SwissMatchResult[] = [
      // strong1/strong2 rack up points elsewhere
      { teamAId: 'strong1', teamBId: 'filler1', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'strong2', teamBId: 'filler2', scoreA: 2, scoreB: 0, round: 1, completed: true },
      // hard beats both strong teams
      { teamAId: 'hard', teamBId: 'strong1', scoreA: 2, scoreB: 0, round: 2, completed: true },
      { teamAId: 'hard', teamBId: 'strong2', scoreA: 2, scoreB: 0, round: 3, completed: true },
      // easy beats two pointless fillers
      { teamAId: 'easy', teamBId: 'filler3', scoreA: 2, scoreB: 0, round: 2, completed: true },
      { teamAId: 'easy', teamBId: 'filler4', scoreA: 2, scoreB: 0, round: 3, completed: true },
    ];
    const ids = ['hard', 'easy', 'strong1', 'strong2', 'filler1', 'filler2', 'filler3', 'filler4'];
    const rows = computeSwissStandings(ids, results);
    const hard = rows.find(r => r.teamId === 'hard')!;
    const easy = rows.find(r => r.teamId === 'easy')!;

    expect(hard.points).toBe(easy.points);
    expect(hard.buchholz).toBeGreaterThan(easy.buchholz);
    // ...and so the harder schedule ranks above.
    expect(hard.seedPosition!).toBeLessThan(easy.seedPosition!);
  });

  it('sorts the bye sentinel last regardless of its numbers', () => {
    const rows = computeSwissStandings([SWISS_BYE_TEAM_ID, 'a', 'b'], []);
    expect(rows[rows.length - 1].teamId).toBe(SWISS_BYE_TEAM_ID);
  });

  it('is stable and independent of input order', () => {
    const results: SwissMatchResult[] = [
      { teamAId: 'a', teamBId: 'b', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const one = computeSwissStandings(['a', 'b', 'c', 'd'], results).map(r => r.teamId);
    const two = computeSwissStandings(['d', 'c', 'b', 'a'], results).map(r => r.teamId);
    expect(one).toEqual(two);
  });
});

// ── round 1 seeding behaviour ────────────────────────────────────────────────

describe('round 1 pairing', () => {
  it('pairs adjacent seeds (1v2, 3v4, ...) rather than folding top vs bottom', () => {
    const ids = teamIds(16);
    const standings = computeSwissStandings(ids, [], seedMmrFor(ids));
    const { pairings } = generatePairings(standings, buildSwissHistory([]), {});

    const asPairs = pairings.map(p => [p.teamAId, p.teamBId].sort().join('-')).sort();
    expect(asPairs).toEqual([
      't01-t02', 't03-t04', 't05-t06', 't07-t08',
      't09-t10', 't11-t12', 't13-t14', 't15-t16',
    ].sort());
  });

  it('keeps MMR gaps far smaller than a fold pairing would', () => {
    const ids = teamIds(16);
    const mmr = seedMmrFor(ids);
    const standings = computeSwissStandings(ids, [], mmr);
    const { pairings } = generatePairings(standings, buildSwissHistory([]), {});

    const avgGap =
      pairings.reduce((s, p) => s + Math.abs(mmr[p.teamAId] - mmr[p.teamBId]), 0) /
      pairings.length;

    // Fold pairing (1v9, 2v10, ...) would average 8 seed steps = 2400 MMR here.
    const foldGap =
      Array.from({ length: 8 }, (_, i) =>
        Math.abs(mmr[ids[i]] - mmr[ids[i + 8]])
      ).reduce((a, b) => a + b, 0) / 8;

    expect(avgGap).toBeLessThan(foldGap / 4);
  });
});

// ── the hard constraint: no consecutive rematch ───────────────────────────────

describe('no-consecutive-rematch constraint', () => {
  it('never repeats the previous round pair, across many field sizes and results', () => {
    for (const n of [4, 6, 8, 9, 12, 16, 17, 24, 25, 32]) {
      for (const seed of [1, 7, 99]) {
        const rng = makeRng(seed);
        const ids = teamIds(n);
        const { roundPairings } = playTournament(ids, 8, (a, b) =>
          rng() < 0.5 ? [2, 0] : [0, 2]
        );

        for (let r = 1; r < roundPairings.length; r++) {
          const prev = new Set(
            roundPairings[r - 1].map(p => pairKey(p.teamAId, p.teamBId))
          );
          for (const p of roundPairings[r]) {
            expect(
              prev.has(pairKey(p.teamAId, p.teamBId)),
              `n=${n} seed=${seed} round=${r + 1}: ${p.teamAId} vs ${p.teamBId} repeated consecutively`
            ).toBe(false);
          }
        }
      }
    }
  });

  it('returns a complete matching for every field size, odd or even', () => {
    for (let n = 4; n <= 32; n++) {
      const ids = teamIds(n);
      const standings = computeSwissStandings(ids, [], seedMmrFor(ids));
      const { pairings, warnings } = generatePairings(standings, buildSwissHistory([]), {});

      const expectedPairs = Math.ceil(n / 2);
      expect(pairings.length, `n=${n}`).toBe(expectedPairs);

      // Every real team appears exactly once.
      const seen = pairings.flatMap(p => [p.teamAId, p.teamBId]).filter(id => !isSwissByeTeam(id));
      expect(new Set(seen).size, `n=${n}`).toBe(n);

      // Odd fields get exactly one bye, even fields get none.
      expect(pairings.filter(p => p.isBye).length, `n=${n}`).toBe(n % 2 === 1 ? 1 : 0);
      expect(warnings.some(w => w.includes('Nie udało się'))).toBe(false);
    }
  });

  it('still pairs a heavily polarised field legally', () => {
    // Two runaway leaders and two teams with nothing, having just played each other.
    const ids = ['lead1', 'lead2', 'tail1', 'tail2'];
    const results: SwissMatchResult[] = [
      { teamAId: 'lead1', teamBId: 'lead2', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'tail1', teamBId: 'tail2', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const standings = computeSwissStandings(ids, results, {
      lead1: 6000, lead2: 5800, tail1: 2000, tail2: 1800,
    });
    const { pairings } = generatePairings(standings, buildSwissHistory(results), {});

    expect(pairings.length).toBe(2);
    const keys = pairings.map(p => pairKey(p.teamAId, p.teamBId));
    // Forced to cross the gap, exactly as the rule intends.
    expect(keys).not.toContain(pairKey('lead1', 'lead2'));
    expect(keys).not.toContain(pairKey('tail1', 'tail2'));
  });

  it('degrades gracefully for the 2-team field where a rematch is unavoidable', () => {
    const results: SwissMatchResult[] = [
      { teamAId: 'a', teamBId: 'b', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const standings = computeSwissStandings(['a', 'b'], results, { a: 5000, b: 4000 });
    const res = generatePairings(standings, buildSwissHistory(results), {});

    expect(res.pairings.length).toBe(1);
    expect(res.relaxedConsecutiveRematch).toBe(true);
    expect(res.warnings.join(' ')).toContain('zniesiona');
  });

  // allowConsecutiveRematch PERMITS a repeat, it does not PREFER one. The rematch
  // penalty (~600) dwarfs any realistic MMR gap cost (1 per 100 MMR), so a
  // cross-score pairing always wins on cost. The flag therefore only matters
  // where no legal alternative exists; an admin who genuinely wants a specific
  // rematch uses the manual swap in the round preview instead.
  it('allowConsecutiveRematch removes the hard block rather than forcing a repeat', () => {
    const results: SwissMatchResult[] = [
      { teamAId: 'a', teamBId: 'b', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const standings = computeSwissStandings(['a', 'b'], results, { a: 5000, b: 4000 });

    // Without the flag, the 2-team field needs the automatic fallback.
    const blocked = generatePairings(standings, buildSwissHistory(results), {});
    expect(blocked.relaxedConsecutiveRematch).toBe(true);

    // With the flag, the same pairing is legal outright — no fallback needed.
    const allowed = generatePairings(standings, buildSwissHistory(results), {
      allowConsecutiveRematch: true,
    });
    expect(allowed.pairings.length).toBe(1);
    expect(allowed.relaxedConsecutiveRematch).toBe(false);
    expect(pairKey(allowed.pairings[0].teamAId, allowed.pairings[0].teamBId)).toBe(pairKey('a', 'b'));
  });

  it('does not repeat last round even when the rematch is permitted, if an alternative exists', () => {
    const results: SwissMatchResult[] = [
      { teamAId: 'a', teamBId: 'b', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'c', teamBId: 'd', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const standings = computeSwissStandings(['a', 'b', 'c', 'd'], results, {
      a: 6000, b: 5900, c: 2000, d: 1900,
    });
    const res = generatePairings(standings, buildSwissHistory(results), {
      allowConsecutiveRematch: true,
    });
    const keys = res.pairings.map(p => pairKey(p.teamAId, p.teamBId));
    // Equal-points pairings (a/c on 2, b/d on 0) beat the cheap-MMR rematches.
    expect(keys).not.toContain(pairKey('a', 'b'));
    expect(keys).not.toContain(pairKey('c', 'd'));
    expect(keys.sort()).toEqual([pairKey('a', 'c'), pairKey('b', 'd')].sort());
  });
});

// ── byes ─────────────────────────────────────────────────────────────────────

describe('bye handling', () => {
  it('does not give the same team two byes in a row', () => {
    const ids = teamIds(7);
    const { roundPairings } = playTournament(ids, 6, strongerWins);

    for (let r = 1; r < roundPairings.length; r++) {
      const prevBye = roundPairings[r - 1].find(p => p.isBye);
      const thisBye = roundPairings[r].find(p => p.isBye);
      if (!prevBye || !thisBye) continue;
      const prevTeam = isSwissByeTeam(prevBye.teamAId) ? prevBye.teamBId : prevBye.teamAId;
      const thisTeam = isSwissByeTeam(thisBye.teamAId) ? thisBye.teamBId : thisBye.teamAId;
      expect(thisTeam, `round ${r + 1} repeated the bye`).not.toBe(prevTeam);
    }
  });

  it('spreads byes across the field rather than parking them on one team', () => {
    const ids = teamIds(9);
    const { results } = playTournament(ids, 6, strongerWins);
    const history = buildSwissHistory(results);
    const counts = ids.map(id => history.byeCount[id] ?? 0);

    expect(counts.reduce((a, b) => a + b, 0)).toBe(6); // one per round
    // No single team absorbs most of them.
    expect(Math.max(...counts)).toBeLessThanOrEqual(3);
  });
});

// ── cost behaviour ───────────────────────────────────────────────────────────

describe('pairing cost', () => {
  it('produces tighter point gaps than random pairing would', () => {
    const rng = makeRng(2024);
    const ids = teamIds(16);
    const mmr = seedMmrFor(ids);
    const { results } = playTournament(ids, 3, (a, b) => (rng() < 0.5 ? [2, 0] : [0, 2]));

    const standings = computeSwissStandings(ids, results, mmr);
    const { pairings } = generatePairings(standings, buildSwissHistory(results), {});

    const pointsOf = new Map(standings.map(r => [r.teamId, r.points]));
    const actualGap =
      pairings.reduce((s, p) => s + Math.abs(pointsOf.get(p.teamAId)! - pointsOf.get(p.teamBId)!), 0) /
      pairings.length;

    // Random pairing baseline: mean absolute difference over all distinct pairs.
    let total = 0;
    let count = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        total += Math.abs(pointsOf.get(ids[i])! - pointsOf.get(ids[j])!);
        count++;
      }
    }
    const randomGap = total / count;

    expect(actualGap).toBeLessThan(randomGap);
  });

  it('prefers a similar-MMR opponent when points are equal', () => {
    // All four on 0 points, so only MMR can distinguish the pairings.
    const ids = ['hi1', 'hi2', 'lo1', 'lo2'];
    const standings = computeSwissStandings(ids, [], {
      hi1: 6000, hi2: 5900, lo1: 2000, lo2: 1900,
    });
    const { pairings } = generatePairings(standings, buildSwissHistory([]), {});
    const keys = pairings.map(p => pairKey(p.teamAId, p.teamBId));
    expect(keys).toContain(pairKey('hi1', 'hi2'));
    expect(keys).toContain(pairKey('lo1', 'lo2'));
  });

  it('is deterministic for identical input', () => {
    const ids = teamIds(16);
    const mmr = seedMmrFor(ids);
    const standings = computeSwissStandings(ids, [], mmr);
    const a = generatePairings(standings, buildSwissHistory([]), {});
    const b = generatePairings(standings, buildSwissHistory([]), {});
    expect(a.pairings).toEqual(b.pairings);
    expect(a.cost).toBe(b.cost);
  });

  it('warns when it has to repeat an older pair', () => {
    // 4 teams over 4 rounds exhausts the 3 distinct opponents each has.
    const ids = teamIds(4);
    const { results } = playTournament(ids, 3, strongerWins);
    const standings = computeSwissStandings(ids, results, seedMmrFor(ids));
    const res = generatePairings(standings, buildSwissHistory(results), {});
    expect(res.pairings.length).toBe(2);
    expect(res.warnings.join(' ')).toContain('Powtórzenie pary');
  });
});

// ── round-count guidance ─────────────────────────────────────────────────────

describe('round recommendations', () => {
  it('recommends ceil(log2 N) + 1', () => {
    expect(recommendedRounds(8)).toBe(4);
    expect(recommendedRounds(16)).toBe(5);
    expect(recommendedRounds(24)).toBe(6);
    expect(recommendedRounds(32)).toBe(6);
    expect(recommendedRounds(1)).toBe(0);
  });

  it('reports when rematches become unavoidable', () => {
    expect(maxRoundsWithoutRematch(16)).toBe(15);
    expect(maxRoundsWithoutRematch(2)).toBe(1);
  });
});
