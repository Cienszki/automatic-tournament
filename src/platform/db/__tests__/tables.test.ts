// @vitest-environment node
// The tables accept realistic rows, refuse what they promise to refuse, and the JSON columns
// round-trip; `scoped` keeps every statement inside one tournament; `createTestDb` is fast.

import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { getDb, ID_PATTERN, jsonColumnSchemas, newId, scoped, type JsonColumn } from '../index';
import { createTestDb, type TestDb } from '../testing';
import { SAMPLES } from './samples';
import { insertGlobals, insertTournament, STEAM_A } from './rows';

const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable => v instanceof PgTable).map((t) => getTableConfig(t));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  await insertGlobals(t.db);
  await insertTournament(t.db, 't-a');
  await insertTournament(t.db, 't-b');
}, 60_000);
afterAll(() => t?.close());

const fails = async (p: PromiseLike<unknown>) => {
  try { await p; return null; } catch (e) { return String((e as { cause?: Error }).cause?.message ?? (e as Error).message); }
};

describe('test database', () => {
  it('starts migrated in under a second', async () => {
    const started = Date.now();
    const fresh = await createTestDb();
    const elapsed = Date.now() - started;
    await fresh.close();
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('tables', () => {
  it('defines 50 tables and every one accepts a row', async () => {
    expect(tables).toHaveLength(50);
    for (const c of tables) {
      const { rows } = await t.client.query<{ n: number }>(`select count(*)::int as n from "${c.schema}"."${c.name}"`);
      expect(rows[0].n, `${c.schema}.${c.name}`).toBeGreaterThan(0);
    }
  });

  it('enforces a unique slug', async () => {
    const [row] = await t.db.select().from(schema.tournaments).where(eq(schema.tournaments.id, 't-a'));
    expect(await fails(t.db.insert(schema.tournaments).values({ ...row, id: 't-c' }))).toMatch(/tournaments_slug_unique/);
  });

  it('imports a Dota match once per tournament', async () => {
    const game = { matchId: 'match-1', number: 2, dotaMatchId: 8455801263, source: 'league-sync' as const };
    expect(await fails(t.db.insert(schema.games).values({ ...game, tournamentId: 't-a', id: 'again' }))).toMatch(/games_dota_match_unique/);
    const other = await t.db.select().from(schema.games).where(and(eq(schema.games.tournamentId, 't-b'), eq(schema.games.dotaMatchId, 8455801263)));
    expect(other).toHaveLength(1);
  });

  it('refuses a row that points at another tournament', async () => {
    const match = { stageId: 'qualifier', round: 2, bestOf: 3, teamAId: 'team-1' };
    await t.db.insert(schema.teams).values({ tournamentId: 't-b', id: 'team-only-b', name: 'Only B' });
    expect(await fails(t.db.insert(schema.matches).values({ ...match, tournamentId: 't-a', id: 'cross', teamBId: 'team-only-b' })))
      .toMatch(/matches_team_b_fk/);
  });

  it('keeps one active roster spot per player', async () => {
    expect(await fails(t.db.insert(schema.teamMembers).values({
      tournamentId: 't-a', id: 'dup', teamId: 'team-2', steamId64: STEAM_A, nickname: 'x',
    }))).toMatch(/team_members_one_roster_unique/);
  });

  it('checks enumerations', async () => {
    expect(await fails(t.client.query(`update app.matches set status = 'finished' where tournament_id = 't-a'`))).toMatch(/matches_status_check/);
  });

  it('removes everything of a tournament with it', async () => {
    await insertTournament(t.db, 't-gone');
    await t.db.delete(schema.tournaments).where(eq(schema.tournaments.id, 't-gone'));
    for (const c of tables.filter((x) => x.columns.some((col) => col.name === 'tournament_id') && x.schema === 'app')) {
      if (['audit_log', 'jobs', 'inbox'].includes(c.name)) continue;
      const { rows } = await t.client.query<{ n: number }>(`select count(*)::int as n from app."${c.name}" where tournament_id = 't-gone'`);
      expect(rows[0].n, c.name).toBe(0);
    }
  });
});

describe('JSON columns', () => {
  const jsonb = tables.flatMap((c) => c.columns.filter((col) => col.getSQLType() === 'jsonb').map((col) => `${c.schema}.${c.name}.${col.name}`));

  it('have a schema for every jsonb column, and no schema for a column that does not exist', () => {
    expect(jsonb.filter((k) => !(k in jsonColumnSchemas))).toEqual([]);
    expect(Object.keys(jsonColumnSchemas).filter((k) => !jsonb.includes(k))).toEqual([]);
  });

  it.each(Object.keys(jsonColumnSchemas) as JsonColumn[])('%s round-trips through its schema and the database', async (key) => {
    const [schemaName, table, column] = key.split('.');
    const zod = jsonColumnSchemas[key];
    const sample = SAMPLES[key];
    expect(zod.parse(sample)).toEqual(sample);
    const where = schemaName === 'app' && tables.find((c) => c.name === table)?.columns.some((c) => c.name === 'tournament_id')
      ? `where "${column}" is not null and (tournament_id is null or tournament_id = 't-a')` : `where "${column}" is not null`;
    const { rows } = await t.client.query<Record<string, unknown>>(`select "${column}" as v from "${schemaName}"."${table}" ${where} limit 1`);
    expect(rows).toHaveLength(1);
    expect(zod.parse(rows[0].v)).toEqual(sample);
  });

  it('refuse unknown keys where the shape is strict', () => {
    expect(jsonColumnSchemas['app.tournaments.theme'].safeParse({ ...SAMPLES['app.tournaments.theme'], extra: 1 }).success).toBe(false);
    expect(jsonColumnSchemas['bot.lobby_sessions.request'].safeParse({ ...SAMPLES['bot.lobby_sessions.request'], version: 2 }).success).toBe(false);
    expect(jsonColumnSchemas['app.stages.state'].safeParse({}).success).toBe(false);
    expect(jsonColumnSchemas['app.performances.extra'].safeParse({ anyNewField: [1] }).success).toBe(true);
  });
});

describe('scoped', () => {
  it('reads only the rows of its tournament', async () => {
    const a = scoped(t.db, 't-a');
    const rows = await a.select({ id: schema.teams.id, tid: schema.teams.tournamentId }).from(schema.teams).orderBy(schema.teams.id);
    expect(rows).toEqual([{ id: 'team-1', tid: 't-a' }, { id: 'team-2', tid: 't-a' }]);
  });

  it('does not find an id from another tournament', async () => {
    const a = scoped(t.db, 't-a');
    expect(await a.select({ id: schema.teams.id }).from(schema.teams, eq(schema.teams.id, 'team-only-b'))).toEqual([]);
    const updated = await a.update(schema.teams, { name: 'Hijacked' }, eq(schema.teams.id, 'team-only-b')).returning();
    expect(updated).toEqual([]);
    const deleted = await a.delete(schema.teams, eq(schema.teams.id, 'team-only-b')).returning();
    expect(deleted).toEqual([]);
  });

  it('stamps its tournament on inserts, whatever the row says', async () => {
    const a = scoped(t.db, 't-a');
    const id = newId();
    await a.insert(schema.announcements, { id, title: 'x', body: 'y', ...({ tournamentId: 't-b' } as object) });
    const [row] = await t.db.select().from(schema.announcements).where(eq(schema.announcements.id, id));
    expect(row.tournamentId).toBe('t-a');
  });

  it('joins with the filter of the other table, as the CONVENTIONS example does', async () => {
    const a = scoped(t.db, 't-a');
    const rows = await a.select({ id: schema.teams.id, groupId: schema.groupTeams.groupId })
      .from(schema.teams)
      .leftJoin(schema.groupTeams, and(a.own(schema.groupTeams), eq(schema.groupTeams.teamId, schema.teams.id)))
      .orderBy(schema.teams.id);
    expect(rows).toEqual([{ id: 'team-1', groupId: 'B' }, { id: 'team-2', groupId: 'B' }]);
  });

  it('refuses an empty tournament id', () => {
    expect(() => scoped(t.db, '')).toThrow();
  });
});

describe('getDb', () => {
  it('refuses to start without DATABASE_URL and connects to nothing at import', () => {
    const before = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try { expect(() => getDb()).toThrow(/DATABASE_URL/); } finally { if (before !== undefined) process.env.DATABASE_URL = before; }
  });
});

describe('ids', () => {
  it('look like Firestore ids and do not repeat', () => {
    const ids = Array.from({ length: 2000 }, newId);
    expect(ids.every((id) => ID_PATTERN.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
