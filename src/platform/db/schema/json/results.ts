// JSON columns of matches, games, performances and pick'em (SCHEMA.md 4.11, 4.12, 4.16).

import { z } from 'zod';
import { id, isoTime, jsonValue } from './common';

export const draftPenaltiesSchema = z.array(z.object({
  id: id,
  teamId: id,
  /** 1-based game numbers; empty = the whole series. */
  games: z.array(z.number().int().positive()),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reason: z.string().optional(),
  issuedAt: isoTime,
  issuedBy: id,
}).strict());

export const picksBansSchema = z.array(z.object({
  heroId: z.number().int(),
  isPick: z.boolean(),
  order: z.number().int().min(0),
  team: z.union([z.literal(0), z.literal(1)]),
}).strict());

/**
 * Everything OpenDota reports beyond the typed columns. Unknown keys pass through on purpose:
 * OpenDota adds fields, and nothing is filtered or summed on them. `missing` names the typed
 * columns that were absent from the source, so a zero there is known not to be real.
 */
export const performanceExtraSchema = z.object({
  multiKills: z.record(z.number().int().min(0)).optional(),
  role: z.string().optional(),
  level: z.number().int().optional(),
  isRadiant: z.boolean().optional(),
  missing: z.array(z.string()).optional(),
}).catchall(jsonValue);
export type PerformanceExtra = z.infer<typeof performanceExtraSchema>;

export const pickemPredictionsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('placement-baskets'),
    baskets: z.record(z.array(id)),
    /** Present in some Wiosenna entries next to the baskets; meaning unconfirmed (SCHEMA.md question 7). */
    scores: z.record(z.number()).optional(),
  }).strict(),
  z.object({
    kind: z.literal('team-scores'),
    scores: z.record(z.number()),
  }).strict(),
]);
export type PickemPredictions = z.infer<typeof pickemPredictionsSchema>;
