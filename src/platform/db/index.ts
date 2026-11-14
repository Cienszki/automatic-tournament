// platform/db: the schema, the connection, the tournament-scoped handle and ids (WP-32).
// Feature code imports from here; `testing.ts` and `migrations.ts` are for tests and scripts.

export { getDb } from './client';
export { scoped, type Scoped, type TournamentTable } from './scoped';
export { newId, ID_PATTERN } from './ids';
export type { Db } from './types';
export * from './schema';
export { jsonColumnSchemas, type JsonColumn } from './schema/json';
