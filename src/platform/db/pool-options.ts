// The app's connection settings, kept apart from client.ts so a test can pin them.
//
// The app reaches Supabase through its pooler in transaction mode (port 6543), which hands each
// statement to whichever server connection is free. Two consequences, both measured on staging
// (docs/overhaul/spikes/WP-06.md, "The connection hang"):
//   - no prepared statements, because the next statement may land on another server connection;
//   - no pipelining. postgres.js by default sends up to 100 queued statements down one connection
//     before the first answer is back. The pooler answers the first and loses the rest, so every
//     query beyond the pool size waited forever (a page with 10 statements and a pool of 5 hung
//     until the function's 5-minute limit). With one statement in flight per connection, 200
//     concurrent statements on 5 connections all answered in about 1 s.

import type { Options } from 'postgres';

export function poolOptions(env: { DATABASE_POOL_MAX?: string } = {}): Options<Record<string, never>> {
  return {
    prepare: false,
    max_pipeline: 1,
    max: Number(env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
  };
}
