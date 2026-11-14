// Raw SQL access to a freshly migrated database, on PGlite and, when TEST_DATABASE_URL is set (CI's
// PostgreSQL service container), on a real server. The catalog and role tests run on both.

import { randomBytes } from 'crypto';
import postgres from 'postgres';
import { migrateDatabase } from '../migrations';
import { createTestDb, realPostgresUrl } from '../testing';

export interface RawDb {
  query<T = Record<string, unknown>>(text: string): Promise<T[]>;
  close(): Promise<void>;
}

async function pglite(): Promise<RawDb> {
  const t = await createTestDb();
  return {
    query: async <T>(text: string) => (await t.client.query<T>(text)).rows,
    close: t.close,
  };
}

/** A new database on the real server, migrated; dropped again by `close`. */
async function realServer(url: string): Promise<RawDb> {
  const name = `wp32_${randomBytes(6).toString('hex')}`;
  const admin = postgres(url, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const dbUrl = new URL(url);
  dbUrl.pathname = `/${name}`;
  await migrateDatabase(dbUrl.toString());
  const sql = postgres(dbUrl.toString(), { max: 1, onnotice: () => {} });
  return {
    query: async <T>(text: string) => (await sql.unsafe(text)) as unknown as T[],
    close: async () => {
      await sql.end();
      await admin.unsafe(`drop database ${name} with (force)`);
      await admin.end();
    },
  };
}

/** The databases a catalog or role test runs on. */
export function targets(): { name: string; open: () => Promise<RawDb> }[] {
  const url = realPostgresUrl();
  return [
    { name: 'PGlite', open: pglite },
    ...(url ? [{ name: 'PostgreSQL', open: () => realServer(url) }] : []),
  ];
}
