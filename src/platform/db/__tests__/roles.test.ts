// @vitest-environment node
// What each database role may do (SCHEMA.md section 1, ADR-10). `test_anon` stands in for
// Supabase's anon and authenticated roles: a role with no grants of its own.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { targets, type RawDb } from './harness';

describe.each(targets())('roles on $name', ({ open }) => {
  let db: RawDb;
  beforeAll(async () => {
    db = await open();
    await db.query(`do $$ begin
      if not exists (select from pg_roles where rolname = 'test_anon') then create role test_anon nologin; end if;
    end $$`);
  }, 60_000);
  afterAll(() => db?.close());

  /** Runs `text` as `role`; returns the rows, or the error message. */
  async function as(role: string, text: string): Promise<{ rows?: unknown[]; error?: string }> {
    await db.query(`set role ${role}`);
    try {
      return { rows: await db.query(text) };
    } catch (e) {
      return { error: (e as Error).message };
    } finally {
      await db.query('reset role');
    }
  }

  it('lets bot_worker read and write its lobby sessions', async () => {
    expect((await as('bot_worker', `insert into bot.workers (id, version, capacity) values ('w1', '1', 2)`)).error).toBeUndefined();
    expect((await as('bot_worker', `insert into bot.lobby_sessions (id, tournament_id, match_id, request, create_lobby_at)
      values ('s1', 't1', 'm1', '{}', now())`)).error).toBeUndefined();
    expect((await as('bot_worker', `update bot.lobby_sessions set state = 'claimed', worker_id = 'w1' where id = 's1'`)).error).toBeUndefined();
    expect((await as('bot_worker', `select state from bot.lobby_sessions where id = 's1'`)).rows).toEqual([{ state: 'claimed' }]);
    expect((await as('bot_worker', `delete from bot.lobby_sessions where id = 's1'`)).error).toBeUndefined();
  });

  it('lets bot_worker insert the jobs it reports with, deduplicated, and nothing else', async () => {
    // The bot cannot read jobs: naming a conflict target (`on conflict (dedupe_key) ...`) needs SELECT
    // on that column and is refused, but a plain `on conflict do nothing` deduplicates.
    const insert = `insert into app.jobs (type, tournament_id, payload, dedupe_key) values ('import-results', 't1', '{}', 'k1')`;
    expect((await as('bot_worker', insert)).error).toBeUndefined();
    expect((await as('bot_worker', insert)).error).toMatch(/jobs_waiting_dedupe_unique/);
    expect((await as('bot_worker', `${insert} on conflict do nothing`)).error).toBeUndefined();
    expect((await as('bot_worker', `${insert} on conflict (dedupe_key) where status = 'waiting' do nothing`)).error).toMatch(/permission denied/);
    expect(await db.query(`select count(*)::int as n from app.jobs where dedupe_key = 'k1'`)).toEqual([{ n: 1 }]);
    expect((await as('bot_worker', `insert into app.jobs (type) values ('recompute')`)).error).toMatch(/row-level security/);
  });

  it('refuses bot_worker everything else in schema app', async () => {
    expect((await as('bot_worker', 'select id from app.jobs')).error).toMatch(/permission denied/);
    expect((await as('bot_worker', 'select id from app.matches')).error).toMatch(/permission denied/);
    expect((await as('bot_worker', 'select id from app.tournaments')).error).toMatch(/permission denied/);
    expect((await as('bot_worker', `update app.jobs set status = 'done'`)).error).toMatch(/permission denied/);
  });

  it('gives a role without grants nothing', async () => {
    for (const table of ['app.users', 'app.matches', 'app.jobs', 'bot.lobby_sessions', 'bot.accounts']) {
      expect((await as('test_anon', `select * from ${table}`)).error).toMatch(/permission denied/);
    }
    expect((await as('test_anon', `insert into app.jobs (type) values ('import-results')`)).error).toMatch(/permission denied/);
  });
});
