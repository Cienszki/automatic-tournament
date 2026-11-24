// @vitest-environment node
// The public read of the stats hub's dataset (getCachedDataset), built by the same factory with the
// same options, on a fake of Next's data cache (Next's own does not run outside a Next server).
// What it proves: the key and the tags, that a change to the rows stays hidden until one of those
// tags is invalidated, that another tournament's invalidation leaves it alone, that a null is never
// stored, and that the dataset survives the cache's JSON round trip unchanged.

import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCachedQuery } from '@/platform/cache/cached-query';
import { createInvalidate } from '@/platform/cache/invalidate';
import { TAG_KINDS, tournamentTags } from '@/platform/cache/tags';
import { games, teams, tournaments } from '@/platform/db';
import type { TestDb } from '@/platform/db/testing';
import { createDatasetQuery, getDataset } from './queries';
import { importedDb, TOURNAMENT_ID } from './testing/imported';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/platform/db/client', () => ({ getDb: () => state.db }));

const PDL = TOURNAMENT_ID['pdl-s2'];
const WIOSENNA = TOURNAMENT_ID.wiosenna;

let t: TestDb;
beforeAll(async () => {
  t = await importedDb(['pdl-s2', 'wiosenna']);
  state.db = t.db;
}, 120_000);
afterAll(() => t.close());

type CacheFn = Parameters<typeof createCachedQuery>[0];

/**
 * A stand-in for Next's data cache: entries kept as JSON by key and dropped by tag. A callback that
 * throws stores nothing, as in Next. `misses` counts the callbacks run, that is the database reads.
 */
function fakeDataCache() {
  const entries = new Map<string, { json: string; tags: string[] }>();
  const calls: { key: string[]; tags: string[] }[] = [];
  let misses = 0;
  const cache = ((cb: () => Promise<unknown>, keyParts: string[] = [], options: { tags?: string[] } = {}) => {
    const key = JSON.stringify(keyParts);
    calls.push({ key: keyParts, tags: options.tags ?? [] });
    return async () => {
      const hit = entries.get(key);
      if (hit) return JSON.parse(hit.json);
      misses += 1;
      const value = await cb();
      entries.set(key, { json: JSON.stringify(value), tags: options.tags ?? [] });
      return value;
    };
  }) as unknown as CacheFn;
  const revalidate = (tag: string) => {
    for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
  };
  return { cache, calls, entries, revalidate, misses: () => misses };
}

function setup() {
  const cache = fakeDataCache();
  return { cache, get: createDatasetQuery(createCachedQuery(cache.cache)), invalidate: createInvalidate(cache.revalidate) };
}

async function renameTeam(tournamentId: string, teamId: string, name: string): Promise<void> {
  await t.db.update(teams).set({ name }).where(and(eq(teams.tournamentId, tournamentId), eq(teams.id, teamId)));
}

describe('getCachedDataset', () => {
  it('keys the entry by stats.dataset and the id, tagged with the tournament, its stats, teams and matches', async () => {
    const { cache, get } = setup();
    await get(PDL);
    expect(cache.calls).toEqual([{
      key: ['v1', 'stats.dataset', JSON.stringify([PDL])],
      tags: [`t:${PDL}`, `t:${PDL}:stats`, `t:${PDL}:teams`, `t:${PDL}:matches`],
    }]);
  });

  it.each(['pdl-s2', 'wiosenna'] as const)('gives plain JSON for %s: a cache hit equals the read that filled it', async (slug) => {
    const id = TOURNAMENT_ID[slug];
    const { cache, get } = setup();
    const miss = await get(id);
    const hit = await get(id);
    expect(cache.misses()).toBe(1);
    expect(hit).toStrictEqual(miss);
    expect({ ...miss, generatedAt: '' }).toStrictEqual({ ...(await getDataset(id, t.db)), generatedAt: '' });
  });

  it.each([':stats', ':teams', ':matches', ''])('keeps the old dataset after a change until the tag t:<id>%s is invalidated', async (suffix) => {
    const { cache, get, invalidate } = setup();
    const before = (await get(PDL))!;
    const team = before.teams[0];
    try {
      await renameTeam(PDL, team.id, 'Renamed');
      expect((await get(PDL))!.teams[0].name).toBe(team.name);
      invalidate([`t:${PDL}${suffix}`]);
      expect((await get(PDL))!.teams[0].name).toBe('Renamed');
      expect(cache.misses()).toBe(2);
    } finally {
      await renameTeam(PDL, team.id, team.name);
    }
  });

  it('shows a corrected game result only after the matches tag is invalidated', async () => {
    const { get, invalidate } = setup();
    const game = (await get(PDL))!.games[0];
    const where = and(eq(games.tournamentId, PDL), eq(games.id, game.id));
    try {
      await t.db.update(games).set({ radiantWin: !game.radiantWin }).where(where);
      expect((await get(PDL))!.games[0].radiantWin).toBe(game.radiantWin);
      invalidate([`t:${PDL}:matches`]);
      expect((await get(PDL))!.games[0].radiantWin).toBe(!game.radiantWin);
    } finally {
      await t.db.update(games).set({ radiantWin: game.radiantWin }).where(where);
    }
  });

  it('stays cached when every tag of another tournament is invalidated', async () => {
    const { cache, get, invalidate } = setup();
    const team = (await get(PDL))!.teams[0];
    await get(WIOSENNA);
    try {
      await renameTeam(PDL, team.id, 'Renamed');
      invalidate(tournamentTags(WIOSENNA, ...TAG_KINDS));
      expect((await get(PDL))!.teams[0].name).toBe(team.name);
      expect(cache.misses()).toBe(2);
      expect(cache.entries.size).toBe(1);
    } finally {
      await renameTeam(PDL, team.id, team.name);
    }
  });

  it('stores no null: an unknown id and a draft are read again on every call', async () => {
    const { cache, get } = setup();
    expect(await get('nope')).toBeNull();
    expect(await get('nope')).toBeNull();
    expect(cache.misses()).toBe(2);

    const [{ status }] = await t.db.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, PDL));
    try {
      await t.db.update(tournaments).set({ status: 'draft' }).where(eq(tournaments.id, PDL));
      expect(await get(PDL)).toBeNull();
      expect(cache.entries.size).toBe(0);
    } finally {
      await t.db.update(tournaments).set({ status }).where(eq(tournaments.id, PDL));
    }
    // Published again: the dataset is there without any invalidation, because the null was not kept.
    expect((await get(PDL))?.tournamentId).toBe(PDL);
    expect(cache.misses()).toBe(4);
  });
});
