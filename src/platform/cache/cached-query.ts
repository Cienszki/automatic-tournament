// `cachedQuery`: a server read whose result is kept in the framework's data cache, keyed by the
// query's name and arguments and tagged per tournament (ADR-02). The entry lives until one of its
// tags is invalidated (`invalidate` in ./invalidate.ts), or for `revalidate` seconds when that is set.
//
//   export const getTeamList = cachedQuery(
//     (tournamentId: string) => listTeams(getDb(), tournamentId),
//     { name: 'teams.list', tags: (tournamentId) => tournamentTags(tournamentId, 'teams') },
//   );
//
// Two traps this helper closes:
//   - The data cache stores JSON. A Date read from the database would come back as a string on a
//     cache hit but as a Date on the miss that filled it, so a page would work once and then break.
//     A result that is not plain JSON is refused on the miss, every time.
//   - Next keys an entry by the callback's source text plus the key parts. Every callback made here
//     has the same source, so the query's name is part of the key and must be unique.

import { unstable_cache } from 'next/cache';

/** What a cached query may take as arguments: values with one obvious key. */
export type KeyPart = string | number | boolean;

export interface CachedQueryOptions<A extends KeyPart[]> {
  /** Unique across the platform, e.g. `teams.list`. Part of every key. */
  name: string;
  /** The tags of the data the query reads, from `tags.ts`. */
  tags: (...args: A) => string[];
  /** Seconds after which an entry is refreshed without an invalidation. Default: only by tag. */
  revalidate?: number | false;
  /**
   * `false`: a `null` result is returned but not stored. For lookups by a value from the URL (a
   * slug), where every made-up value a crawler tries would otherwise stay in the cache for good.
   */
  cacheNull?: boolean;
}

/** Thrown inside the cache callback so that the cache stores nothing; never leaves this file. */
class NotStored extends Error {}

type CacheFn = typeof unstable_cache;

/** Bump to drop every cached entry after a change in how results are shaped. */
const KEY_VERSION = 'v1';

/** Throws unless `value` survives a JSON round trip unchanged. */
export function assertCacheable(value: unknown, path = 'result'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`cachedQuery: ${path} is ${value}, which JSON cannot hold`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertCacheable(item, `${path}[${i}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      // An undefined property disappears in JSON, which changes nothing a reader can see.
      if (item !== undefined) assertCacheable(item, `${path}.${key}`);
    }
    return;
  }
  const kind = value instanceof Date ? 'a Date (return an ISO string)'
    : value === undefined ? 'undefined'
    : typeof value === 'object' ? 'not a plain object' : `a ${typeof value}`;
  throw new Error(`cachedQuery: ${path} is ${kind}; cached results must be plain JSON`);
}

/** Builds `cachedQuery` on a given cache function; tests pass a fake. */
export function createCachedQuery(cache: CacheFn) {
  return function cachedQuery<A extends KeyPart[], R>(
    fn: (...args: A) => Promise<R>,
    options: CachedQueryOptions<A>,
  ): (...args: A) => Promise<R> {
    if (!options.name) throw new Error('cachedQuery: a name is required');
    return (...args: A) => {
      const tagList = options.tags(...args);
      if (tagList.length === 0) throw new Error(`cachedQuery ${options.name}: a query without tags could never be refreshed`);
      const run = cache(
        async () => {
          const result = await fn(...args);
          if (result === null && options.cacheNull === false) throw new NotStored();
          assertCacheable(result);
          return result;
        },
        [KEY_VERSION, options.name, JSON.stringify(args)],
        { tags: tagList, revalidate: options.revalidate ?? false },
      );
      return run().catch((error: unknown) => {
        if (error instanceof NotStored) return null as R;
        throw error;
      });
    };
  };
}

export const cachedQuery = createCachedQuery(unstable_cache);
