import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

/**
 * A database handle: the app's connection (`getDb()`), a test database (`createTestDb()`) or a
 * transaction inside either. Query and command code takes this type, never a driver's own.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
