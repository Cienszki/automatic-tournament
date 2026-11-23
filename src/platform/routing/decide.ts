// The forwarding rule (ADR-15): for one request path, serve it here, render it on the new platform,
// or forward it to the old site. Pure and small, because it runs in the edge middleware on every
// page request: no database, no schema library, no logger.
//
// With routing on, the new platform serves:
//   - the pages it has moved (PLATFORM_PAGES) of every tournament that is not on LEGACY_SLUGS;
//     next.config.mjs rewrites them to /platform/<slug>/<page> (rules.mjs says why not here);
//   - its own API under /api/platform/, and the prototypes.
// Everything else (old-site tournaments, pages not moved yet, the old /api/ routes, the home page)
// goes to LEGACY_ORIGIN when it is set, and otherwise to the old pages that are still in this app.
// The old site's /_next/ files never reach the middleware: the config's fallback rewrite forwards
// the ones this build does not have.

import { PLATFORM_PAGES, PLATFORM_PREFIX, SLUG_PATTERN, type RoutingConfig } from './rules.mjs';

/** Paths of the new app that are never forwarded. */
const OWN_PREFIXES = ['/api/platform/', '/prototype/'];
const OWN_PATHS = new Set(['/api/platform', '/prototype']);

const SLUG = new RegExp(`^${SLUG_PATTERN}$`);
const PAGES: ReadonlySet<string> = new Set(PLATFORM_PAGES);

export type RouteDecision =
  /** Serve the path in this app as it is. */
  | { kind: 'serve' }
  /** A moved page: the config rewrites it to this internal path (the URL in the browser stays). */
  | { kind: 'platform'; pathname: string }
  /** Proxy the request to this absolute URL on the old site. */
  | { kind: 'forward'; url: string }
  | { kind: 'not-found' };

function forwardOrServe(pathname: string, search: string, config: RoutingConfig): RouteDecision {
  return config.legacyOrigin ? { kind: 'forward', url: `${config.legacyOrigin}${pathname}${search}` } : { kind: 'serve' };
}

/** `pathname` is the path as the URL has it, without a `.rsc` suffix; `search` includes its `?`, or is empty. */
export function decideRoute(pathname: string, search: string, config: RoutingConfig): RouteDecision {
  if (!config.enabled) return { kind: 'serve' };
  if (pathname === PLATFORM_PREFIX || pathname.startsWith(`${PLATFORM_PREFIX}/`)) return { kind: 'not-found' };
  if (OWN_PATHS.has(pathname) || OWN_PREFIXES.some((p) => pathname.startsWith(p))) return { kind: 'serve' };
  // The old site's routes; `api` is never a tournament.
  if (pathname === '/api' || pathname.startsWith('/api/')) return forwardOrServe(pathname, search, config);

  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  if (match) {
    const slug = match[1];
    const rest = (match[2] ?? '').replace(/\/+$/, '');
    if (SLUG.test(slug) && !config.legacySlugs.has(slug) && PAGES.has(rest)) {
      return { kind: 'platform', pathname: `${PLATFORM_PREFIX}/${slug}${rest}` };
    }
  }
  return forwardOrServe(pathname, search, config);
}
