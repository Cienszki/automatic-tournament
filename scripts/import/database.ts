// Opening the target database. A local database is migrated first (it is the import's own); the
// staging and production databases are migrated by their deploy step (WP-03) and only checked here.

import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '@/platform/db/schema';
import { MIGRATIONS_FOLDER, migrateDatabase } from '@/platform/db/migrations';
import type { Db } from '@/platform/db/types';
import type { Target } from './target';

export interface OpenDb {
  db: Db;
  close: () => Promise<void>;
}

export async function openTarget(target: Target): Promise<OpenDb> {
  if (target.driver === 'pglite') {
    mkdirSync(target.dir, { recursive: true });
    const client = new PGlite(target.dir);
    await migratePglite(drizzlePglite(client), { migrationsFolder: MIGRATIONS_FOLDER });
    return { db: drizzlePglite(client, { schema }) as unknown as Db, close: () => client.close() };
  }
  if (target.name === 'local') await migrateDatabase(target.url);
  const client = postgres(target.url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzlePostgres(client, { schema }) as unknown as Db;
  const [row] = await db.execute<{ ok: boolean }>(sql`select to_regclass('app.tournaments') is not null as ok`) as unknown as Array<{ ok: boolean }>;
  if (!row?.ok) {
    await client.end();
    throw new Error(`${target.name}: the schema is not there (run the migrations first)`);
  }
  return { db, close: () => client.end() };
}
