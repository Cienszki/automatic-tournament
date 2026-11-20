// @vitest-environment node
// The seed's rows pass the schema: the database accepts them (keys, checks, foreign keys), every
// JSON column parses with its zod schema, and the stage ranking rules parse with the formats
// feature. Then the facts pages and tests lean on: scores match games, players play for their own
// team, played matches lie in the past and upcoming ones in the future.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { parseRankingRules } from '../../src/features/formats';
import * as s from '../../src/platform/db/schema';
import { jsonColumnSchemas } from '../../src/platform/db/schema/json';
import { createTestDb, type TestDb } from '../../src/platform/db/testing';
import { buildSeed, insertWorld, removeTournaments, SEED_TOURNAMENTS, type SeedWorld } from './index';

const NOW = new Date('2026-11-20T12:00:00.000Z');

describe('the default seed', () => {
  let t: TestDb;
  let world: SeedWorld;
  beforeAll(async () => {
    t = await createTestDb();
    world = buildSeed({ now: NOW });
    await insertWorld(t.db, world);
  });
  afterAll(() => t.close());

  it('has the four tournaments, one per format', () => {
    expect(world.tournaments.map((x) => x.id)).toEqual(SEED_TOURNAMENTS.map((x) => x.id));
  });

  it('is the same every time for the same options', () => {
    expect(JSON.stringify(buildSeed({ now: NOW }))).toBe(JSON.stringify(world));
  });

  it('writes rows whose JSON columns parse with their schemas', async () => {
    const check = (column: keyof typeof jsonColumnSchemas, value: unknown) => {
      const result = jsonColumnSchemas[column].safeParse(value);
      if (!result.success) throw new Error(`${column}: ${result.error.message}`);
    };
    for (const row of await t.db.select().from(s.tournaments)) {
      check('app.tournaments.theme', row.theme);
      check('app.tournaments.presentation', row.presentation);
      check('app.tournaments.settings', row.settings);
      check('app.tournaments.features', row.features);
    }
    for (const row of await t.db.select().from(s.stages)) {
      check('app.stages.settings', row.settings);
      check('app.stages.state', row.state);
      check('app.stages.advancement', row.advancement);
      if (row.kind === 'bracket') expect(row.ranking).toBeNull();
      else expect(() => parseRankingRules(row.ranking)).not.toThrow();
    }
    for (const row of await t.db.select().from(s.groups)) check('app.groups.settings', row.settings);
    for (const row of await t.db.select().from(s.games)) check('app.games.picks_bans', row.picksBans);
    for (const row of await t.db.select().from(s.performances)) check('app.performances.extra', row.extra);
  });

  it('gives every completed match its games, a score that matches them, and a winner', async () => {
    const games = await t.db.select().from(s.games);
    for (const m of world.matches.filter((x) => x.status === 'completed')) {
      const own = games.filter((g) => g.matchId === m.id);
      expect(own.length).toBe((m.scoreA ?? 0) + (m.scoreB ?? 0));
      expect(own.length).toBeLessThanOrEqual(m.bestOf ?? 3);
      const winsA = own.filter((g) => g.radiantWin === (g.radiantTeamId === m.teamAId)).length;
      expect(winsA).toBe(m.scoreA);
      if (m.bestOf !== 2) expect(m.winnerTeamId).toBe(winsA > (m.scoreB ?? 0) ? m.teamAId : m.teamBId);
    }
    expect(world.matches.filter((x) => x.status !== 'completed').every((m) => !world.games.some((g) => g.matchId === m.id))).toBe(true);
  });

  it('puts five players of each side in every game, on ten different heroes', () => {
    const members = new Map(world.teamMembers.map((m) => [`${m.teamId}:${m.steamId64}`, m]));
    for (const g of world.games) {
      const lines = world.performances.filter((p) => p.gameId === g.id && p.tournamentId === g.tournamentId);
      expect(lines.length).toBe(10);
      expect(new Set(lines.map((p) => p.heroId)).size).toBe(10);
      for (const p of lines) expect(members.has(`${p.teamId}:${p.steamId64}`)).toBe(true);
      expect(lines.filter((p) => p.teamId === g.radiantTeamId).length).toBe(5);
    }
  });

  it('places played matches before now and upcoming ones after it', () => {
    for (const m of world.matches) {
      if (!m.scheduledAt) continue;
      if (m.status === 'completed') expect(m.scheduledAt.getTime()).toBeLessThan(NOW.getTime());
      else expect(m.scheduledAt.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('fills the playoff bracket from the group places and moves winners on', () => {
    const bracket = world.matches.filter((m) => m.tournamentId === 'seed-grupy' && m.stageId === 'playoffs');
    expect(bracket.map((m) => m.code)).toEqual(['R1M1', 'R1M2', 'F']);
    const final = bracket.find((m) => m.code === 'F')!;
    const semis = bracket.filter((m) => m.round === 1);
    expect([final.teamAId, final.teamBId]).toEqual(semis.map((m) => m.winnerTeamId));
  });

  it('pairs no Swiss rematch', () => {
    const swiss = world.matches.filter((m) => m.tournamentId === 'seed-swiss');
    const pairs = swiss.map((m) => [m.teamAId, m.teamBId].sort().join('|'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('can be replaced: removing the seed tournaments and writing them again', async () => {
    await removeTournaments(t.db, world.tournaments.map((x) => x.id));
    expect(await t.db.select().from(s.matches)).toEqual([]);
    await insertWorld(t.db, world);
    const rows = await t.db.select({ id: s.matches.id }).from(s.matches).where(eq(s.matches.tournamentId, 'seed-liga'));
    expect(rows.length).toBe(world.matches.filter((m) => m.tournamentId === 'seed-liga').length);
  });
});

describe('every phase of every seed tournament', () => {
  // One database for the lot, emptied between cases: a database per case made this file heavy
  // enough to slow the other database tests running beside it.
  let t: TestDb;
  beforeAll(async () => { t = await createTestDb(); });
  afterAll(() => t.close());

  for (const entry of SEED_TOURNAMENTS) {
    for (const phase of entry.phases) {
      it(`${entry.id} at ${phase} is accepted by the database`, async () => {
        const world = buildSeed({ now: NOW, only: [entry.id], phases: { [entry.id]: phase } });
        await removeTournaments(t.db, [entry.id]);
        await insertWorld(t.db, world);
        const [row] = await t.db.select().from(s.tournaments).where(eq(s.tournaments.id, entry.id));
        expect(row.status).toBe(phase === 'registration' ? 'registration' : phase === 'finished' ? 'completed' : 'active');
        const played = world.matches.filter((m) => m.status === 'completed').length;
        if (phase === 'registration') expect(world.matches).toEqual([]);
        else expect(played).toBeGreaterThan(0);
        if (phase === 'finished') expect(played).toBe(world.matches.length);
      });
    }
  }

  it('refuses a phase a format does not have', () => {
    expect(() => buildSeed({ now: NOW, phases: { 'seed-liga': 'playoffs' } })).toThrow(/no phase "playoffs"/);
    expect(() => buildSeed({ now: NOW, only: ['seed-x'] })).toThrow(/Unknown seed tournament/);
  });
});
