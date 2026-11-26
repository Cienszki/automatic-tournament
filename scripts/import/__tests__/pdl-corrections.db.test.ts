// @vitest-environment node
// The PDL S1 owner corrections (STATUS.md question 43) on a small made-up capture with the real
// ids (pdl-capture.ts): an organizer's 2:0 over two played games, a best of five, and Kildren, who
// played for Kotwica Gaming on an account one of its roster entries also names. Checked in the
// database, in the standings (WP-13a) and in the stats (WP-15).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeTournament } from '@/features/stats';
import { loadTournamentInput } from '@/features/stats/queries';
import * as s from '@/platform/db/schema';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { renderReport, totalChanges } from '../report';
import { runImport, type RunOptions, type RunResult } from '../run';
import { computeImportedStandings } from '../standings';
import { JOXXI, KILDREN, TEAMS, writePdlCapture } from './pdl-capture';

const OPTIONS: RunOptions = { anonymize: false, prune: false, publishedDirs: [] };
const T = 'pdl-s1';
let dir: string;
let capture: string;
let t: TestDb;
let first: RunResult;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pdl-corrections-'));
  capture = writePdlCapture(dir);
  t = await createTestDb();
  first = await runImport(t.db, [capture], OPTIONS);
}, 120_000);
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});

const match = async (id: string) => (await t.db.select().from(s.matches).where(and(eq(s.matches.tournamentId, T), eq(s.matches.id, id))))[0];
const row = async (group: string, team: string) => {
  const tables = await computeImportedStandings(t.db, T);
  return tables.find((x) => x.group.id === group)!.standings.rows.find((r) => r.teamId === team)!.record;
};

