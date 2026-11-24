// Which requests the new platform serves and which go to the old site (ADR-15), as config
// rewrites. Plain JavaScript on purpose: next.config.mjs imports it, and the config cannot load
// TypeScript. No address of a real deployment is written here; each environment sets its own
// (docs/DEV_SETUP.md):
//
//   PLATFORM_ROUTING  `on` switches the rules on. Anything else, or unset: no rewrite exists and
//                     the middleware does what it did before WP-06, so a build of this branch for
//                     the old hosting serves the old pages.
//   LEGACY_ORIGIN     the old site's address. Unset: nothing is forwarded, and what the platform
//                     does not serve falls to the old pages in this app (local runs).
//   LEGACY_SLUGS      comma-separated slugs of the tournaments the old site still serves. They are
//                     forwarded whole, even when they are also in the new database (a mirror).
//
// All three are read when the app is built, never at run time: changing one on a deployment does
// nothing until it is rebuilt, and a malformed value fails the build, not every request.
//
// Why rewrites and not the middleware: the middleware would have to run on every request (its
// matcher cannot depend on a variable), and under `next start` a page reached through a
// middleware rewrite is never static, while one reached through a config rewrite is. Why a list of
// the old site's slugs and not a lookup of the new database: docs/overhaul/spikes/WP-06.md, "How
// the middleware knows which slugs are new".

import { toOrigin } from '../origins/config.mjs';

/** Where the moved pages live inside the app; never addressed from outside (src/middleware.ts). */
export const PLATFORM_PREFIX = '/platform';

/** Tournament pages the new platform renders, as the path after the slug. WP-09 adds the rest. */
export const PLATFORM_PAGES = ['/teams'];

/** First path parts that are never a tournament (also reserved in src/lib/reserved-slugs.ts). */
export const NOT_SLUGS = ['api', 'platform', 'prototype', '_next'];

/** The slug rule of app.tournaments. */
export const SLUG_PATTERN = '[a-z0-9][a-z0-9-]{0,62}';
const SLUG = new RegExp(`^${SLUG_PATTERN}$`);

/**
 * Paths of the new app that are never forwarded: its internal pages, its API (`/api/v1/...`, the
 * versioned public API, and `/api/platform/...`), prototypes, assets. Each entry reserves every path
 * under it, so the old site must never add a route under `/api/v1` while forwarding is on (it has none).
 */
const OWN = ['platform', 'prototype', '_next', 'api/platform', 'api/v1'];

/** Files of this build, served as they are (`.rsc` is a client navigation, not a file). */
const FILE_EXTENSIONS = 'png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp4|webm|txt|xml|json|webmanifest|js|mjs|css|map';

/**
 * @typedef {{ enabled: boolean, legacyOrigin: string | null, legacySlugs: ReadonlySet<string> }} RoutingConfig
 * @typedef {{ source: string, destination: string }} Rewrite
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
 * The source patterns of the moved pages: /<slug>/<page>, with and without the `.rsc` suffix that
 * client navigations carry when they come through the community site, for every slug that is not
 * on the old-site list and is not a word that is never a tournament.
 * @param {RoutingConfig} config
 */
function platformSources(config) {
  const excluded = [...NOT_SLUGS, ...config.legacySlugs].join('|');
  // "Not one of these words, unless more slug characters follow": `$` would mean the end of the
  // whole path here, not of the slug, since the page follows the parameter.
  const slug = `:tournamentSlug((?!(?:${excluded})(?![a-z0-9-]))${SLUG_PATTERN})`;
  return PLATFORM_PAGES.flatMap((page) => ['\\.prefetch\\.rsc', '\\.rsc', ''].map((suffix) => ({
    source: `/${slug}${page}${suffix}`,
    destination: `${PLATFORM_PREFIX}/:tournamentSlug${page}`,
  })));
}

/** Everything that is not the new app's own and not one of its files. */
const FORWARDED_PATH = `/:path((?!(?:${OWN.join('|')})(?:/|$))(?!.*\\.(?:${FILE_EXTENSIONS})$).+)`;

/**
 * The rewrites run before the app's own pages (`beforeFiles`), in this order, empty when routing
 * is off. Next applies them one after another to the rewritten path, so a moved page, once it is
 * /platform/..., is not caught by the forward that follows.
 *   1. The moved pages of new tournaments to /platform/<slug>/<page>.
 *   2. With LEGACY_ORIGIN: the home page and every other path that is not the new app's own and not
 *      a file to the old site, with its query. That is old-site tournaments, pages not moved yet,
 *      the old /api/ routes. A client navigation keeps its `.rsc` suffix, which the old site strips.
 *   3. The `.rsc` suffix off every path left, as src/middleware.ts does with routing off.
 * @param {RoutingConfig} config
 * @returns {Rewrite[]}
 */
export function platformRewrites(config) {
  if (!config.enabled) return [];
  const forward = config.legacyOrigin
    ? [
      { source: '/', destination: `${config.legacyOrigin}/` },
      { source: FORWARDED_PATH, destination: `${config.legacyOrigin}/:path` },
    ]
    : [];
  return [
    ...platformSources(config),
    ...forward,
    { source: '/:path(.+)\\.prefetch\\.rsc', destination: '/:path' },
    { source: '/:path(.+)\\.rsc', destination: '/:path' },
  ];
}

/**
 * The fallback rewrite to the old site: a path this build has no page, route or file for, above
 * all the old site's own /_next/ files, which its pages load through us once they are forwarded.
 * @param {RoutingConfig} config
 * @returns {Rewrite[]}
 */
export function legacyFallbackRewrites(config) {
  if (!config.enabled || !config.legacyOrigin) return [];
  return [{ source: '/:path*', destination: `${config.legacyOrigin}/:path*` }];
}

/**
 * `x-platform-route: platform` on the moved pages, for the WP-06 measurements. Forwards carry no
 * mark: a header rule matches the original path, where the forward's pattern also matches a moved
 * page. They are told apart by their content (scripts/measure/forwarding.ts).
 * @param {RoutingConfig} config
 * @returns {{ source: string, headers: { key: string, value: string }[] }[]}
 */
export function routingHeaders(config) {
  if (!config.enabled) return [];
  return platformSources(config).map((r) => ({ source: r.source, headers: [{ key: 'x-platform-route', value: 'platform' }] }));
}
