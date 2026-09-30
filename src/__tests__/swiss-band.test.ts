import { describe, it, expect } from 'vitest';
import {
  generatePairings,
  computeSwissStandings,
  buildSwissHistory,
  pairKey,
  isSwissByeTeam,
  type SwissMatchResult,
} from '@/lib/swiss/pairing';
import { adviseBand, CERTAIN_WIN_GAP } from '@/lib/swiss/band-advisor';

const standingsFor = (mmr: Record<string, number>, results: SwissMatchResult[] = []) =>
  computeSwissStandings(Object.keys(mmr), results, mmr);

describe('pairing band', () => {
  it('avoids pairings outside the band when an alternative exists', () => {
    // Two tight pairs; without a band the top two by points could cross over.
    const mmr = { a: 5000, b: 5100, c: 2000, d: 2100 };
    const { pairings, bandExceeded } = generatePairings(
      standingsFor(mmr), buildSwissHistory([]), { maxMmrGap: 1000 }
    );
    const keys = pairings.map(p => pairKey(p.teamAId, p.teamBId)).sort();
    expect(keys).toEqual([pairKey('a', 'b'), pairKey('c', 'd')].sort());
    expect(bandExceeded).toEqual([]);
  });

  it('still pairs everyone when a team has nobody inside the band', () => {
    // `lonely` is 3000 from the nearest other team — no band can serve it, and
    // the round must still be playable.
    const mmr = { a: 5000, b: 5100, c: 5200, lonely: 1000 };
    const { pairings, bandExceeded, warnings } = generatePairings(
      standingsFor(mmr), buildSwissHistory([]), { maxMmrGap: 1000 }
    );
    expect(pairings.length).toBe(2);
    const everyone = pairings.flatMap(p => [p.teamAId, p.teamBId]);
    expect(new Set(everyone).size).toBe(4);
    // The breach is reported rather than hidden.
    expect(bandExceeded.length).toBe(1);
    expect(warnings.join(' ')).toContain('Poza zakresem MMR');
  });

  it('breaks the band by as little as possible when it must', () => {
    // `lonely` should be paired with the CLOSEST team, not an arbitrary one.
    const mmr = { far: 8000, mid: 5000, near: 3000, lonely: 1000 };
    const { pairings } = generatePairings(
      standingsFor(mmr), buildSwissHistory([]), { maxMmrGap: 500 }
    );
    const lonelyPair = pairings.find(p => p.teamAId === 'lonely' || p.teamBId === 'lonely')!;
    const partner = lonelyPair.teamAId === 'lonely' ? lonelyPair.teamBId : lonelyPair.teamAId;
    expect(partner).toBe('near');
  });

  it('is inert when no band is configured', () => {
    const mmr = { a: 8000, b: 1000, c: 7900, d: 1100 };
    const withoutBand = generatePairings(standingsFor(mmr), buildSwissHistory([]), {});
    expect(withoutBand.bandExceeded).toEqual([]);
    expect(withoutBand.pairings.length).toBe(2);
  });

  it('is inert when teams carry no MMR at all', () => {
    // Seeding disabled: every seedMmr is undefined, so a band cannot apply.
    const ids = ['a', 'b', 'c', 'd'];
    const st = computeSwissStandings(ids, [], {});
    const { pairings, bandExceeded } = generatePairings(st, buildSwissHistory([]), { maxMmrGap: 500 });
    expect(pairings.length).toBe(2);
    expect(bandExceeded).toEqual([]);
  });

  it('never blocks a bye', () => {
    const mmr = { a: 8000, b: 5000, c: 1000 };
    const { pairings } = generatePairings(standingsFor(mmr), buildSwissHistory([]), { maxMmrGap: 500 });
    expect(pairings.length).toBe(2);
    expect(pairings.filter(p => p.isBye).length).toBe(1);
  });

  it('keeps the band in force across later rounds, not just round 1', () => {
    // Four strong, four weak. Round 1 is played inside each cluster, so after it
    // every score group contains both strong and weak teams — exactly the
    // situation where unbanded Swiss pairs across a 3000-MMR divide purely
    // because the scores match.
    const mmr = {
      h1: 5000, h2: 5100, h3: 5200, h4: 5300,
      l1: 2000, l2: 2100, l3: 2200, l4: 2300,
    };
    const results: SwissMatchResult[] = [
      { teamAId: 'h1', teamBId: 'h2', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'h3', teamBId: 'h4', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'l1', teamBId: 'l2', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'l3', teamBId: 'l4', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const { pairings, bandExceeded } = generatePairings(
      standingsFor(mmr, results), buildSwissHistory(results), { maxMmrGap: 1000 }
    );
    expect(bandExceeded).toEqual([]);
    for (const p of pairings) {
      if (p.isBye) continue;
      expect(Math.abs(mmr[p.teamAId as keyof typeof mmr] - mmr[p.teamBId as keyof typeof mmr]))
        .toBeLessThanOrEqual(1000);
    }
  });

  it('accepts exactly one breach when the structure forces it', () => {
    // Odd-sized score groups make crossing unavoidable: after this round the
    // 2-point group is {a,c,d} and the 0-point group {b,e,f}, both odd, while
    // a-b, d-e and c-f are all blocked as consecutive rematches. Enumerating
    // every legal matching leaves exactly one pair ~3000 apart, so the engine
    // should take one breach and no more.
    const mmr = { a: 5000, b: 5100, c: 5200, d: 2000, e: 2100, f: 2200 };
    const results: SwissMatchResult[] = [
      { teamAId: 'a', teamBId: 'b', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'd', teamBId: 'e', scoreA: 2, scoreB: 0, round: 1, completed: true },
      { teamAId: 'c', teamBId: 'f', scoreA: 2, scoreB: 0, round: 1, completed: true },
    ];
    const { pairings, bandExceeded } = generatePairings(
      standingsFor(mmr, results), buildSwissHistory(results), { maxMmrGap: 1000 }
    );
    expect(pairings.length).toBe(3);
    expect(bandExceeded.length).toBe(1);
  });
});

describe('band advisor', () => {
  const mk = (vals: number[]) => vals.map((seedMmr, i) => ({ teamId: `t${i}`, seedMmr }));

  it('declines to advise on a field too small to judge', () => {
    const advice = adviseBand(mk([5000, 5100]), 4);
    expect(advice.suggested).toBeNull();
    expect(advice.options).toEqual([]);
  });

  it('suggests a narrow band for a tightly packed field', () => {
    const advice = adviseBand(mk([5000, 5050, 5100, 5150, 5200, 5250, 5300, 5350]), 4);
    expect(advice.suggested).not.toBeNull();
    expect(advice.suggested!).toBeLessThanOrEqual(1000);
  });

  it('suggests a wider band for a spread-out field', () => {
    const tight = adviseBand(mk([4000, 4100, 4200, 4300, 4400, 4500, 4600, 4700]), 4).suggested!;
    const spread = adviseBand(mk([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]), 4).suggested!;
    expect(spread).toBeGreaterThan(tight);
  });

  it('flags teams no band can help', () => {
    // 500 is 3500 from anyone else — isolated by any realistic band.
    const advice = adviseBand(mk([500, 4000, 4100, 4200, 4300, 4400]), 4);
    expect(advice.outliers.map(o => o.seedMmr)).toContain(500);
    expect(advice.outliers[0].nearestGap).toBeGreaterThan(CERTAIN_WIN_GAP);
  });

  it('reports what each band removes and allows', () => {
    const advice = adviseBand(mk([2000, 3000, 4000, 5000, 6000, 7000]), 4);
    for (const o of advice.options) {
      expect(o.pairingsAllowed).toBeGreaterThanOrEqual(0);
      expect(o.pairingsAllowed).toBeLessThanOrEqual(1);
      expect(o.stompsRemoved).toBeGreaterThanOrEqual(0);
      expect(o.stompsRemoved).toBeLessThanOrEqual(1);
    }
    // Narrower bands allow fewer pairings and remove more certain wins.
    const narrow = advice.options[0], wide = advice.options[advice.options.length - 1];
    expect(narrow.pairingsAllowed).toBeLessThanOrEqual(wide.pairingsAllowed);
    expect(narrow.stompsRemoved).toBeGreaterThanOrEqual(wide.stompsRemoved);
  });

  it('summarises the field so the organiser can sanity-check it', () => {
    const advice = adviseBand(mk([2000, 4000, 5000, 5000, 6000, 8000]), 4);
    expect(advice.fieldSummary.teams).toBe(6);
    expect(advice.fieldSummary.min).toBe(2000);
    expect(advice.fieldSummary.max).toBe(8000);
  });

  it('ignores teams with no MMR reported', () => {
    const advice = adviseBand(
      [...mk([5000, 5100, 5200, 5300]), { teamId: 'x', seedMmr: 0 }], 4
    );
    expect(advice.fieldSummary.teams).toBe(4);
  });
});
