// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { teamMembers } from '@/platform/db';
import { aMember, aTeam, buildSeed, insertWorld } from '../../../scripts/seed';
import { listTeams } from './queries';

describe('listTeams', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
    const world = buildSeed({ now: new Date('2026-11-20T12:00:00.000Z') });
    // A player who left, and a coach, on the first league team.
    const first = world.teams.find((team) => team.tournamentId === 'seed-liga')!;
    world.teamMembers.push(
      aMember('seed-liga', { id: 'left-player', teamId: first.id, nickname: 'Gone', steamId64: world.teamMembers.find((m) => m.steamId64)!.steamId64, leftAt: new Date('2026-10-01T00:00:00Z') }),
      aMember('seed-liga', { id: 'coach', teamId: first.id, nickname: 'Trener', kind: 'coach' }),
    );
    world.teams.push(aTeam('seed-liga', { id: 'no-group', name: 'Bez grupy' }));
    await insertWorld(t.db, world);
  });
  afterAll(() => t.close());

  it('lists every team of the tournament and no team of another', async () => {
    const list = await listTeams(t.db, 'seed-liga');
    expect(list).toHaveLength(19);
    const swiss = await listTeams(t.db, 'seed-swiss');
    expect(swiss).toHaveLength(8);
    const swissIds = new Set(swiss.map((team) => team.id));
    expect(list.some((team) => swissIds.has(team.id))).toBe(false);
  });

  it('gives each team its group and current roster, without players who left', async () => {
    const list = await listTeams(t.db, 'seed-liga');
    for (const team of list.filter((x) => x.id !== 'no-group')) {
      expect(team.group).toBeTruthy();
      expect(team.members.filter((m) => m.kind === 'player').length).toBeGreaterThanOrEqual(5);
    }
    const nicknames = list.flatMap((team) => team.members.map((m) => m.nickname));
    expect(nicknames).not.toContain('Gone');
    const withCoach = list.find((team) => team.members.some((m) => m.nickname === 'Trener'))!;
    expect(withCoach.members.at(-1)).toEqual({ nickname: 'Trener', kind: 'coach', position: null });
  });

  it('puts a team in no group after the grouped ones', async () => {
    const list = await listTeams(t.db, 'seed-liga');
    expect(list.at(-1)).toMatchObject({ id: 'no-group', group: null, members: [] });
  });

  it('returns plain JSON, as the data cache stores it', async () => {
    const list = await listTeams(t.db, 'seed-liga');
    expect(JSON.parse(JSON.stringify(list))).toEqual(list);
  });

  it('runs three statements whatever the number of teams', async () => {
    const spy = vi.spyOn(t.client, 'query');
    await listTeams(t.db, 'seed-liga');
    const big = spy.mock.calls.length;
    spy.mockClear();
    await listTeams(t.db, 'seed-swiss');
    const small = spy.mock.calls.length;
    spy.mockRestore();
    expect(big).toBe(3);
    expect(small).toBe(3);
  });

  it('returns an empty list for a tournament that does not exist', async () => {
    expect(await listTeams(t.db, 'nope')).toEqual([]);
    const members = await t.db.select().from(teamMembers).where(eq(teamMembers.tournamentId, 'nope'));
    expect(members).toEqual([]);
  });
});