describe('the PDL S1 corrections', () => {
  it('match a row each, and the run says so', () => {
    const outcomes = first.tournaments[0].mapped.state.corrections.finish();
    expect(outcomes.filter((o) => o.status !== 'applied')).toEqual([]);
    expect(outcomes).toHaveLength(13);
    expect(first.tournaments[0].mapped.ctx.findings.filter((f) => /stored score disagrees|steamId and steamId64|more games than its series/.test(f.reason))).toEqual([]);
  });

  it('store Bociarnia Junior vs Dream Stack as the organizer\'s 2:0, with the reason, over two played games', async () => {
    expect(await match('0AxWzOilkXqKGYV6Dqgn')).toMatchObject({
      scoreA: 2, scoreB: 0, winnerTeamId: TEAMS.bociarniaJunior, forfeitTeamId: TEAMS.dreamStack, forfeitScope: 'series',
      forfeitReason: 'Dream Stack played with a stand-in who was not approved', bestOf: 2,
    });
    const games = await t.db.select().from(s.games).where(and(eq(s.games.tournamentId, T), eq(s.games.matchId, '0AxWzOilkXqKGYV6Dqgn')));
    expect(games.map((g) => [g.number, g.isForfeit, g.radiantWin])).toEqual(expect.arrayContaining([[1, false, false], [2, false, true]]));
  });

  it('count it 2:0 in the table', async () => {
    expect(await row('division-1769544151371', TEAMS.bociarniaJunior)).toMatchObject({ played: 1, wins: 1, points: 2, gamesWon: 2, gamesLost: 0 });
    expect(await row('division-1769544151371', TEAMS.dreamStack)).toMatchObject({ played: 1, losses: 1, points: 0, gamesWon: 0, gamesLost: 2 });
  });

  it('store Team Poland vs Bociarnia as a best of five won 3:1, worth 2 points like any win', async () => {
    expect(await match('z8jaivAAINvlU1Wqk78x')).toMatchObject({ bestOf: 5, scoreA: 3, scoreB: 1, winnerTeamId: TEAMS.teamPoland });
    expect(await row('division-1769544151371', TEAMS.teamPoland)).toMatchObject({ wins: 1, points: 2, gamesWon: 3, gamesLost: 1 });
  });

  it('keep every played game in the stats, the organizer\'s 2:0 included', async () => {
    const input = (await loadTournamentInput(T, t.db))!;
    const { dataset } = computeTournament(input);
    const ids = new Set(dataset.games.map((g) => g.id));
    for (const id of ['8722667298', '8722744206', '8753421099', '8753494537', '8753565475', '8753633904']) expect(ids.has(id)).toBe(true);
  });

  it('give Kildren\'s Kotwica games to him as a stand-in for Kotwica Gaming, never to Joxxi', async () => {
    const perfs = await t.db.select().from(s.performances).where(and(eq(s.performances.tournamentId, T), eq(s.performances.steamId64, KILDREN)));
    expect(perfs).toHaveLength(8);
    expect(new Set(perfs.map((p) => p.teamId))).toEqual(new Set([TEAMS.kotwica]));
    expect(await t.db.select().from(s.performances).where(and(eq(s.performances.tournamentId, T), eq(s.performances.steamId64, JOXXI)))).toEqual([]);
    const requests = await t.db.select().from(s.standinRequests).where(eq(s.standinRequests.tournamentId, T));
    expect(requests.map((r) => [r.matchId, r.standinSteamId64, r.standinNickname, r.status, r.replacedMemberId]).sort()).toEqual([
      ['CBN6rpbexZN7Qq0rVop4', KILDREN, 'Kildren', 'approved', 'KXhEeRKyHEajWCRwWOW4'],
      ['NvmNJAaAhOR1sziVe47I', KILDREN, 'Kildren', 'approved', 'KXhEeRKyHEajWCRwWOW4'],
      ['W2dzawVdnGqOsZJR3Yho', KILDREN, 'Kildren', 'approved', 'KXhEeRKyHEajWCRwWOW4'],
      ['XVwKIZt4leCFWR6vUewS', KILDREN, 'Kildren', 'approved', 'KXhEeRKyHEajWCRwWOW4'],
      ['x8zKgAY1lWJYz4ej562l', KILDREN, 'Kildren', 'approved', 'KXhEeRKyHEajWCRwWOW4'],
    ]);
  });

  it('keep Kildren as a former member of Bociarnia Junior, Joxxi on his own account, and name the player Kildren', async () => {
    const members = await t.db.select().from(s.teamMembers).where(eq(s.teamMembers.tournamentId, T));
    expect(members.find((m) => m.id === 'YlTarCnXL1O0qUMw1I49')).toMatchObject({ teamId: TEAMS.bociarniaJunior, steamId64: KILDREN, leftAt: new Date('2026-04-01T22:00:00.000Z'), leftReason: 'removed' });
    expect(members.find((m) => m.id === 'KXhEeRKyHEajWCRwWOW4')).toMatchObject({ teamId: TEAMS.kotwica, steamId64: JOXXI, leftAt: null });
    const [player] = await t.db.select().from(s.players).where(eq(s.players.steamId64, KILDREN));
    expect(player.nickname).toBe('Kildren');
  });

  it('tell the teams of Kildren\'s games apart by their players', async () => {
    const games = await t.db.select().from(s.games).where(and(eq(s.games.tournamentId, T), eq(s.games.matchId, 'XVwKIZt4leCFWR6vUewS')));
    for (const g of games) expect([g.radiantTeamId, g.direTeamId]).toEqual([TEAMS.kotwica, TEAMS.voodoo]);
  });

  it('list each correction readably in the report, with no Steam id when redacted', () => {
    const redacted = renderReport(first, { redact: true });
    expect(redacted).toMatch(/Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Elite, matchday 4, 9 March 2026, Bociarnia Junior vs Dream Stack .*Winner none → Bociarnia Junior, given against none → Dream Stack/);
    expect(redacted).toMatch(/13 of 13 applied/);
    expect(redacted).not.toMatch(/7656\d{13}/);
    // Nor a 32-bit one (Kildren's 313683754, Joxxi's 114011482), while Dota match ids stay.
    for (const steam32 of ['313683754', '114011482', '1674909807', '1015246076', '235487900']) expect(redacted).not.toContain(steam32);
    expect(redacted).toMatch(/OpenDota 8718370162/);
    expect(renderReport(first)).toContain('313683754');
  });

  it('write nothing the second time', async () => {
    expect(totalChanges(await runImport(t.db, [capture], OPTIONS))).toBe(0);
  });
});
