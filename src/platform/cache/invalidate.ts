// `invalidate(tags)`: marks every cached query and every cached page that read one of these tags
// as stale, so the next request renders fresh data (ADR-02, ADR-12). Commands and jobs call it with
// the tags of what they changed, built with `tags.ts`.

import { revalidateTag } from 'next/cache';

/** Builds `invalidate` on a given revalidation function; tests pass a fake. */
export function createInvalidate(revalidate: (tag: string) => void) {
  return function invalidate(tagList: readonly string[]): void {
    for (const tag of new Set(tagList)) revalidate(tag);
  };
}

export const invalidate = createInvalidate(revalidateTag);
