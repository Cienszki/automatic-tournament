// The first match on real tournament cards: won by the intended moves, and won by random play.
import { describe, expect, it } from 'vitest';
import { makeAgent } from '@/features/cards/domain/v2/ai/agents';
import { mulberry32 } from '@/features/cards/domain/v2/ai/rng';
import { boardTargets, type Strikes } from '@/features/cards/domain/v2/fight';
import { buildFirstMatch, FIRST_MATCH_HP, FIRST_MATCH_PLAYER_HP, rivalPlan, rivalStrikes, type FirstMatch } from '@/features/cards/domain/v2/first-match';
import { validatePlan } from '@/features/cards/domain/v2/plan';
import { finishRound, revealRound } from '@/features/cards/domain/v2/resolve';
import { matchStateSchema } from '@/features/cards/domain/v2/schema';
import { strengthOf } from '@/features/cards/domain/v2/strength';
import type { MatchState, Plan } from '@/features/cards/domain/v2/types';
import { viewFor } from '@/features/cards/domain/v2/view';
import { slugPool } from './cells';

type Player = { plan(s: MatchState): Plan; strike(mid: MatchState): Strikes };

function playFirst(fm: FirstMatch, me: Player): MatchState {
  let s = fm.state;
  while (!s.result) {
    const mine = me.plan(s);
    const theirs = rivalPlan(s);
    expect(validatePlan(s, 0, mine)).toBeNull();
    expect(validatePlan(s, 1, theirs)).toBeNull();
    const mid = revealRound(s, [mine, theirs]).state;
    s = finishRound(mid, [me.strike(mid), rivalStrikes(mid)]).state;
  }
  return s;
}

/** The moves the screen's hints point at; after round 3 the plain greedy player */
function intended(fm: FirstMatch): Player {
  const greedy = makeAgent('greedy', { pool: slugPool('wiosenna').guessPool, seed: 1 });
  const { core, hardSupport, teammate } = fm.cast;
  return {
    plan(s) {
      if (s.round === 1) return [{ kind: 'play', card: core.id, to: 0 }];
      if (s.round === 2) return [{ kind: 'play', card: hardSupport.id, to: 0 }, { kind: 'play', card: teammate.id, to: 0 }];
      if (s.round === 3) return [{ kind: 'move', unit: `0:${teammate.id}`, to: 1 }];
      return greedy.decide(viewFor(s, 0)).plan;
    },
    strike(mid) {
      const hit = boardTargets(mid, 0)[0];
      const mine = boardTargets(mid, 1).sort((a, b) => strengthOf(mid, b) - strengthOf(mid, a))[0];
      return [...(hit ? [{ at: hit.at, target: hit.uid }] : []), ...(mid.round === 3 && mine ? [{ at: mine.at, guard: mine.uid }] : [])];
    },
  };
}

describe('the first match', () => {
  for (const slug of ['wiosenna', 'pdl-s2']) {
    const fm = buildFirstMatch(slugPool(slug).cards)!;

    it(`${slug}: is built with a hand of two, Ancients at ${FIRST_MATCH_PLAYER_HP} and ${FIRST_MATCH_HP}, and a rival weaker than the player`, () => {
      expect(fm).not.toBeNull();
      expect(fm.state.sides[0].hand.map((c) => c.id)).toEqual([fm.cast.core.id, fm.cast.hardSupport.id]);
      expect(fm.state.sides.map((b) => b.hp)).toEqual([FIRST_MATCH_PLAYER_HP, FIRST_MATCH_HP]);
      expect(fm.cast.teammate.team!.id).toBe(fm.cast.hardSupport.team!.id);
      const pids = new Set([...fm.state.sides[0].hand, ...fm.state.sides[0].deck].map((c) => c.pid));
      expect([...fm.state.sides[1].hand, ...fm.state.sides[1].deck].some((c) => pids.has(c.pid))).toBe(false);
    });

    it(`${slug}: a match of real cards can be stored as JSON and read back by the schema`, () => {
      const json = JSON.parse(JSON.stringify(fm.state));
      expect(matchStateSchema.safeParse(json).success).toBe(true);
      expect(JSON.stringify(json).length).toBeLessThan(60_000);
    });

    it(`${slug}: the intended moves win, by round 4`, () => {
      const end = playFirst(fm, intended(fm));
      expect(end.result!.winner).toBe(0);
      expect(end.result!.round).toBeLessThanOrEqual(4);
    });

    it(`${slug}: random legal play wins too, every time`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const random = makeAgent('random', { pool: slugPool(slug).guessPool, seed });
        const rnd = mulberry32(seed * 7);
        const end = playFirst(fm, {
          plan: (s) => random.decide(viewFor(s, 0)).plan,
          strike: (mid) => {
            const t = boardTargets(mid, 0); const g = boardTargets(mid, 1);
            const hit = t.length && rnd() < 0.7 ? t[Math.floor(rnd() * t.length)] : null;
            const guard = g.length && rnd() < 0.5 ? g[Math.floor(rnd() * g.length)] : null;
            return [...(hit ? [{ at: hit.at, target: hit.uid }] : []), ...(guard ? [{ at: guard.at, guard: guard.uid }] : [])];
          },
        });
        expect(end.result!.winner, `seed ${seed}`).toBe(0);
      }
    }, 120_000);
  }
});
