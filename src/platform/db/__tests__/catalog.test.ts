// @vitest-environment node
// The schema rules of SCHEMA.md section 1, checked on the migrated database's catalog.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { targets, type RawDb } from './harness';

/** Tables of schema `app` that do not belong to one tournament (SCHEMA.md section 1). */
const GLOBAL_TABLES = [
  'users', 'user_links', 'players', 'organizations', 'organization_members', 'series', 'domains', 'audit_log',
  'jobs', 'rate_limits', 'inbox', 'dm_log', 'platform_settings', 'card_activity',
];

interface TableRow { schema: string; table: string; rls: boolean }
interface PkRow { schema: string; table: string; first: string }
interface FkRow { name: string; from_table: string; to_table: string; from_cols: string[]; to_cols: string[] }

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v : String(v).replace(/^\{|\}$/g, '').split(','));

describe.each(targets())('schema catalog on $name', ({ open }) => {
  let db: RawDb;
  let tables: TableRow[];
  beforeAll(async () => {
    db = await open();
    tables = await db.query<TableRow>(`
      select n.nspname as schema, c.relname as "table", c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema', 'drizzle')
        and n.nspname not like 'pg_toast%'`);
  }, 60_000);
  afterAll(() => db?.close());

  it('has the 50 tables of SCHEMA.md, none outside schemas app and bot', () => {
    expect(tables.filter((t) => t.schema !== 'app' && t.schema !== 'bot')).toEqual([]);
    expect(tables.filter((t) => t.schema === 'app')).toHaveLength(47);
    expect(tables.filter((t) => t.schema === 'bot')).toHaveLength(3);
  });

  it('enables row-level security on every table', () => {
    expect(tables.filter((t) => !t.rls).map((t) => `${t.schema}.${t.table}`)).toEqual([]);
  });

  it('lists only existing tables as global', () => {
    const app = new Set(tables.filter((t) => t.schema === 'app').map((t) => t.table));
    expect(GLOBAL_TABLES.filter((t) => !app.has(t))).toEqual([]);
  });

  it('starts the primary key of every tournament table with tournament_id', async () => {
    const pks = await db.query<PkRow>(`
      select n.nspname as schema, c.relname as "table", a.attname as first
      from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
      where k.contype = 'p' and n.nspname in ('app', 'bot')`);
    expect(pks).toHaveLength(tables.length);
    const wrong = pks.filter((p) => p.schema === 'app' && !GLOBAL_TABLES.includes(p.table) && p.table !== 'tournaments' && p.first !== 'tournament_id');
    expect(wrong.map((p) => p.table)).toEqual([]);
  });

  it('includes tournament_id in every foreign key between two tournament tables', async () => {
    const fks = await db.query<FkRow>(`
      select k.conname as name, c.relname as from_table, f.relname as to_table,
        array(select a.attname::text from unnest(k.conkey) with ordinality u(n, i)
              join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.n order by u.i) as from_cols,
        array(select a.attname::text from unnest(k.confkey) with ordinality u(n, i)
              join pg_attribute a on a.attrelid = k.confrelid and a.attnum = u.n order by u.i) as to_cols
      from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_class f on f.oid = k.confrelid
      join pg_namespace n on n.oid = c.relnamespace
      where k.contype = 'f' and n.nspname = 'app'`);
    const tournamentTable = (t: string) => !GLOBAL_TABLES.includes(t) && t !== 'tournaments';
    const between = fks.filter((f) => tournamentTable(f.from_table) && tournamentTable(f.to_table));
    expect(between.length).toBeGreaterThan(30);
    const bad = between.filter((f) => {
      const from = asArray(f.from_cols);
      const to = asArray(f.to_cols);
      const i = from.indexOf('tournament_id');
      return i < 0 || to[i] !== 'tournament_id';
    });
    expect(bad.map((f) => f.name)).toEqual([]);
  });

  it('has policies only for bot_worker: every bot table, and inserts into app.jobs', async () => {
    const policies = await db.query<{ schema: string; table: string; roles: unknown; cmd: string }>(`
      select schemaname as schema, tablename as "table", roles::text[] as roles, cmd from pg_policies
      where schemaname in ('app', 'bot')`);
    expect(policies.filter((p) => asArray(p.roles).join() !== 'bot_worker')).toEqual([]);
    const bot = tables.filter((t) => t.schema === 'bot').map((t) => t.table).sort();
    expect(policies.filter((p) => p.schema === 'bot' && p.cmd === 'ALL').map((p) => p.table).sort()).toEqual(bot);
    expect(policies.filter((p) => p.schema === 'app').map((p) => `${p.table}:${p.cmd}`)).toEqual(['jobs:INSERT']);
  });

  it('creates bot_worker without a login', async () => {
    const [role] = await db.query<{ rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean }>(
      `select rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname = 'bot_worker'`);
    expect(role).toEqual({ rolcanlogin: false, rolsuper: false, rolbypassrls: false });
  });
});
