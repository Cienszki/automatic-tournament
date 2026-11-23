// platform/routing: what the edge middleware decides for each request (ADR-15). Owns the
// forwarding rule to the old site and the rewrite of moved tournament pages to the new platform.
// Does not own custom domains (WP-26 adds the Host lookup here) or the old .rsc fix and the closed
// /api/admin prefix, which stay in src/middleware.ts.
// Entry points: readRoutingConfig(env), decideRoute(pathname, search, config). Edge code: keep it
// free of imports beyond these two files.

export { readRoutingConfig, type RoutingConfig } from './config';
export { decideRoute, PLATFORM_PAGES, PLATFORM_PREFIX, type RouteDecision } from './decide';
