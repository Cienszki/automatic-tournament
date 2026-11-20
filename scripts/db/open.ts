// Opens the database a script works on (scripts/db/target.ts decides which one and whether it may).
// A local PGlite folder can be open in one process only, so opening it takes a lock file next to
// it; `npm run dev:local` holds the same lock while it serves the folder.

import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../../src/platform/db/schema';
import { MIGRATIONS_FOLDER } from '../../src/platform/db/migrations';
import type { Db } from '../../src/platform/db/types';
import type { DatabaseTarget } from './target';

export interface OpenDatabase {
  db: Db;
  target: DatabaseTarget;
  /** Applies every pending migration. */
  migrate(): Promise<void>;
  close(): Promise<void>;
}

const lockFile = (dataDir: string) => `${dataDir}.lock`;

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Takes the folder's lock, or throws when another live process holds it. */
export function lockLocalFolder(dataDir: string): () => void {
  const file = lockFile(dataDir);
  if (fs.existsSync(file)) {
    const pid = Number(fs.readFileSync(file, 'utf8').trim());
    if (pid && pid !== process.pid && isRunning(pid)) {
      throw new Error(`The local database is in use by process ${pid} (npm run dev:local?). Stop it first.`);
    }
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, String(process.pid));
  return () => {
    try {
      if (fs.readFileSync(file, 'utf8').trim() === String(process.pid)) fs.rmSync(file);
    } catch {
      // already gone
    }
  };
}

/** Opens a local PGlite folder (taking its lock) or a PostgreSQL connection. */
export async function openDatabase(target: DatabaseTarget): Promise<OpenDatabase> {
  if (target.kind === 'pglite') {
    const unlock = lockLocalFolder(target.dataDir);
    try {
      const client = new PGlite(target.dataDir);
      await client.waitReady;
      const db = drizzlePglite(client, { schema }) as unknown as Db;
      return {
        db,
        target,
        migrate: () => migratePglite(drizzlePglite(client), { migrationsFolder: MIGRATIONS_FOLDER }),
        close: async () => { await client.close(); unlock(); },
      };
    } catch (e) {
      unlock();
      throw e;
    }
  }
  const client = postgres(target.url, { max: 1, prepare: false, onnotice: () => {}, connect_timeout: 15 });
  const db = drizzlePostgres(client, { schema }) as unknown as Db;
  return {
    db,
    target,
    migrate: () => migratePostgres(drizzlePostgres(client), { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.end(),
  };
}

/** The database's own `environment` setting ("local", "staging", "production"), or null. */
export async function readEnvironment(db: Db): Promise<string | null> {
  try {
    const rows = await db.execute<{ value: unknown }>(
      sql`select value from app.platform_settings where key = 'environment'`,
    );
    const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: { value: unknown }[] }).rows;
    const value = list[0]?.value;
    return typeof value === 'string' ? value : null;
  } catch {
    return null; // not migrated yet
  }
}
