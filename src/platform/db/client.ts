// The one way server code reaches the database (ADR-04, ADR-17). The connection string is
// DATABASE_URL: the role that ran the migrations and owns the tables (SCHEMA.md section 1). Nothing
// connects at import time; the first call opens the pool.

import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { poolOptions } from './pool-options';
import * as schema from './schema';
import type { Db } from './types';

let instance: Db | undefined;

export function getDb(): Db {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // Supabase's pooler in transaction mode: no prepared statements, no pipelining (pool-options.ts).
  const client = postgres(url, poolOptions({ DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX }));
  instance = drizzle(client, { schema });
  return instance;
}
