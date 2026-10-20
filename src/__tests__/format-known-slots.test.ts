// The LAN-qualifier chart draws not-yet-created matches as TBD, except for the teams already
// certain to play there (src/components/format-preview/model.ts, knownInNextRound).
import { describe, expect, it } from 'vitest';
import { realFormat, type FPTeam } from '@/components/format-preview/model';
import { plan, type LQMatch } from '@/lib/lan-qualifier/engine';

const team = (i: number): FPTeam => ({ id: `t${i}`, name: `Team ${i}`, seed: i });
const field = (n: number) => Array.from({ length: n }, (_, i) => team(i + 1));

/** Round 1 as the admin panel would generate it; `results` maps a match index to its winner side. */
function roundOne(teams: FPTeam[], results: Record<number, 'a' | 'b'>): LQMatch[] {
  const ids = teams.map(t => t.id);
  const cfg = { groupA: ids.slice(0, 4), groupB: ids.slice(4), seed: Object.fromEntries(teams.map(t => [t.id, t.seed])), placementRounds: 3 };
  const p = plan(cfg, [], {}, 1);
  if (p.kind !== 'pairings') throw new Error('no round 1');
  return p.pairings.map((pr, i) => {
    const r = results[i];
    const done = !!r || !pr.b;
    const winner = !pr.b ? pr.a : r === 'a' ? pr.a : r === 'b' ? pr.b : null;
    return {
      id: `r1-${i}`, stage: pr.stage, slot: pr.slot, round: 1, a: pr.a, b: pr.b,
      sa: winner === pr.a ? 2 : 0, sb: winner === pr.b && pr.b ? 2 : 0, done, winner,
    };
  });
}

const nextRound = (teams: FPTeam[], real: LQMatch[]) => {
  const { sim } = realFormat(teams, teams.slice(0, 4).map(t => t.id), real, {});
  return sim.matches.filter(m => m.round === 2);
};

describe('teams already certain in the next round', () => {
  it('puts the winner and the loser of a finished GSL opener into their next matches', () => {
    const teams = field(10);
    // r1-0 is group A's first opener (t1–t2): t1 wins, the other opener is not played yet
    const real = roundOne(teams, { 0: 'a' });
    expect(real[0]).toMatchObject({ stage: 'A', slot: 'o1', a: 't1', b: 't2' });
    const r2 = nextRound(teams, real);
    const w = r2.find(m => m.stage === 'A' && m.label === 'Mecz zwycięzców')!;
    const l = r2.find(m => m.stage === 'A' && m.label === 'Mecz przegranych')!;
    expect(w.a).toBe('t1');
    expect(w.known).toEqual([true, false]);
    expect(l.a).toBe('t2');
    expect(l.known).toEqual([true, false]);
  });

  it('shows the whole Swiss round once every Swiss result before it is in', () => {
    const teams = field(10);
    const real = roundOne(teams, { 2: 'a', 3: 'b', 4: 'a' }); // the Swiss matches; group A still open
    const swiss = nextRound(teams, real).filter(m => m.stage === 'B');
    expect(swiss.length).toBeGreaterThan(0);
    for (const m of swiss) expect(m.known).toEqual([true, !!m.b]);
  });

  it('keeps TBD where the opponent still depends on an open match', () => {
    const teams = field(10);
    const real = roundOne(teams, { 2: 'a' }); // one Swiss result in, two open
    const open = new Set(real.filter(m => m.stage === 'B' && !m.done).flatMap(m => [m.a, m.b]));
    for (const m of nextRound(teams, real).filter(x => x.stage === 'B')) {
      if (open.has(m.a)) expect(m.known?.[0] ?? false).toBe(false);
      if (m.b && open.has(m.b)) expect(m.known?.[1] ?? false).toBe(false);
    }
  });

  it('shows nothing before any result', () => {
    const teams = field(20);
    const t0 = Date.now();
    const r2 = nextRound(teams, roundOne(teams, {}));
    expect(r2.every(m => !m.known)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
