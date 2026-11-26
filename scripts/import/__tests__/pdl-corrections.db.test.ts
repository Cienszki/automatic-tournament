// @vitest-environment node
// The PDL S1 owner corrections (STATUS.md question 43) on a small made-up capture with the real
// ids (pdl-capture.ts): an organizer's 2:0 over two played games, a best of five, Kildren, who
// played for Kotwica Gaming on an account one of its roster entries also names, and Lukash, on
// Power Rangers' roster, who stood in for Kotwica Gaming in one match (question 44c, WP-33c).
// Checked in the database, in the standings (WP-13a) and in the stats (WP-15).

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeTournament } from '@/features/stats';
import { loadTournamentInput } from '@/features/stats/queries';
import * as s from '@/platform/db/schema';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { OWNER_CORRECTIONS } from '../corrections';
import { mapCapture } from '../map';
import { renderReport, totalChanges } from '../report';
import { readCapture, runImport, type RunOptions, type RunResult } from '../run';
import { computeImportedStandings } from '../standings';
import { JOXXI, KILDREN, LUKASH, LUKASH_REQUEST, MEMBERS, SIUSIAK, TEAMS, VOODOO_MATCH, writePdlCapture } from './pdl-capture';

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
    expect(outcomes).toHaveLength(14);
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
      [VOODOO_MATCH, LUKASH, 'Lukash', 'approved', MEMBERS.siusiak],
      [VOODOO_MATCH, KILDREN, 'Kildren', 'approved', 'KXhEeRKyHEajWCRwWOW4'],
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

  it('count Lukash for Kotwica Gaming in its match vs Voodoo Monkey only, and keep him a Power Rangers member', async () => {
    const outcome = first.tournaments[0].mapped.state.corrections.finish().find((o) => o.id === 'pdl-kotwica-lukash-voodoo');
    // The captured request already says so; the correction confirms it.
    expect(outcome).toMatchObject({ status: 'applied', change: 'already so' });
    const [request] = await t.db.select().from(s.standinRequests).where(and(eq(s.standinRequests.tournamentId, T), eq(s.standinRequests.id, LUKASH_REQUEST)));
    expect(request).toMatchObject({ matchId: VOODOO_MATCH, teamId: TEAMS.kotwica, standinSteamId64: LUKASH, replacedMemberId: MEMBERS.siusiak, status: 'approved' });
    const members = await t.db.select().from(s.teamMembers).where(and(eq(s.teamMembers.tournamentId, T), eq(s.teamMembers.steamId64, LUKASH)));
    expect(members.map((m) => [m.id, m.teamId, m.leftAt])).toEqual([[MEMBERS.lukash, TEAMS.powerRangers, null]]);
    const games = await t.db.select().from(s.games).where(eq(s.games.tournamentId, T));
    const matchOf = new Map(games.map((g) => [g.id, g.matchId]));
    const perfs = await t.db.select().from(s.performances).where(and(eq(s.performances.tournamentId, T), eq(s.performances.steamId64, LUKASH)));
    expect(perfs.map((p) => [matchOf.get(p.gameId), p.teamId]).sort()).toEqual([
      ['CBN6rpbexZN7Qq0rVop4', TEAMS.powerRangers], ['CBN6rpbexZN7Qq0rVop4', TEAMS.powerRangers],
      [VOODOO_MATCH, TEAMS.kotwica], [VOODOO_MATCH, TEAMS.kotwica],
    ]);
    const voodooGames = new Set(games.filter((g) => g.matchId === VOODOO_MATCH).map((g) => g.id));
    const siusiak = await t.db.select().from(s.performances).where(and(eq(s.performances.tournamentId, T), eq(s.performances.steamId64, SIUSIAK)));
    expect(siusiak.filter((p) => voodooGames.has(p.gameId))).toEqual([]);
  });

  it('give Kotwica Gaming the games Lukash played for it in the stats, and Lukash his Power Rangers team', async () => {
    const { model } = computeTournament((await loadTournamentInput(T, t.db))!);
    const kotwica = model.teamById.get(TEAMS.kotwica)!;
    const powerRangers = model.teamById.get(TEAMS.powerRangers)!;
    const voodooGames = kotwica.games.filter((g) => g.perfs.some((p) => p.pid === LUKASH && p.tid === TEAMS.kotwica));
    expect(voodooGames).toHaveLength(2);
    for (const g of voodooGames) {
      expect(powerRangers.games).not.toContain(g);
      expect(g.perfs.filter((p) => p.tid === TEAMS.kotwica).map((p) => p.pid)).toEqual(expect.arrayContaining([KILDREN, LUKASH]));
      expect(g.perfs.filter((p) => p.tid === TEAMS.kotwica)).toHaveLength(5);
    }
    const lukash = model.playerById.get(LUKASH)!;
    expect({ team: lukash.teamId, games: lukash.games, forKotwica: lukash.perfs.filter((p) => p.tid === TEAMS.kotwica).length }).toEqual({ team: TEAMS.powerRangers, games: 4, forKotwica: 2 });
    expect(powerRangers.players.map((p) => p.id)).toContain(LUKASH);
    expect(kotwica.players.map((p) => p.id)).not.toContain(LUKASH);
  });

  it('list each correction readably in the report, with no Steam id when redacted', () => {
    const redacted = renderReport(first, { redact: true });
    expect(redacted).toMatch(/Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Elite, matchday 4, 9 March 2026, Bociarnia Junior vs Dream Stack .*Winner none → Bociarnia Junior, given against none → Dream Stack/);
    expect(redacted).toMatch(/14 of 14 applied/);
    expect(redacted).toMatch(/Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 3, 6 March 2026, Kotwica Gaming vs Voodoo Monkey, 0:2: Lukash \(on Power Rangers' roster\) for Siusiak12\. Already so\./);
    expect(redacted).not.toMatch(/7656\d{13}/);
    // Nor a 32-bit one (Kildren's 313683754, Joxxi's 114011482), while Dota match ids stay.
    for (const steam32 of ['313683754', '114011482', '1674909807', '1015246076', '235487900', '109645400']) expect(redacted).not.toContain(steam32);
    expect(redacted).toMatch(/OpenDota 8718370162/);
    expect(renderReport(first)).toContain('313683754');
  });

  it('write nothing the second time', async () => {
    expect(totalChanges(await runImport(t.db, [capture], OPTIONS))).toBe(0);
  });
});

