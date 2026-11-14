// Where the SQL migrations live, and applying them to a real PostgreSQL. Used by tests and by the
// CI and deploy steps (WP-03); the running app never migrates.

import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/** The repository's /drizzle folder. Scripts and tests run from the repository root. */
export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'drizzle');

/** Applies every pending migration to the database at `url`, as the role in the URL. */
export async function migrateDatabase(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end();
  }
}
