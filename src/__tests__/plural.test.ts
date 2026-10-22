import { describe, it, expect } from 'vitest';
import { count, plural } from '@/lib/plural';
import { ACHIEVEMENTS, descOf } from '@/lib/stats-lab/achievements';

const gra = (n: number) => plural(n, 'gra', 'gry', 'gier');

describe('plural', () => {
  it('picks the Polish form for the count', () => {
    expect([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 24, 25, 102, 112, 122].map(gra)).toEqual([
      'gier', 'gra', 'gry', 'gry', 'gier', 'gier', 'gier', 'gier', 'gier', 'gry', 'gry', 'gier', 'gry', 'gier', 'gry',
    ]);
  });

  it('uses the genitive singular (the "few" form) for fractions', () => {
    expect(plural(2.5, 'zabójstwo', 'zabójstwa', 'zabójstw')).toBe('zabójstwa');
  });

  it('count prefixes the number', () => {
    expect(count(5, 'mecz', 'mecze', 'meczów')).toBe('5 meczów');
    expect(count(1, 'drużyna', 'drużyny', 'drużyn')).toBe('1 drużyna');
  });
});

describe('achievement descriptions', () => {
  it('agree with the last threshold', () => {
    const desc = (id: string) => descOf(ACHIEVEMENTS.find(a => a.id === id)!);
    expect(desc('hunter')).toBe('Co najmniej 9 / 15 / 22 zniszczone wrogie wardy');
    expect(desc('veteran')).toBe('Co najmniej 6 / 14 / 24 rozegrane gry');
    expect(desc('butcher')).toBe('Co najmniej 15 / 20 / 26 zabójstw w jednej grze');
    expect(ACHIEVEMENTS.map(descOf).every(d => !/[{}|]/.test(d))).toBe(true);
  });
});