describe('a stand-in on another team\'s roster (Lukash, Power Rangers, for Kotwica Gaming vs Voodoo Monkey)', () => {
  let tmp: string;
  let base: string;
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'pdl-lukash-'));
    base = writePdlCapture(tmp);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  type Rec = { path: string; data: Record<string, unknown> };
  type Edit = (rec: Rec) => Rec | null;
  /** The mapped capture with each line of each named file passed through its edit (null drops it). */
  const mappedWithAll = (edits: Record<string, Edit>, corrections = OWNER_CORRECTIONS) => {
    const saved = Object.keys(edits).map((file) => [join(base, file), readFileSync(join(base, file), 'utf8')] as const);
    for (const [path, before] of saved) {
      const edit = edits[path.slice(base.length + 1)];
      const recs = before.split('\n').filter(Boolean).map((l) => edit(JSON.parse(l) as Rec)).filter((r): r is Rec => r !== null);
      writeFileSync(path, recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }
    try {
      return mapCapture(readCapture(base), null, { anonymize: false, corrections }, new Map());
    } finally {
      for (const [path, before] of saved) writeFileSync(path, before);
    }
  };
  const mappedWith = (file: string, edit: Edit) => mappedWithAll({ [file]: edit });
  const lukashTeams = (m: ReturnType<typeof mapCapture>, matchId = VOODOO_MATCH) => {
    const games = new Set(m.rows.get(s.games).filter((g) => g.matchId === matchId).map((g) => g.id));
    return m.rows.get(s.performances).filter((p) => p.steamId64 === LUKASH && games.has(p.gameId as string)).map((p) => p.teamId);
  };
  const isLukashPerf = (r: Rec) => r.path.includes(`/matches/${VOODOO_MATCH}/`) && r.path.endsWith(`/performances/${MEMBERS.lukash}`);

  it('adds the approved request when the capture has none, so he counts for Kotwica Gaming', () => {
    const m = mappedWith('standinRequests.jsonl', (r) => (r.path.endsWith(LUKASH_REQUEST) ? null : r));
    const added = m.rows.get(s.standinRequests).find((r) => r.id === 'owner-pdl-kotwica-lukash-voodoo');
    expect(added).toMatchObject({ matchId: VOODOO_MATCH, teamId: TEAMS.kotwica, standinSteamId64: LUKASH, standinNickname: 'Lukash', replacedMemberId: MEMBERS.siusiak, status: 'approved' });
    expect(m.state.corrections.finish().find((o) => o.id === 'pdl-kotwica-lukash-voodoo')).toMatchObject({ status: 'applied', change: 'approved stand-in added (request owner-pdl-kotwica-lukash-voodoo)' });
    expect(lukashTeams(m)).toEqual([TEAMS.kotwica, TEAMS.kotwica]);
  });

  it('takes his team from the request when a performance has no teamId', () => {
    const m = mappedWith('matches.games.performances.jsonl', (r) => (isLukashPerf(r) ? { ...r, data: { ...r.data, teamId: undefined } } : r));
    expect(lukashTeams(m)).toEqual([TEAMS.kotwica, TEAMS.kotwica]);
    expect(m.ctx.findings.filter((f) => f.reason.startsWith('a performance without teamId takes the team its player is an approved stand-in for'))).toHaveLength(2);
  });

  it('never gives his game to Power Rangers when a performance names his roster team', () => {
    const m = mappedWith('matches.games.performances.jsonl', (r) => (isLukashPerf(r) ? { ...r, data: { ...r.data, teamId: TEAMS.powerRangers } } : r));
    expect(lukashTeams(m)).toEqual([TEAMS.kotwica, TEAMS.kotwica]);
    expect(m.ctx.findings.filter((f) => f.reason.startsWith('teamId is a team outside the match'))).toHaveLength(2);
  });

  it('keeps a stored team of the match over the stand-in request (teamId Voodoo Monkey stays Voodoo Monkey)', () => {
    const m = mappedWith('matches.games.performances.jsonl', (r) => (isLukashPerf(r) ? { ...r, data: { ...r.data, teamId: TEAMS.voodoo } } : r));
    expect(lukashTeams(m)).toEqual([TEAMS.voodoo, TEAMS.voodoo]);
  });

  it('uses the request for its own match only: his Power Rangers games vs Kotwica Gaming with no teamId go to Power Rangers', () => {
    const inPowerRangersMatch = (r: Rec) => r.path.includes('/matches/CBN6rpbexZN7Qq0rVop4/') && r.path.endsWith(`/performances/${LUKASH}`);
    const m = mappedWith('matches.games.performances.jsonl', (r) => (inPowerRangersMatch(r) ? { ...r, data: { ...r.data, teamId: undefined } } : r));
    expect(lukashTeams(m, 'CBN6rpbexZN7Qq0rVop4')).toEqual([TEAMS.powerRangers, TEAMS.powerRangers]);
    expect(lukashTeams(m)).toEqual([TEAMS.kotwica, TEAMS.kotwica]);
  });

  it('counts an approved request that names a third team for no team, and reports it', () => {
    const third = (r: Rec) => (r.path.endsWith(LUKASH_REQUEST) ? { ...r, data: { ...r.data, teamId: TEAMS.powerRangers, requestingTeamId: TEAMS.powerRangers } } : r);
    const withoutLukash = OWNER_CORRECTIONS.filter((c) => c.id !== 'pdl-kotwica-lukash-voodoo');
    const noTeam = (r: Rec) => (isLukashPerf(r) ? { ...r, data: { ...r.data, teamId: undefined } } : r);
    const m = mappedWithAll({ 'standinRequests.jsonl': third, 'matches.games.performances.jsonl': noTeam }, withoutLukash);
    expect(m.rows.get(s.standinRequests).find((r) => r.id === LUKASH_REQUEST)).toMatchObject({ teamId: TEAMS.powerRangers, status: 'approved' });
    expect(m.ctx.findings.filter((f) => f.reason.startsWith('the request\'s team is not one of its match\'s two teams'))).toHaveLength(1);
    // His performances stored without a team get none from it: neither Power Rangers nor Kotwica Gaming.
    expect(lukashTeams(m)).toEqual([null, null]);
    for (const g of m.rows.get(s.games).filter((x) => x.matchId === VOODOO_MATCH)) expect([g.radiantTeamId, g.direTeamId]).toEqual([TEAMS.kotwica, TEAMS.voodoo]);
  });
});
