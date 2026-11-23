// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { aTournament, buildSeed, insertWorld } from '../../../scripts/seed';
import { findPublicTournamentId, getTournamentFrameRow, listListedTournaments } from './queries';

describe('listListedTournaments', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
    const world = buildSeed({ now: new Date('2026-11-20T12:00:00.000Z') });
    world.tournaments.push(aTournament({ id: 'seed-szkic', status: 'draft' }));
    await insertWorld(t.db, world);
  });
  afterAll(() => t.close());

  it('lists every tournament but drafts, by slug, with what the sitemap needs', async () => {
    const rows = await listListedTournaments(t.db);
    expect(rows.map((r) => r.slug)).toEqual(['seed-grupy', 'seed-lan', 'seed-liga', 'seed-swiss']);
    expect(rows.find((r) => r.slug === 'seed-liga')).toMatchObject({ formatPreset: 'league', status: 'active' });
    expect(rows.find((r) => r.slug === 'seed-swiss')?.status).toBe('completed');
    expect(rows[0].updatedAt).toBeInstanceOf(Date);
  });
});

describe('findPublicTournamentId and getTournamentFrameRow', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
    const world = buildSeed({ now: new Date('2026-11-20T12:00:00.000Z') });
    world.tournaments.push(aTournament({ id: 'seed-szkic', status: 'draft' }));
    await insertWorld(t.db, world);
  });
  afterAll(() => t.close());

  it('finds a public tournament by its slug', async () => {
    expect(await findPublicTournamentId(t.db, 'seed-liga')).toBe('seed-liga');
  });

  it('does not find a draft or an unknown slug', async () => {
    expect(await findPublicTournamentId(t.db, 'seed-szkic')).toBeNull();
    expect(await findPublicTournamentId(t.db, 'nope')).toBeNull();
  });

  it('reads the frame a page needs, with the theme, as plain JSON', async () => {
    const frame = await getTournamentFrameRow(t.db, 'seed-liga');
    expect(frame).toMatchObject({ id: 'seed-liga', slug: 'seed-liga', status: 'active', locale: 'pl' });
    expect(frame?.theme.colors.primary).toMatch(/^#/);
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame);
    expect(await getTournamentFrameRow(t.db, 'nope')).toBeNull();
  });
});
