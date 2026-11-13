// The ranking rules a stage stores (`stages.ranking`, SCHEMA.md 4.8; ADR-11). Parsed with this
// schema when read from the database, so the standings code can trust the shape.

import { z } from 'zod';

/** Automatic tie-breakers: computed from results and team data. */
export const AUTOMATIC_TIEBREAKERS = [
  'head_to_head',
  'head_to_head_wins',
  'game_difference',
  'games_won',
  'neustadtl',
  'buchholz',
  'match_wins',
  'lower_mmr',
] as const;

/** Decision tie-breakers: they wait for the organizer (a tiebreaker match, or an order set by hand). */
export const DECISION_TIEBREAKERS = ['tiebreak_match', 'manual'] as const;

export const TIEBREAKER_IDS = [...AUTOMATIC_TIEBREAKERS, ...DECISION_TIEBREAKERS] as const;
export type TiebreakerId = (typeof TIEBREAKER_IDS)[number];
export type DecisionTiebreakerId = (typeof DECISION_TIEBREAKERS)[number];

export function isDecisionTiebreaker(id: TiebreakerId): id is DecisionTiebreakerId {
  return (DECISION_TIEBREAKERS as readonly string[]).includes(id);
}

const points = z.union([
  z.object({ win: z.number().finite(), draw: z.number().finite(), loss: z.number().finite() }).strict(),
  z.literal('games_won'),
]);

const manualOrder = z
  .object({
    /** The tied teams when the organizer decided. The order applies only to exactly this set. */
    teams: z.array(z.string().min(1)).min(2),
    order: z.array(z.string().min(1)),
    reason: z.string().min(1),
    by: z.string().min(1),
    at: z.string().min(1),
  })
  .strict()
  .refine((m) => m.order.length === m.teams.length && new Set(m.order).size === m.order.length && m.order.every((id) => m.teams.includes(id)), {
    message: 'order must list each of teams exactly once',
  });

export const rankingRulesSchema = z
  .object({
    /** Points per series result, or one point per game won (Swiss). */
    points,
    tiebreakers: z.array(z.enum(TIEBREAKER_IDS)),
    /** Ask for a tiebreaker match only when the tie decides something (WP-34 says which places do). */
    tiebreakOnlyWhenDecisive: z.boolean().optional(),
    manualOrders: z.array(manualOrder).optional(),
  })
  .strict()
  .superRefine((rules, ctx) => {
    if (new Set(rules.tiebreakers).size !== rules.tiebreakers.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tiebreakers'], message: 'a tie-breaker is listed twice' });
    }
    // An automatic rule after a decision rule could never apply: a tie that reaches a decision
    // rule waits for the organizer and is not settled silently (ADR-11).
    const firstDecision = rules.tiebreakers.findIndex(isDecisionTiebreaker);
    if (firstDecision >= 0 && rules.tiebreakers.slice(firstDecision).some((id) => !isDecisionTiebreaker(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tiebreakers'], message: 'tiebreak_match and manual must come after every automatic tie-breaker' });
    }
  });

export type RankingRules = z.infer<typeof rankingRulesSchema>;
export type PointsRule = RankingRules['points'];
export type ManualOrder = NonNullable<RankingRules['manualOrders']>[number];

export function parseRankingRules(value: unknown): RankingRules {
  return rankingRulesSchema.parse(value);
}
