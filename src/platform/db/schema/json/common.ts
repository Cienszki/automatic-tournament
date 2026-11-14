// Pieces shared by the JSON column schemas. Every jsonb column has a zod schema; a value is parsed
// when it is read and before it is written (CONVENTIONS.md section 4). Objects are strict: an
// unknown key is refused, except where SCHEMA.md section 4 says a shape passes unknown keys on.

import { z } from 'zod';

/** An ISO 8601 time with a zone (`Z` or an offset). JSON has no date type. */
export const isoTime = z.string().datetime({ offset: true });
export const id = z.string().min(1).max(200);
export const steam64 = z.string().regex(/^\d{17}$/, 'a Steam64 id has 17 digits');
export const steam32 = z.string().regex(/^\d{1,10}$/, 'a Steam32 id has up to 10 digits');
export const bestOf = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(7)]);
export const seriesFormat = z.enum(['bo1', 'bo2', 'bo3', 'bo5']);
export const url = z.string().max(2000);

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Any value that survives a round trip through jsonb. */
export const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);
/** An object whose keys are not fixed here (its owner validates it: a job type, a page's report). */
export const jsonObject = z.record(jsonValue);
export type JsonObject = z.infer<typeof jsonObject>;
