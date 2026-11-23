// @vitest-environment node
// The loader: a fixed number of reads in one read-only snapshot for any tournament size, every
// one filtered by the tournament; drafts and unknown ids stop after the first read; two
// tournaments in one database each see only their own rows.

import { eq } from 'drizzle-orm';
import type { Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { players, teamMembers, tournaments } from '@/platform/db';
import type { TestDb } from '@/platform/db/testing';
import { computeTournament } from './domain/compute';
import type { TournamentInput } from './domain/input';
import { getDataset, LOAD_READS, loadTournamentInput } from './queries';
import { importedDb, TOURNAMENT_ID } from './testing/imported';
import { publishedTotals, totalsOf } from './testing/published';

let t: TestDb;
beforeAll(async () => { t = await importedDb(['pdl-s2', 'wiosenna']); }, 120_000);
afterAll(() => t.close());

interface Statement { sql: string; params: unknown[]; inTransaction: boolean }

/**
 * The statements a call sends: those on the PGlite instance and those inside its transactions.
 * PGlite sends BEGIN and COMMIT itself, past this record; the `set transaction` that drizzle sends
 * on PGlite is recorded (on postgres-js the same options go into BEGIN).
 */
async function recordStatements<T>(run: () => Promise<T>): Promise<{ result: T; statements: Statement[] }> {
  const statements: Statement[] = [];
  const push = (inTransaction: boolean, sql: unknown, params: unknown) => statements.push({ sql: String(sql), params: (params as unknown[]) ?? [], inTransaction });
  const client = t.client;
  const query = client.query;
  const transaction = client.transaction;
  client.query = ((sql: string, params?: unknown[], o?: unknown) => {
    push(false, sql, params);
    return query.call(client, sql, params, o as never);
  }) as typeof client.query;
  client.transaction = ((cb: (tx: Transaction) => Promise<unknown>) => transaction.call(client, (inner: Transaction) => {
    const own = inner.query;
    inner.query = ((sql: string, params?: unknown[], o?: unknown) => { push(true, sql, params); return own.call(inner, sql, params, o as never); }) as typeof inner.query;
    return cb(inner);
  })) as typeof client.transaction;
  try {
    return { result: await run(), statements };
  } finally {
    client.query = query;
    client.transaction = transaction;
  }
}

const reads = (statements: Statement[]) => statements.filter((s) => s.sql.trimStart().toLowerCase().startsWith('select '));

describe('loadTournamentInput', () => {
  it('reads the same number of times for a small and a seven times larger tournament, in one read-only snapshot', async () => {
    const small = await recordStatements(() => loadTournamentInput(TOURNAMENT_ID['pdl-s2'], t.db));
    const large = await recordStatements(() => loadTournamentInput(TOURNAMENT_ID.wiosenna, t.db));
    expect(large.result!.performances.length).toBeGreaterThan(6 * small.result!.performances.length);
    for (const { statements } of [small, large]) {
      expect(reads(statements)).toHaveLength(LOAD_READS);
      expect(statements).toHaveLength(LOAD_READS + 1);
      expect(statements.every((s) => s.inTransaction)).toBe(true);
      expect(statements[0].sql).toBe('set transaction isolation level repeatable read read only');
    }
  });

  it('filters every read by the tournament', async () => {
    const id = TOURNAMENT_ID.wiosenna;
    const { statements } = await recordStatements(() => loadTournamentInput(id, t.db));
    for (const s of reads(statements)) {
      const filter = s.sql.includes('from "app"."tournaments"') ? /"tournaments"\."id" = \$1/ : /"tournament_id" = \$1/;
      expect({ sql: s.sql, filtered: filter.test(s.sql) }).toEqual({ sql: s.sql, filtered: true });
      expect(s.params[0]).toBe(id);
    }
  });

  it('gives null for a tournament that does not exist, after one read', async () => {
    const { result, statements } = await recordStatements(() => loadTournamentInput('no-such-tournament', t.db));
    expect(result).toBeNull();
    expect(reads(statements)).toHaveLength(1);
    expect(await getDataset('no-such-tournament', t.db)).toBeNull();
  });

  it('treats a draft like an unknown tournament, unless drafts are asked for', async () => {
    const id = TOURNAMENT_ID['pdl-s2'];
    const [{ status }] = await t.db.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, id));
    await t.db.update(tournaments).set({ status: 'draft' }).where(eq(tournaments.id, id));
    try {
      const { result, statements } = await recordStatements(() => loadTournamentInput(id, t.db));
      expect(result).toBeNull();
      expect(reads(statements)).toHaveLength(1);
      expect(await getDataset(id, t.db)).toBeNull();
      expect((await loadTournamentInput(id, t.db, { drafts: true }))?.tournament).toEqual({ id, formatPreset: 'swiss', status: 'draft' });
    } finally {
      await t.db.update(tournaments).set({ status }).where(eq(tournaments.id, id));
    }
  });

  it('takes the medium Steam picture, then the full one, then the small one', async () => {
    const id = TOURNAMENT_ID['pdl-s2'];
    const [{ steamId64 }] = await t.db.select({ steamId64: teamMembers.steamId64 }).from(teamMembers).where(eq(teamMembers.tournamentId, id)).limit(1);
    const urls = { avatarUrl: 'https://a/s.jpg', avatarMediumUrl: 'https://a/m.jpg', avatarFullUrl: 'https://a/f.jpg' };
    const avatar = async () => (await loadTournamentInput(id, t.db))!.members.find((m) => m.steamId64 === steamId64)!.avatarUrl;
    await t.db.update(players).set(urls).where(eq(players.steamId64, steamId64!));
    expect(await avatar()).toBe(urls.avatarMediumUrl);
    await t.db.update(players).set({ avatarMediumUrl: null }).where(eq(players.steamId64, steamId64!));
    expect(await avatar()).toBe(urls.avatarFullUrl);
    await t.db.update(players).set({ avatarFullUrl: null }).where(eq(players.steamId64, steamId64!));
    expect(await avatar()).toBe(urls.avatarUrl);
  });
});

