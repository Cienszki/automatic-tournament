// platform/cache: the server data cache, keyed and tagged per tournament (ADR-02, ADR-12).
// Owns: `cachedQuery` (wrap a read), `tags` and `tournamentTags` (the only place tags are spelled),
// and `invalidate` (what a command or job calls with the tags of what it changed).
// Does not own: the reads themselves (each feature's queries.ts) or CDN headers (Next sets them
// for static and ISR pages from the same tags).

import 'server-only';

export { cachedQuery, assertCacheable, type CachedQueryOptions, type KeyPart } from './cached-query';
export { invalidate } from './invalidate';
export { tags, tournamentTags, TAG_KINDS, type TagKind } from './tags';
