import { describe, expect, it } from 'vitest';
import { ROUND_ROBIN_DEFAULT, SWISS_DEFAULT, defaultRankingRules } from './defaults';
import { parseRankingRules, rankingRulesSchema } from './schema';

const valid = (value: unknown) => rankingRulesSchema.safeParse(value).success;

describe('ranking rules schema', () => {
  it('accepts the defaults', () => {
    expect(parseRankingRules(ROUND_ROBIN_DEFAULT)).toEqual(ROUND_ROBIN_DEFAULT);
    expect(parseRankingRules(SWISS_DEFAULT)).toEqual(SWISS_DEFAULT);
  });

  it('accepts the full shape of SCHEMA.md 4.8', () => {
    expect(valid({
      points: { win: 3, draw: 1, loss: 0 },
      tiebreakers: ['head_to_head', 'game_difference', 'neustadtl', 'tiebreak_match', 'manual'],
      tiebreakOnlyWhenDecisive: true,
      manualOrders: [{ teams: ['A', 'B'], order: ['B', 'A'], reason: 'Losowanie', by: 'user-1', at: '2026-11-13T12:00:00Z' }],
    })).toBe(true);
  });

  it('accepts no tie-breakers at all', () => {
    expect(valid({ points: 'games_won', tiebreakers: [] })).toBe(true);
  });

  it('refuses an unknown tie-breaker, an unknown key and a bad points rule', () => {
    expect(valid({ points: 'games_won', tiebreakers: ['coin_flip'] })).toBe(false);
    expect(valid({ points: 'games_won', tiebreakers: [], extra: 1 })).toBe(false);
    expect(valid({ points: { win: 2, draw: 1 }, tiebreakers: [] })).toBe(false);
    expect(valid({ points: 'series_won', tiebreakers: [] })).toBe(false);
  });

  it('refuses a tie-breaker listed twice', () => {
    expect(valid({ points: 'games_won', tiebreakers: ['buchholz', 'buchholz'] })).toBe(false);
  });

  it('refuses an automatic tie-breaker after a decision tie-breaker', () => {
    expect(valid({ points: 'games_won', tiebreakers: ['tiebreak_match', 'buchholz'] })).toBe(false);
    expect(valid({ points: 'games_won', tiebreakers: ['buchholz', 'manual', 'tiebreak_match'] })).toBe(true);
  });

  it('refuses a manual order that is not an ordering of its teams', () => {
    const rules = (order: string[]) => ({
      points: 'games_won',
      tiebreakers: ['manual'],
      manualOrders: [{ teams: ['A', 'B'], order, reason: 'r', by: 'u', at: 't' }],
    });
    expect(valid(rules(['B', 'A']))).toBe(true);
    expect(valid(rules(['A', 'A']))).toBe(false);
    expect(valid(rules(['A', 'C']))).toBe(false);
    expect(valid(rules(['A']))).toBe(false);
  });

  it('gives each stage kind its old-site default', () => {
    expect(defaultRankingRules('round_robin')).toEqual({ points: { win: 2, draw: 1, loss: 0 }, tiebreakers: ['head_to_head_wins', 'neustadtl', 'lower_mmr'] });
    expect(defaultRankingRules('swiss')).toEqual({ points: 'games_won', tiebreakers: ['buchholz', 'match_wins', 'game_difference'] });
  });
});
