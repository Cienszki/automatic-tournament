// platform/routing: which requests the new platform serves and which go to the old site (ADR-15).
// Owns the forwarding rule and the rewrite of moved tournament pages, both as config rewrites
// built from PLATFORM_ROUTING, LEGACY_ORIGIN and LEGACY_SLUGS when the app is built (rules.mjs).
// Does not own custom domains (WP-26) or the .rsc fix, the closed /api/admin prefix and the 404 on
// /platform/*, which are in src/middleware.ts.
// Entry points: readRoutingConfig, platformRewrites, legacyFallbackRewrites, routingHeaders, for
// next.config.mjs.

export {
  legacyFallbackRewrites, platformRewrites, readRoutingConfig, routingHeaders, NOT_SLUGS, PLATFORM_PAGES, PLATFORM_PREFIX,
  type RoutingConfig,
} from './rules.mjs';
