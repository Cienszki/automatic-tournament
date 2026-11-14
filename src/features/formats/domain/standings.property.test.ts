// Properties that hold for any table, checked on seeded random tables.

import { describe, expect, it } from 'vitest';
import { countsForStandings } from './series';
import { computeStandings } from './standings';
import { randomInput, seeded, shuffle } from './testing/random-table';
import type { StandingsInput } from './ranking/types';

const RUNS = 400;

function forEachSeed(check: (input: StandingsInput, seed: number) => void): void {
  for (let seed = 1; seed <= RUNS; seed++) {
    const input = randomInput(seeded(seed));
    try {
      check(input, seed);
    } catch (err) {
      throw new Error(`seed ${seed}: ${(err as Error).message}`);
    }
  }
}

describe('standings properties', () => {
  it('under 2/1/0, points add up to two per counting series between two teams of the table', () => {
    forEachSeed((input) => {
      const rules = { ...input.rules, points: { win: 2, draw: 1, loss: 0 } };
      const ids = new Set(input.teams.map((t) => t.id));
      const series = input.matches.filter((m) => countsForStandings(m) && ids.has(m.teamAId ?? '') && ids.has(m.teamBId ?? '')).length;
      const byes = input.matches.filter((m) => m.status === 'bye' && countsForStandings(m) && ids.has(m.teamAId ?? '') && m.teamBId === null).length;
      const total = computeStandings({ ...input, rules }).rows.reduce((n, r) => n + r.record.points, 0);
      // A bye is a 2:0 walkover for its one team.
      expect(total).toBe(2 * series + 2 * byes);
    });
  });

  it('does not depend on the order of teams or matches in the input', () => {
    forEachSeed((input, seed) => {
      const rnd = seeded(seed * 7919);
      const shuffled = { ...input, teams: shuffle(rnd, input.teams), matches: shuffle(rnd, input.matches) };
      expect(computeStandings(shuffled)).toEqual(computeStandings(input));
    });
  });

  it('never lets a tie-breaker reorder teams that an earlier rule separated', () => {
    forEachSeed((input) => {
      const { tiebreakers } = input.rules;
      let previous = computeStandings({ ...input, rules: { ...input.rules, tiebreakers: [] } });
      for (let k = 1; k <= tiebreakers.length; k++) {
        const next = computeStandings({ ...input, rules: { ...input.rules, tiebreakers: tiebreakers.slice(0, k) } });
        const placeBefore = new Map(previous.rows.map((r) => [r.teamId, r.place]));
        const placeAfter = new Map(next.rows.map((r) => [r.teamId, r.place]));
        for (const x of input.teams) {
          for (const y of input.teams) {
            if (placeBefore.get(x.id)! < placeBefore.get(y.id)!) expect(placeAfter.get(x.id)!).toBeLessThan(placeAfter.get(y.id)!);
          }
        }
        previous = next;
      }
    });
  });

  it('lists every team once, best first, with consistent places', () => {
    forEachSeed((input) => {
      const { rows, openTies } = computeStandings(input);
      expect(rows.map((r) => r.teamId).sort()).toEqual(input.teams.map((t) => t.id).sort());
      rows.forEach((row, i) => {
        if (i > 0) expect(row.record.points).toBeLessThanOrEqual(rows[i - 1].record.points);
        const samePlace = rows.filter((r) => r.place === row.place);
        expect(row.place).toBe(rows.indexOf(samePlace[0]) + 1);
        expect(row.sharedPlace).toBe(samePlace.length > 1);
        if (row.openTie) expect(row.openTie.teamIds).toEqual(samePlace.map((r) => r.teamId));
      });
      for (const tie of openTies) expect(tie.places.last - tie.places.first + 1).toBe(tie.teamIds.length);
    });
  });

  it('opens a tie only when a decision rule is in the rules', () => {
    forEachSeed((input) => {
      const hasDecision = input.rules.tiebreakers.some((id) => id === 'tiebreak_match' || id === 'manual');
      if (!hasDecision) expect(computeStandings(input).openTies).toEqual([]);
    });
  });
});
