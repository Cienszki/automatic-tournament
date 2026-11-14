// JSON columns of `app.stages` and `app.groups` (SCHEMA.md 4.6 to 4.10). The ranking and
// advancement rules here are the stored shape; the engine that applies them is WP-13a and WP-34.

import { z } from 'zod';
import { bestOf, id, isoTime } from './common';

// 4.6 Stage settings, by stage kind --------------------------------------------------------------

export const roundRobinSettingsSchema = z.object({
  legs: z.union([z.literal(1), z.literal(2)]),
  rounds: z.number().int().positive().optional(),
  promotionRelegation: z.boolean().optional(),
  matchdayLabels: z.record(z.string()).optional(),
}).strict();

export const swissSettingsSchema = z.object({
  format: z.enum(['standard', 'lan-qualifier']),
  useMmrSeeding: z.boolean(),
  pairingBand: z.number().int().positive().nullable().optional(),
  plannedRounds: z.number().int().positive().nullable().optional(),
  allowConsecutiveRematch: z.boolean(),
}).strict();

export const bracketSettingsSchema = z.object({
  type: z.enum(['single', 'double']),
  teams: z.number().int().positive(),
  upperTeams: z.number().int().min(0).optional(),
  lowerTeams: z.number().int().min(0).optional(),
  wildcardSpots: z.number().int().min(0).optional(),
  thirdPlaceMatch: z.boolean(),
  bestOf: z.object({
    default: bestOf, semifinal: bestOf.optional(), final: bestOf.optional(), grandFinal: bestOf.optional(), thirdPlace: bestOf.optional(),
  }).strict(),
  visible: z.boolean(),
}).strict();

export const stageSettingsByKind = {
  round_robin: roundRobinSettingsSchema,
  swiss: swissSettingsSchema,
  bracket: bracketSettingsSchema,
} as const;

/** The column's schema: one of the three. Commands use `stageSettingsByKind[stage.kind]`. */
export const stageSettingsSchema = z.union([roundRobinSettingsSchema, swissSettingsSchema, bracketSettingsSchema]);
export type StageSettings = z.infer<typeof stageSettingsSchema>;

// 4.7 Stage state --------------------------------------------------------------------------------

const swissStandingRow = z.object({
  teamId: id, points: z.number(), gamesWon: z.number().int(), gamesLost: z.number().int(),
  matchWins: z.number().int(), matchLosses: z.number().int(), buchholz: z.number(),
  opponentIds: z.array(id), byeCount: z.number().int(), seedMmr: z.number().optional(), seedPosition: z.number().int().optional(),
}).strict();

export const swissRoundSchema = z.object({
  round: z.number().int().positive(),
  status: z.enum(['draft', 'committed', 'complete']),
  bestOf,
  scheduling: z.object({
    mode: z.enum(['fixed', 'window', 'free']),
    times: z.array(z.union([isoTime, z.literal('')])).optional(),
    fixedAt: isoTime.optional(),
    maxHoursLater: z.number().int().min(0).nullable().optional(),
    rescheduleLatest: isoTime.nullable().optional(),
    windowStart: isoTime.optional(),
    windowEnd: isoTime.optional(),
  }).strict(),
  pairings: z.array(z.object({
    teamAId: id, teamBId: id, matchId: id, isBye: z.boolean(),
    stage: z.enum(['A', 'B', 'F', 'P']).optional(), slot: z.string().nullable().optional(),
  }).strict()),
  standingsSnapshot: z.array(swissStandingRow),
  generatedAt: isoTime,
  committedAt: isoTime.optional(),
}).strict();

/**
 * A tie the organizer settled by hand, or one a tiebreak match settled. `tieRef` names the tie (the
 * group, the places and the teams involved, as WP-13a writes it); `matches.tie_ref` uses the same
 * value for the tiebreak matches that settle it. The audit log has the same decision.
 */
export const tieDecisionSchema = z.object({
  tieRef: z.string().min(1),
  order: z.array(id).min(2),
  reason: z.string().min(1),
  decidedBy: id,
  decidedAt: isoTime,
}).strict();

export const stageStateSchema = z.object({
  tieDecisions: z.array(tieDecisionSchema),
  currentRound: z.number().int().min(0).optional(),
  byeTeamId: id.nullable().optional(),
  rounds: z.array(swissRoundSchema).optional(),
  /** LAN qualifier: the four teams of the GSL group (empty = the four best seeds) and the cut decision. */
  lanQualifier: z.object({
    groupA: z.array(id),
    advanced: z.array(id).nullable().optional(), decidedAt: isoTime.nullable().optional(), decidedBy: id.nullable().optional(),
  }).strict().optional(),
}).strict();
export type StageState = z.infer<typeof stageStateSchema>;
export const EMPTY_STAGE_STATE: StageState = { tieDecisions: [] };

// 4.8 Ranking rules: `stages.ranking` is plain JSON here. Its schema belongs to src/features/formats
// (WP-13a), which parses it; platform code may not import a feature.

export const CROSS_GROUP_RULES = [
  'points_per_match', 'game_difference_per_match', 'games_won_per_match', 'tiebreak_match', 'manual',
] as const;

// 4.9 Advancement --------------------------------------------------------------------------------

const slotRef = z.object({ stage: id, code: z.string().min(1), side: z.enum(['a', 'b']) }).strict();

export const advancementSchema = z.array(z.object({
  from: z.union([
    z.object({ group: id, place: z.number().int().positive() }).strict(),
    z.object({ place: z.number().int().positive(), best: z.number().int().positive(), by: z.array(z.enum(CROSS_GROUP_RULES)) }).strict(),
  ]),
  to: z.union([slotRef, z.literal('eliminated')]),
}).strict());
export type Advancement = z.infer<typeof advancementSchema>;

// 4.10 Group display settings --------------------------------------------------------------------

export const groupSettingsSchema = z.object({
  highlights: z.array(z.object({
    color: z.string(), count: z.number().int().positive(), from: z.enum(['top', 'bottom']),
  }).strict()).optional(),
  medalUrl: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  matchdayLabel: z.string().optional(),
  isSwissField: z.boolean().optional(),
}).strict();