describe('two tournaments in one database', () => {
  let pdl: TournamentInput;
  let wiosenna: TournamentInput;
  beforeAll(async () => {
    pdl = (await loadTournamentInput(TOURNAMENT_ID['pdl-s2'], t.db))!;
    wiosenna = (await loadTournamentInput(TOURNAMENT_ID.wiosenna, t.db))!;
  });

  it('each load holds only its own rows', () => {
    // Every row hangs off the tournament's own teams, matches and games, and the two share none.
    // (A roster entry's id can repeat across tournaments: it is the player's Steam id in some.)
    const own = (input: TournamentInput) => {
      const teams = new Set(input.teams.map((x) => x.id));
      const matches = new Set(input.matches.map((x) => x.id));
      const games = new Set(input.games.map((x) => x.id));
      expect(input.members.every((m) => teams.has(m.teamId))).toBe(true);
      expect(input.matches.every((m) => [m.teamAId, m.teamBId].every((id) => id === null || teams.has(id)))).toBe(true);
      expect(input.games.every((g) => matches.has(g.matchId))).toBe(true);
      expect(input.performances.every((p) => games.has(p.gameId) && (p.teamId === null || teams.has(p.teamId)))).toBe(true);
      return { teams, matches, games };
    };
    const a = own(pdl);
    const b = own(wiosenna);
    for (const kind of ['teams', 'matches', 'games'] as const) expect([...a[kind]].filter((id) => b[kind].has(id))).toEqual([]);
    expect([pdl.teams.length, pdl.matches.length, pdl.games.length, pdl.performances.length]).toEqual([12, 17, 26, 240]);
    expect([wiosenna.teams.length, wiosenna.matches.length, wiosenna.games.length, wiosenna.performances.length]).toEqual([22, 125, 188, 1630]);
  });

  it('each compute gives the numbers of its own tournament', () => {
    const published = publishedTotals('pdl-s2');
    const ours = totalsOf(computeTournament(pdl));
    // The Steam pictures are one per account (`players`, shared by every tournament), so only the
    // numbers are compared here; the dataset parity test compares the rest, one tournament per database.
    expect({ counts: ours.counts, totals: ours.totals, scoreRanking: ours.scoreRanking })
      .toEqual({ counts: published.counts, totals: published.totals, scoreRanking: published.scoreRanking });
    expect(totalsOf(computeTournament(wiosenna)).totals).toEqual(publishedTotals('wiosenna').totals);
  });
});
