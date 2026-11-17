// The two hit variants tested after the owner asked why one card is a better target than another.
import { describe, expect, it } from 'vitest';
import { finishRound } from './resolve';
import { aBoard, aCard } from './testing';
import type { MatchEvent } from './types';

const control = (events: MatchEvent[], at: number) => events.find((e): e is Extract<MatchEvent, { kind: 'control' }> => e.kind === 'control' && e.at === at)!;

const star = aCard({ id: 'star', cost: 9 }); const small = aCard({ id: 'small', cost: 4 });
const hs = aCard({ id: 'hs', role: 'Hard Support', cost: 5, team: 't' }); const mate = aCard({ id: 'mate', cost: 4, team: 't' });
const rival = aCard({ id: 'r', cost: 9 });

describe("a hit that takes half (hitEffect 'half')", () => {
  const board = () => aBoard({ rules: { fight: 'oneStrike', hitEffect: 'half' }, units: [{ card: star, side: 0, at: 0 }, { card: small, side: 0, at: 0 }, { card: rival, side: 1, at: 0 }] });
  it('takes half the strength, rounded up, so the strongest unit is the best target', () => {
    // 9 + 4 = 13 before the fight
    expect(control(finishRound(board(), [[], [{ at: 0, target: '0:star' }]]).events, 0).power).toEqual([4 + 4, 9]);
    expect(control(finishRound(board(), [[], [{ at: 0, target: '0:small' }]]).events, 0).power).toEqual([9 + 2, 9]);
  });
});

describe('a hit that switches off what the unit gives (hitDisables)', () => {
  const board = () => aBoard({ rules: { fight: 'oneStrike', hitEffect: 3, hitDisables: true }, units: [{ card: hs, side: 0, at: 0 }, { card: mate, side: 0, at: 0 }, { card: rival, side: 1, at: 0 }] });
  it('a hit Hard Support gives no Aura to anyone, and its teammate loses the team bonus', () => {
    // Before: Hard Support 5-1 = 4, +1 Aura, +1 team = 6; mate 4, +1 Aura, +1 team = 6; total 12
    expect(control(finishRound(board(), [[], []]).events, 0).power).toEqual([12, 9]);
    // Hit on the Hard Support: it keeps the team bonus it gets from the mate (4 + 1 = 5, minus 3 = 2);
    // the mate gets neither Aura nor team bonus from it (4). Without hitDisables this would be 3 + 6 = 9.
    expect(control(finishRound(board(), [[], [{ at: 0, target: '0:hs' }]]).events, 0).power).toEqual([2 + 4, 9]);
    const plain = aBoard({ rules: { fight: 'oneStrike', hitEffect: 3 }, units: [{ card: hs, side: 0, at: 0 }, { card: mate, side: 0, at: 0 }, { card: rival, side: 1, at: 0 }] });
    expect(control(finishRound(plain, [[], [{ at: 0, target: '0:hs' }]]).events, 0).power).toEqual([3 + 6, 9]);
  });
});
