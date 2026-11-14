// JSON columns of the card game tables (SCHEMA.md 4.13). The game moves as it is (WP-40): the card
// and deck shapes are those of src/lib/card-lab/frozen.ts. The engine's own states (`Game`,
// `DuelView`, `PvpAction`) are checked here only as JSON objects; WP-40 replaces `engineState`
// with schemas generated from the engine's types when the engine moves to src/features/cards.

import { z } from 'zod';
import { id, isoTime, jsonObject, jsonValue } from './common';

const ROLE_KEYS = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
const ATTR_KEYS = ['WAL', 'FAR', 'ROZ', 'OBR', 'WIZ', 'DRU'] as const;

const frozenTeam = z.object({ id, name: z.string(), tag: z.string().optional(), logoUrl: z.string().optional() }).strict();

export const frozenCardSchema = z.object({
  id: z.string(),
  pid: z.string(),
  name: z.string(),
  avatar: z.string().optional(),
  team: frozenTeam.optional(),
  role: z.enum(ROLE_KEYS),
  pos: z.number().int(),
  ovr: z.number(),
  attrs: z.object(Object.fromEntries(ATTR_KEYS.map((k) => [k, z.number()])) as Record<(typeof ATTR_KEYS)[number], z.ZodNumber>).strict(),
  heroId: z.number().int(),
  series: z.object({
    matchId: z.string(), opp: frozenTeam.optional(), result: z.string(), games: z.number().int(),
    start: z.number(), label: z.string().optional(),
  }).strict(),
  standin: z.boolean(),
  totw: z.boolean(),
}).strict();
export const cardsSchema = z.array(frozenCardSchema);
export type FrozenCardRow = z.infer<typeof frozenCardSchema>;

/** Slot key (`Carry-0`, `free-3`) → card id. */
export const deckSlotsSchema = z.record(z.string());

const person = z.object({
  uid: id, name: z.string(), avatar: z.string().nullable(), rating: z.number().optional(),
}).strict();
export const duelPeopleSchema = z.object({
  host: person,
  guest: person.nullable().optional(),
  invited: person.nullable().optional(),
  players: z.tuple([person, person]).nullable().optional(),
}).strict();

export const duelResultSchema = z.object({
  winner: z.union([z.literal(0), z.literal(1)]),
  reason: z.enum(['points', 'resign', 'timeout', 'away']),
  delta: z.tuple([z.number(), z.number()]).nullable(),
  rating: z.tuple([z.number(), z.number()]).nullable(),
}).strict();

/** The engine's game state, view or move: a JSON object, validated by the engine itself. */
export const engineStateSchema = jsonObject;

export const pendingFindSchema = z.object({ id: z.string(), tournamentId: id, expiresAt: isoTime }).strict();

/** What the browser sent with a bug report, size-limited by the route as today. */
export const reportPayloadSchema = jsonValue;
