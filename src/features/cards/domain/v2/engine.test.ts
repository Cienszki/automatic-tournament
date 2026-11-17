// WP-52: what the screen and the server rely on. A player's view hides what it must; stored
// states and submitted plans parse; the automatic and team decks; and properties that must hold
// after any round of any match.
import { describe, expect, it } from 'vitest';
import { deckKey, ROLE_KEYS } from '@/lib/card-lab/cards';
import { autoDeck } from './auto-deck';
import { makeAgent } from './ai/agents';
import { mulberry32 } from './ai/rng';
import { deckCost, deckProblem } from './deck';
import { finishRound, revealRound } from './resolve';
import { DEFAULT_RULES, makeRules } from './rules';
import { matchStateSchema, planSchema, strikesSchema } from './schema';
import { newMatch } from './setup';
import { teamDeck } from './team-deck';
import { aCard } from './testing';
import type { MatchState, Plan, Side } from './types';
import { viewFor } from './view';

const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
const deck = (tag: string) => Array.from({ length: 12 }, (_, i) => aCard({ id: `${tag}${String(i).padStart(2, '0')}`, role: ROLES[i % 5], cost: 2 + (i % 7), team: `${tag}-t${i % 3}` }));
const pool = Array.from({ length: 30 }, (_, i) => aCard({ id: `pool${i}`, role: ROLES[i % 5], cost: 3 + (i % 5) }));

/** A whole match between two random players, every state kept */
function randomMatch(seed: number): MatchState[] {
  let s = newMatch([deck('a'), deck('b')], mulberry32(seed), DEFAULT_RULES);
  const agents = [makeAgent('random', { pool, seed: seed + 1 }), makeAgent('random', { pool, seed: seed + 2 })];
  const states = [s];
  while (!s.result) {
    const plans = [0, 1].map((side) => agents[side].decide(viewFor(s, side as Side)).plan) as [Plan, Plan];
    const mid = revealRound(s, plans).state;
    s = finishRound(mid, [agents[0].strike(mid, 0), agents[1].strike(mid, 1)]).state;
    states.push(s);
  }
  return states;
}

describe('what a player sees', () => {
  it('no card id from the rival hand or deck, or from the own deck order, reaches the view', () => {
    for (const s of randomMatch(4)) {
      for (const side of [0, 1] as Side[]) {
        const v = viewFor(s, side);
        const rival = s.sides[side === 0 ? 1 : 0];
        const hiddenIds = [...rival.hand.filter((c) => !rival.known.includes(c.id)), ...rival.deck].map((c) => c.id);
        const text = JSON.stringify(v);
        for (const id of hiddenIds) expect(text.includes(`"${id}"`)).toBe(false);
        // The own deck is listed sorted, so its order says nothing about the next draw
        expect(v.deck.map((c) => c.id)).toEqual([...s.sides[side].deck].map((c) => c.id).sort());
      }
    }
  });
});

describe('schemas', () => {
  it('every state of a match parses, and so do plans and strikes', () => {
    for (const s of randomMatch(9)) expect(matchStateSchema.safeParse(JSON.parse(JSON.stringify(s))).success).toBe(true);
    expect(planSchema.safeParse([{ kind: 'play', card: 'a01', to: 2 }, { kind: 'move', unit: '0:a02', to: 0 }]).success).toBe(true);
    expect(strikesSchema.safeParse([{ at: 1, target: '1:b03' }, { at: 1, guard: '0:a03' }]).success).toBe(true);
  });
  it('refuses a malformed plan', () => {
    expect(planSchema.safeParse([{ kind: 'play', card: 'a01', to: 3 }]).success).toBe(false);
    expect(planSchema.safeParse([{ kind: 'move', unit: '0:a02', to: 0, extra: 1 }]).success).toBe(false);
    expect(planSchema.safeParse(Array.from({ length: 9 }, () => ({ kind: 'move', unit: 'x', to: 0 }))).success).toBe(false);
  });
});

