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
//     concurrent statements on 5 connections all answered in about 1 s. postgres.js's README says
//     the same of Supavisor before 2.10 ("hangs on pipelined queries in transaction mode").
// And a backstop: a statement that gets no answer fails after QUERY_TIMEOUT_S, and one that cannot
// get a connection after QUEUE_TIMEOUT_S, instead of holding a function (and the visitor) until the
// platform kills it. The largest read today, a tournament's stats input, takes about 55 ms.

import type { Options } from 'postgres';

/** Seconds a statement may wait and run, waiting for a connection included. */
export const QUERY_TIMEOUT_S = 10;
/** Seconds a statement may wait for a free connection. */
export const QUEUE_TIMEOUT_S = 5;

export function poolOptions(env: { DATABASE_POOL_MAX?: string } = {}): Options<Record<string, never>> {
  return {
    prepare: false,
    max_pipeline: 1,
    max: Number(env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    query_timeout: QUERY_TIMEOUT_S,
    queue_timeout: QUEUE_TIMEOUT_S,
  };
}
