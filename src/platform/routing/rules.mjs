// Which requests the new platform serves and which go to the old site (ADR-15): the settings and
// the rewrites of moved pages. Plain JavaScript on purpose: next.config.mjs imports it as well as
// the middleware, and the config cannot load TypeScript. No address of a real deployment is
// written here; each environment sets its own (docs/DEV_SETUP.md):
//
//   PLATFORM_ROUTING  `on` switches the rules on. Anything else, or unset: the middleware and the
//                     config behave exactly as before WP-06, so a build of this branch for the old
//                     hosting serves the old pages.
//   LEGACY_ORIGIN     the old site's address. Unset: nothing is forwarded, and what the platform
//                     does not serve falls to the old pages in this app (local runs).
//   LEGACY_SLUGS      comma-separated slugs of the tournaments the old site still serves. They are
//                     forwarded whole, even when they are also in the new database (a mirror).
//
// The moved pages are rewritten by next.config.mjs (`platformRewrites`), not by the middleware:
// `next start` serves a page reached through a middleware rewrite without its cache (the route
// module re-reads the original URL and applies only config rewrites), so it would never be static
// outside Vercel. Both read these variables; a change to them needs a new deployment, which is
// true for middleware variables on Vercel anyway.
//
// Why a list of the old site's slugs and not a lookup of the new database: see
// docs/overhaul/spikes/WP-06.md, "How the middleware knows which slugs are new".

import { toOrigin } from '../origins/config.mjs';

/** Where the moved pages live inside the app; never addressed from outside. */
export const PLATFORM_PREFIX = '/platform';

/** Tournament pages the new platform renders, as the path after the slug. WP-09 adds the rest. */
export const PLATFORM_PAGES = ['/teams'];

/** First path parts that are never a tournament (also reserved in src/lib/reserved-slugs.ts). */
export const NOT_SLUGS = ['api', 'platform', 'prototype', '_next'];

/** The slug rule of app.tournaments. */
export const SLUG_PATTERN = '[a-z0-9][a-z0-9-]{0,62}';
const SLUG = new RegExp(`^${SLUG_PATTERN}$`);

/**
 * @typedef {{ enabled: boolean, legacyOrigin: string | null, legacySlugs: ReadonlySet<string> }} RoutingConfig
 */

/**
 * @param {Record<string, string | undefined>} env
 * @returns {RoutingConfig}
 */
export function readRoutingConfig(env) {
  const enabled = (env.PLATFORM_ROUTING ?? '').trim().toLowerCase() === 'on';
  const rawOrigin = (env.LEGACY_ORIGIN ?? '').trim();
  const legacyOrigin = rawOrigin ? toOrigin(rawOrigin) : null;
  if (enabled && rawOrigin && !legacyOrigin) throw new Error('LEGACY_ORIGIN is not an http(s) address');
  /** @type {Set<string>} */
  const legacySlugs = new Set();
  for (const part of (env.LEGACY_SLUGS ?? '').split(',')) {
    const slug = part.trim().toLowerCase();
    if (!slug) continue;
    if (enabled && !SLUG.test(slug)) throw new Error(`LEGACY_SLUGS: ${JSON.stringify(slug)} is not a slug`);
    legacySlugs.add(slug);
  }
  return { enabled, legacyOrigin, legacySlugs };
}

/**
 * The config rewrites, run before the app's own pages (`beforeFiles`), empty when routing is off:
 *   - /<slug>/<page> to /platform/<slug>/<page> for every moved page, except for old-site slugs and
 *     the paths that are never a tournament, also with the `.rsc` suffix of a client navigation that
 *     came through the community site;
 *   - any other path with that suffix to the path without it (src/middleware.ts says why it exists).
 * With routing on, the middleware itself rewrites nothing inside the app: under `next start`, a
 * middleware rewrite inside the app combined with these rules lands on the fallback rewrite, so the
 * suffix is stripped here instead.
 * @param {RoutingConfig} config
 * @returns {{ source: string, destination: string }[]}
 */
export function platformRewrites(config) {
  if (!config.enabled) return [];
  const excluded = [...NOT_SLUGS, ...config.legacySlugs].join('|');
  // "Not one of these words, unless more slug characters follow": `$` would mean the end of the
  // whole path here, not of the slug, since the page follows the parameter.
  const slug = `:tournamentSlug((?!(?:${excluded})(?![a-z0-9-]))${SLUG_PATTERN})`;
  return [
    ...PLATFORM_PAGES.flatMap((page) => ['.prefetch.rsc', '.rsc', ''].map((suffix) => ({
      source: `/${slug}${page}${suffix.replace(/\./g, '\\.')}`,
      destination: `${PLATFORM_PREFIX}/:tournamentSlug${page}`,
    }))),
    { source: '/:path(.+)\\.prefetch\\.rsc', destination: '/:path' },
    { source: '/:path(.+)\\.rsc', destination: '/:path' },
  ];
}

/**
 * The fallback rewrite to the old site: a path this build has no page, route or file for, above
 * all the old site's own /_next/ files, which its pages load through us once they are forwarded.
 * @param {RoutingConfig} config
 * @returns {{ source: string, destination: string }[]}
 */
export function legacyFallbackRewrites(config) {
  if (!config.enabled || !config.legacyOrigin) return [];
  return [{ source: '/:path*', destination: `${config.legacyOrigin}/:path*` }];
}
