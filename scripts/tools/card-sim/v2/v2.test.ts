import { describe, expect, it } from 'vitest';
import { simCollection } from '@/lib/card-lab/cards';
import { baseMight } from '@/lib/card-lab/outposts';
import { deckProblem } from '@/features/cards/domain/v2/deck';
import { DEFAULT_RULES, makeRules } from '@/features/cards/domain/v2/rules';
import { aCard } from '@/features/cards/domain/v2/testing';
import { mulberry32 } from '../rng';
import { playCellGame, slugPool, type CellSpec } from './cells';
import { ARCHETYPES, buildDeck, totalCost } from './decks';
import { minimums, pick } from './pick';
import { teamDecks } from './exp/teams';

describe('deck optimiser', () => {
  it('finds the same best total as trying every deck of a small collection', () => {
    const roles = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
    const col = Array.from({ length: 9 }, (_, i) => aCard({ id: `k${i}`, role: roles[i % 5], cost: 1 + ((i * 7) % 9) }));
    const rules = { deckSize: 6, perRole: 1, budget: 25 };
    let best = -Infinity;
    for (let mask = 0; mask < 1 << col.length; mask++) {
      const d = col.filter((_, i) => mask & (1 << i));
      if (d.length === 6 && deckProblem(d, rules) === null) best = Math.max(best, d.reduce((a, c) => a + baseMight(c), 0));
    }
    const d = pick(col, rules, baseMight, minimums(1))!;
    expect(deckProblem(d, rules)).toBeNull();
    expect(d.reduce((a, c) => a + baseMight(c), 0)).toBe(best);
  });

  it('every archetype builds a legal deck from a veteran collection of both fixtures', () => {
    for (const slug of ['wiosenna', 'pdl-s2']) {
      const col = simCollection(slugPool(slug).cards, 40, mulberry32(3));
      for (const b of [...ARCHETYPES, 'random' as const]) {
        const d = buildDeck(b, col, DEFAULT_RULES, mulberry32(1))!;
        expect(deckProblem(d, DEFAULT_RULES), `${slug} ${b}`).toBeNull();
      }
      const roleSkew = buildDeck('roleSkew:Mid', col, DEFAULT_RULES)!;
      expect(roleSkew.filter((c) => c.role === 'Mid')).toHaveLength(DEFAULT_RULES.maxPerRole);
      expect(totalCost(buildDeck('best', col, makeRules({ budget: 54 }))!, DEFAULT_RULES.costMode)).toBeLessThanOrEqual(54);
    }
  }, 60_000);
});

describe('experiment cells', () => {
  it('a game is the same every time it is played from its cell and index', () => {
    const cell: CellSpec = { key: 't', slug: 'wiosenna', seed: 5, games: 2, seats: [{ agent: 'planner', deck: { kind: 'builder', builder: 'best', packs: 20 } }, { agent: 'greedy', deck: { kind: 'builder', builder: 'flat', packs: 20 } }] };
    const a = playCellGame(cell, 1); const b = playCellGame(cell, 1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.xSide).toBe(1);
  });

  it('team decks hold only the team\'s own cards, at most deckSize', () => {
    const { byId } = slugPool('pdl-s2');
    const decks = teamDecks('pdl-s2');
    expect(decks.length).toBeGreaterThan(10);
    for (const d of decks) {
      expect(d.ids.length).toBeLessThanOrEqual(12);
      expect(new Set(d.ids.map((id) => byId.get(id)!.team!.id))).toEqual(new Set([d.team]));
    }
  });
});
