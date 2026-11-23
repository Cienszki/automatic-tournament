// A JSON response for public data that a CDN may keep: `Cache-Control` with `s-maxage` (the CDN
// keeps it) and `stale-while-revalidate`, and gzip when the client accepts it. Never for data
// that depends on who asks (ADR-12).

import { gzipSync } from 'node:zlib';

export interface CdnCache {
  /** Seconds the CDN serves the response without asking the server. */
  sMaxAge: number;
  /** Seconds after that it may still serve it while it fetches a fresh one. */
  staleWhileRevalidate: number;
}

export function publicJson(request: Request, body: unknown, cache: CdnCache): Response {
  const json = JSON.stringify(body);
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    // max-age=0: browsers ask again; the CDN answers from its copy.
    'Cache-Control': `public, max-age=0, s-maxage=${cache.sMaxAge}, stale-while-revalidate=${cache.staleWhileRevalidate}`,
    Vary: 'Accept-Encoding',
  });
  if (!/\bgzip\b/i.test(request.headers.get('accept-encoding') ?? '')) return new Response(json, { headers });
  headers.set('Content-Encoding', 'gzip');
  return new Response(new Uint8Array(gzipSync(json)), { headers });
}
