// Test databases. `createTestDb()` gives a test file its own in-process PostgreSQL (PGlite) with
// every migration applied, in well under a second: it starts from a copy of an already migrated
// database. The copy is made once per set of migrations and kept in the system's temp folder, named
// by a hash of the migration files, so a changed migration makes a new copy.
//
//   let t: TestDb;
//   beforeAll(async () => { t = await createTestDb(); });
//   afterAll(() => t.close());
//
// Test files that use it run in vitest's node environment (`// @vitest-environment node`).
// `realPostgresUrl()` is for the tests that also run on a real server (CI's service container).

import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import { MIGRATIONS_FOLDER } from './migrations';
import type { Db } from './types';

export interface TestDb {
  db: Db;
  /** The PGlite instance, for raw SQL (`client.query`, `client.exec`). */
  client: PGlite;
  close: () => Promise<void>;
}

function migrationsHash(): string {
  const hash = createHash('sha256');
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else hash.update(name).update(fs.readFileSync(file));
    }
  };
  walk(MIGRATIONS_FOLDER);
  return hash.digest('hex').slice(0, 16);
}

/** The migrated copy for the current migrations, made if it does not exist yet. */
export async function ensureTemplate(): Promise<string> {
  const file = path.join(os.tmpdir(), `dota2inhouse-pglite-${migrationsHash()}.tar`);
  if (fs.existsSync(file)) return file;
  const pg = new PGlite();
  await migrate(drizzle(pg), { migrationsFolder: MIGRATIONS_FOLDER });
  const dump = await pg.dumpDataDir('none');
  await pg.close();
  // Written under another name and renamed, so a parallel test file never reads half a file.
  const partial = `${file}.${randomBytes(4).toString('hex')}.partial`;
  fs.writeFileSync(partial, Buffer.from(await dump.arrayBuffer()));
  fs.renameSync(partial, file);
  return file;
}

export async function createTestDb(): Promise<TestDb> {
  const file = await ensureTemplate();
  const client = new PGlite({ loadDataDir: new Blob([fs.readFileSync(file)]) });
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as Db;
  return { db, client, close: () => client.close() };
}

/**
 * The URL of a real PostgreSQL for tests, from TEST_DATABASE_URL, or null when there is none.
 * It must point at this machine or CI's service container: tests never connect to staging or
 * production, and `.env.staging.local` is not read here.
 */
export function realPostgresUrl(): string | null {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return null;
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(host)) {
    throw new Error(`TEST_DATABASE_URL must point at a local PostgreSQL, not ${host}`);
  }
  return url;
}