describe('properties of any round', () => {
  it('random matches end, never throw, and keep capacity, hand limit and HP bookkeeping', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const states = randomMatch(seed);
      const last = states[states.length - 1];
      expect(last.result).not.toBeNull();
      expect(last.round).toBeLessThanOrEqual(DEFAULT_RULES.roundCap);
      for (const s of states) {
        for (const side of [0, 1] as Side[]) {
          expect(s.sides[side].hand.length).toBeLessThanOrEqual(DEFAULT_RULES.handMax);
          for (const at of [0, 1, 2]) expect(s.units.filter((u) => u.side === side && u.at === at).length).toBeLessThanOrEqual(DEFAULT_RULES.capacity);
          // Every card is in exactly one place
          const places = [...s.sides[side].hand, ...s.sides[side].deck, ...s.sides[side].grave, ...s.units.filter((u) => u.side === side).map((u) => u.card)];
          expect(places).toHaveLength(12);
          expect(new Set(places.map((c) => c.id)).size).toBe(12);
        }
      }
      // HP only goes down, and the loser is the one at 0 or below (or the lower one at the cap)
      for (let i = 1; i < states.length; i++) for (const side of [0, 1] as Side[]) expect(states[i].sides[side].hp).toBeLessThanOrEqual(states[i - 1].sides[side].hp);
      if (last.result!.winner !== null && last.result!.reason === 'ancient') expect(last.sides[last.result!.winner === 0 ? 1 : 0].hp).toBeLessThanOrEqual(0);
    }
  }, 60_000);
  it('the same seed and the same plans give the same match', () => {
    expect(JSON.stringify(randomMatch(13))).toBe(JSON.stringify(randomMatch(13)));
  });
});

describe('automatic deck', () => {
  const collection = Array.from({ length: 60 }, (_, i) => aCard({ id: `c${i}`, pid: `p${i % 45}`, role: ROLES[i % 5], cost: 1 + (i % 9), team: `t${i % 6}` }));
  it('is legal under the default rules and spends the budget well', () => {
    const d = autoDeck(collection, DEFAULT_RULES)!;
    expect(deckProblem(d, DEFAULT_RULES)).toBeNull();
    expect(deckCost(d, DEFAULT_RULES.costMode)).toBeGreaterThanOrEqual(DEFAULT_RULES.budget - 3);
    for (const r of ROLE_KEYS) expect(d.filter((c) => c.role === r).length).toBeLessThanOrEqual(DEFAULT_RULES.maxPerRole);
  });
  it('without a budget it is at least as strong, and still one card per player and team', () => {
    const free = autoDeck(collection, makeRules({ budget: Infinity }))!;
    expect(new Set(free.map(deckKey)).size).toBe(free.length);
    expect(deckCost(free, 'might')).toBeGreaterThanOrEqual(deckCost(autoDeck(collection, DEFAULT_RULES)!, 'might'));
  });
  it('is null when the collection cannot make a legal deck', () => {
    expect(autoDeck(collection.slice(0, 8), DEFAULT_RULES)).toBeNull();
  });
});

describe('team deck for a real round', () => {
  const card = (id: string, team: string, matchId: string, start: number, totw = false) =>
    ({ ...aCard({ id: totw ? `${id}:totw` : id, team, totw }), series: { matchId, result: '2:0', games: 2, start } });
  const cards = [
    card('x1', 'T', 'r3', 300), card('x2', 'T', 'r3', 300), card('x1', 'T', 'r3', 300, true),
    card('x3', 'T', 'r2', 200), card('x4', 'T', 'r1', 100), card('later', 'T', 'r4', 400), card('other', 'U', 'r3', 300),
  ];
  it('takes the round, then earlier series newest first, with the team-of-the-round version', () => {
    const d = teamDeck({ cards, teamId: 'T', roundMatchIds: new Set(['r3']), roundStart: 300, deckSize: 4 });
    expect(d.map((c) => c.id)).toEqual(['x1:totw', 'x2', 'x3', 'x4']);
  });
  it('repeats its own cards when it has too few, never using later series or other teams', () => {
    const d = teamDeck({ cards, teamId: 'T', roundMatchIds: new Set(['r2']), roundStart: 200, deckSize: 5 });
    expect(d.map((c) => c.id)).toEqual(['x3', 'x4', 'x3#1', 'x4#1', 'x3#2']);
    expect(new Set(d.map((c) => c.id)).size).toBe(5);
  });
  it('is empty for a team with no cards yet', () => {
    expect(teamDeck({ cards, teamId: 'V', roundMatchIds: new Set(['r1']), roundStart: 100, deckSize: 12 })).toEqual([]);
  });
});
