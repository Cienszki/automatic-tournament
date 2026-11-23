// @vitest-environment node
// The loader: a fixed number of statements for any tournament size, every one filtered by the
// tournament, and two tournaments in one database each see only their own rows.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TestDb } from '@/platform/db/testing';
import { computeTournament } from './domain/compute';
import type { TournamentInput } from './domain/input';
import { getDataset, LOAD_STATEMENTS, loadTournamentInput } from './queries';
import { importedDb, TOURNAMENT_ID } from './testing/imported';
import { publishedTotals, totalsOf } from './testing/published';

let t: TestDb;
beforeAll(async () => { t = await importedDb(['pdl-s2', 'wiosenna']); }, 120_000);
afterAll(() => t.close());

/** The statements a call sends to the database, with their parameters. */
async function recordStatements<T>(run: () => Promise<T>): Promise<{ result: T; statements: Array<{ sql: string; params: unknown[] }> }> {
  const spy = vi.spyOn(t.client, 'query');
  try {
    const result = await run();
    return { result, statements: spy.mock.calls.map(([sql, params]) => ({ sql: String(sql), params: (params as unknown[]) ?? [] })) };
  } finally {
    spy.mockRestore();
  }
}

describe('loadTournamentInput', () => {
  it('runs the same number of statements for a small and a seven times larger tournament', async () => {
    const small = await recordStatements(() => loadTournamentInput(t.db, TOURNAMENT_ID['pdl-s2']));
    const large = await recordStatements(() => loadTournamentInput(t.db, TOURNAMENT_ID.wiosenna));
    expect(large.result!.performances.length).toBeGreaterThan(6 * small.result!.performances.length);
    expect(small.statements).toHaveLength(LOAD_STATEMENTS);
    expect(large.statements).toHaveLength(LOAD_STATEMENTS);
  });

  it('filters every statement by the tournament', async () => {
    const id = TOURNAMENT_ID.wiosenna;
    const { statements } = await recordStatements(() => loadTournamentInput(t.db, id));
    for (const s of statements) {
      const filter = s.sql.includes('from "app"."tournaments"') ? /"tournaments"\."id" = \$1/ : /"tournament_id" = \$1/;
      expect({ sql: s.sql, filtered: filter.test(s.sql) }).toEqual({ sql: s.sql, filtered: true });
      expect(s.params[0]).toBe(id);
    }
  });

  it('gives null for a tournament that does not exist', async () => {
    expect(await loadTournamentInput(t.db, 'no-such-tournament')).toBeNull();
    expect(await getDataset('no-such-tournament', t.db)).toBeNull();
  });
});

describe('two tournaments in one database', () => {
  let pdl: TournamentInput;
  let wiosenna: TournamentInput;
  beforeAll(async () => {
    pdl = (await loadTournamentInput(t.db, TOURNAMENT_ID['pdl-s2']))!;
    wiosenna = (await loadTournamentInput(t.db, TOURNAMENT_ID.wiosenna))!;
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
