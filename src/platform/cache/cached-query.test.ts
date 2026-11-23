import { describe, expect, it, vi } from 'vitest';
import { assertCacheable, createCachedQuery } from './cached-query';
import { createInvalidate } from './invalidate';
import { tags, tournamentTags } from './tags';

type Entry = { value: unknown; tags: string[] };

/** A stand-in for Next's data cache: entries by key, dropped by tag. */
function fakeCache() {
  const entries = new Map<string, Entry>();
  const calls: { key: string[]; tags: string[]; revalidate: unknown }[] = [];
  const cache = ((cb: () => Promise<unknown>, keyParts: string[] = [], options: { tags?: string[]; revalidate?: number | false } = {}) => {
    const key = keyParts.join('|');
    calls.push({ key: keyParts, tags: options.tags ?? [], revalidate: options.revalidate });
    return async () => {
      const hit = entries.get(key);
      if (hit) return JSON.parse(JSON.stringify(hit.value));
      const value = await cb();
      entries.set(key, { value, tags: options.tags ?? [] });
      return value;
    };
  }) as unknown as Parameters<typeof createCachedQuery>[0];
  const revalidate = (tag: string) => {
    for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
  };
  return { cache, calls, entries, revalidate };
}

describe('cachedQuery', () => {
  it('keys an entry by the query name and its arguments, and tags it per tournament', async () => {
    const f = fakeCache();
    const cachedQuery = createCachedQuery(f.cache);
    const getTeams = cachedQuery(async (id: string) => [`team of ${id}`], {
      name: 'teams.list', tags: (id) => tournamentTags(id, 'teams'),
    });
    await getTeams('a');
    await getTeams('b');
    expect(f.calls.map((c) => c.key)).toEqual([['v1', 'teams.list', '["a"]'], ['v1', 'teams.list', '["b"]']]);
    expect(f.calls[0].tags).toEqual(['t:a', 't:a:teams']);
    expect(f.calls[0].revalidate).toBe(false);
  });

  it('reads the database once until the tag is invalidated', async () => {
    const f = fakeCache();
    const cachedQuery = createCachedQuery(f.cache);
    const read = vi.fn(async (id: string) => ({ id, name: 'Old name' }));
    const getTeam = cachedQuery(read, { name: 'teams.one', tags: (id) => tournamentTags(id, 'teams') });

    expect(await getTeam('a')).toEqual({ id: 'a', name: 'Old name' });
    await getTeam('a');
    expect(read).toHaveBeenCalledTimes(1);

    read.mockResolvedValueOnce({ id: 'a', name: 'New name' });
    createInvalidate(f.revalidate)([tags.teams('a')]);
    expect(await getTeam('a')).toEqual({ id: 'a', name: 'New name' });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('leaves other tournaments cached when one is invalidated', async () => {
    const f = fakeCache();
    const read = vi.fn(async (id: string) => id);
    const get = createCachedQuery(f.cache)(read, { name: 'q', tags: (id) => tournamentTags(id, 'teams') });
    await get('a');
    await get('b');
    createInvalidate(f.revalidate)([tags.tournament('a')]);
    await get('a');
    await get('b');
    expect(read.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'a']);
  });

  it('keeps two queries with the same arguments apart', async () => {
    const f = fakeCache();
    const cachedQuery = createCachedQuery(f.cache);
    const one = cachedQuery(async () => 1, { name: 'one', tags: () => ['x'] });
    const two = cachedQuery(async () => 2, { name: 'two', tags: () => ['x'] });
    expect([await one(), await two()]).toEqual([1, 2]);
  });

  it('refuses a result that the cache would change, such as a Date', async () => {
    const f = fakeCache();
    const get = createCachedQuery(f.cache)(async () => ({ at: new Date(0) }), { name: 'dated', tags: () => ['x'] });
    await expect(get()).rejects.toThrow(/result.at is a Date/);
    expect(f.entries.size).toBe(0);
  });

  it('refuses a query without tags, which nothing could refresh', async () => {
    const get = createCachedQuery(fakeCache().cache)(async () => 1, { name: 'untagged', tags: () => [] });
    expect(() => get()).toThrow(/without tags/);
  });

  it('passes a time limit through when one is given', async () => {
    const f = fakeCache();
    await createCachedQuery(f.cache)(async () => 1, { name: 'timed', tags: () => ['x'], revalidate: 60 })();
    expect(f.calls[0].revalidate).toBe(60);
  });
});

describe('assertCacheable', () => {
  it('accepts plain JSON, with undefined properties', () => {
    expect(() => assertCacheable({ a: [1, 'b', null, true, { c: undefined }] })).not.toThrow();
  });

  it.each([
    ['a Map', new Map(), /not a plain object/],
    ['a bigint', { n: BigInt(1) }, /result.n is a bigint/],
    ['NaN', [Number.NaN], /result\[0\] is NaN/],
    ['undefined in an array', [undefined], /undefined/],
  ])('refuses %s', (_label, value, message) => {
    expect(() => assertCacheable(value)).toThrow(message);
  });
});

describe('invalidate', () => {
  it('revalidates each tag once', () => {
    const seen: string[] = [];
    createInvalidate((tag) => seen.push(tag))([tags.teams('a'), tags.teams('a'), tags.core('a')]);
    expect(seen).toEqual(['t:a:teams', 't:a:core']);
  });
});
