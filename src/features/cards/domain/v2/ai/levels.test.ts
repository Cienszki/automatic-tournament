import { describe, expect, it } from 'vitest';
import { validateStrikes } from '../fight';
import { validatePlan } from '../plan';
import { finishRound, revealRound } from '../resolve';
import { DEFAULT_RULES } from '../rules';
import { newMatch } from '../setup';
import { aCard } from '../testing';
import type { MatchState, Plan } from '../types';
import { viewFor } from '../view';
import { LEVELS, makeOpponent, type Opponent } from './levels';
import { mulberry32 } from './rng';

const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
const deck = (tag: string) => Array.from({ length: 12 }, (_, i) => aCard({ id: `${tag}${String(i).padStart(2, '0')}`, role: ROLES[i % 5], cost: 3 + (i % 5), team: i < 4 ? `${tag}-team` : undefined }));
const pool = Array.from({ length: 40 }, (_, i) => aCard({ id: `pool${i}`, role: ROLES[i % 5], cost: 3 + (i % 5) }));

/** Plays a whole match between two opponents; every plan and strike must be legal */
function play(a: Opponent, b: Opponent, seed: number): { state: MatchState; shortPlans: number; rounds: number } {
  let s = newMatch([deck('a'), deck('b')], mulberry32(seed), DEFAULT_RULES);
  const agents = [makeOpponent(a, { pool, seed: seed + 1 }), makeOpponent(b, { pool, seed: seed + 2 })];
  let shortPlans = 0; let rounds = 0;
  while (!s.result) {
    const plans = [0, 1].map((side) => agents[side].decide(viewFor(s, side as 0 | 1)).plan) as [Plan, Plan];
    for (const side of [0, 1] as const) {
      expect(validatePlan(s, side, plans[side])).toBeNull();
      if (plans[side].length < s.orders[side] && s.sides[side].hand.length > 0) shortPlans++;
    }
    const mid = revealRound(s, plans).state;
    const strikes = [agents[0].strike(mid, 0), agents[1].strike(mid, 1)] as const;
    for (const side of [0, 1] as const) expect(validateStrikes(mid, side, strikes[side])).toBeNull();
    s = finishRound(mid, [strikes[0], strikes[1]]).state;
    rounds++;
  }
  return { state: s, shortPlans, rounds };
}

describe('computer opponents', () => {
  it('every level plays whole matches with legal plans and legal strikes', () => {
    for (const [a, b] of [['easy', 'medium'], ['hard', 'easy'], ['kolejka', 'hard'], ['medium', 'medium']] as Array<[Opponent, Opponent]>) {
      const r = play(a, b, 7);
      expect(r.state.result).not.toBeNull();
      expect(r.rounds).toBeLessThanOrEqual(DEFAULT_RULES.roundCap);
    }
  }, 120_000);

  it('the easy level slips: over several matches it leaves orders unused that the kolejka player would use', () => {
    let easy = 0; let plain = 0;
    for (let seed = 1; seed <= 6; seed++) { easy += play('easy', 'easy', seed).shortPlans; plain += play('kolejka', 'kolejka', seed).shortPlans; }
    expect(easy).toBeGreaterThan(plain);
  }, 120_000);

  it('the same seed gives the same match', () => {
    const a = play('easy', 'hard', 3); const b = play('easy', 'hard', 3);
    expect(JSON.stringify(a.state.result)).toBe(JSON.stringify(b.state.result));
    expect(a.state.sides.map((x) => x.hp)).toEqual(b.state.sides.map((x) => x.hp));
  }, 120_000);

  it('no level answers the obvious fight, and only the easy level slips', () => {
    for (const spec of Object.values(LEVELS)) expect(spec.strikes).not.toBe('answer');
    expect(LEVELS.easy.slip).toBeGreaterThan(0);
    expect([LEVELS.medium.slip, LEVELS.hard.slip, LEVELS.kolejka.slip]).toEqual([0, 0, 0]);
  });
});
