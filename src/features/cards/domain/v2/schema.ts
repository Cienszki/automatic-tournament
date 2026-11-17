// Schemas for what crosses a boundary: a plan and fight choice a player submits (from the browser
// to the server), and a match state as it is stored. Parsing checks shape only; whether a plan is
// legal on the current board is `validatePlan` / `validateStrikes`.
import { z } from 'zod';

const slot = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const side = z.union([z.literal(0), z.literal(1)]);
const id = z.string().min(1).max(200);

export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('play'), card: id, to: slot, replace: id.optional() }).strict(),
  z.object({ kind: z.literal('move'), unit: id, to: slot }).strict(),
]);
/** At most a few actions: orders are 2 or 3, free moves add at most 2 */
export const planSchema = z.array(actionSchema).max(8);

export const strikeSchema = z.object({ at: slot, target: id.optional(), guard: id.optional() }).strict();
export const strikesSchema = z.array(strikeSchema).max(6);

/** A card as the engine needs it; the rest of a card (attributes, hero, series) passes through */
const cardSchema = z.object({
  id, pid: id, name: z.string(), role: z.enum(['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support']),
  pos: z.number().int(), ovr: z.number(), totw: z.boolean(), standin: z.boolean(),
  team: z.object({ id }).passthrough().optional(),
  series: z.object({ matchId: z.string(), start: z.number() }).passthrough(),
}).passthrough();

const unitSchema = z.object({
  uid: id, card: cardSchema, side, at: slot, growth: z.number().int().min(0), played: z.number().int().min(1),
  out: z.number().int().optional(), hurt: z.tuple([z.number().int(), z.number()]).optional(),
}).strict();

const sideStateSchema = z.object({
  hp: z.number().int(), hand: z.array(cardSchema), deck: z.array(cardSchema), grave: z.array(cardSchema), known: z.array(id),
}).strict();

const objective = z.enum(['roshan', 'outpost', 'lotus', 'highground', 'gates', 'tormentor']);
const controller = side.nullable();

/** A stored match state. The rules object is stored with it, so a match keeps the rules it began with. */
export const matchStateSchema = z.object({
  rules: z.object({}).passthrough(),
  round: z.number().int().min(1),
  objectives: z.tuple([objective, objective, objective]),
  control: z.tuple([controller, controller, controller]),
  units: z.array(unitSchema),
  sides: z.tuple([sideStateSchema, sideStateSchema]),
  orders: z.tuple([z.number().int(), z.number().int()]),
  result: z.object({ winner: side.nullable(), reason: z.enum(['ancient', 'cap', 'cap-objectives', 'draw']), round: z.number().int() }).strict().nullable(),
}).strict();
