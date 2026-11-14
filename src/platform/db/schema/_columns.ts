// Building blocks shared by every table definition. docs/overhaul/SCHEMA.md section 1 has the rules
// they encode: tables live in the schemas `app` and `bot`, times are timestamptz, ids are text,
// enumerations are text with a CHECK constraint.

import { sql, type SQL } from 'drizzle-orm';
import { customType, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const app = pgSchema('app');
export const bot = pgSchema('bot');

/** A point in time. Never a local time and never a string. */
export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const createdAt = () => tstz('created_at').notNull().defaultNow();
export const updatedAt = () => tstz('updated_at').notNull().defaultNow();

/** Every tournament table starts with this column; it is also the first column of its primary key. */
export const tournamentIdColumn = () => text('tournament_id').notNull();

export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * `"column" in ('a', 'b')` for a CHECK constraint. Written as raw SQL on purpose: constraint
 * definitions cannot carry bind parameters, and the values are constants from this folder.
 */
export function oneOf(column: string, values: readonly (string | number)[]): SQL {
  const list = values.map((v) => (typeof v === 'number' ? String(v) : quote(v))).join(', ');
  return sql.raw(`"${column}" in (${list})`);
}

/** A Steam64 id: 17 digits. */
export const steam64Check = (column: string): SQL => sql.raw(`"${column}" ~ '^[0-9]{17}$'`);

export const BEST_OF = [1, 2, 3, 5, 7] as const;
export const POSITIONS = ['carry', 'mid', 'offlane', 'soft_support', 'hard_support'] as const;
export type Position = (typeof POSITIONS)[number];
