// Which requests the new platform serves itself and which it forwards to the old site (ADR-15),
// read from environment variables once per process. No address of a real deployment is written in
// code; each environment sets its own (docs/DEV_SETUP.md):
//
//   PLATFORM_ROUTING  `on` switches the rules in decide.ts on. Anything else, or unset: the
//                     middleware behaves exactly as before WP-06, so a build of this branch for the
//                     old hosting serves the old pages.
//   LEGACY_ORIGIN     the old site's address, e.g. its hosting provider's own address. Unset: nothing
//                     is forwarded, and paths the platform does not serve fall to the old pages in
//                     this app (local runs).
//   LEGACY_SLUGS      comma-separated slugs of the tournaments the old site still serves. They are
//                     forwarded whole, even when they are also in the new database (a mirror).
//
// Why a list of the old site's slugs and not a lookup of the new database: see
// docs/overhaul/spikes/WP-06.md, "How the middleware knows which slugs are new". In short, the old
// site is frozen (ADR-15), so its list is short, shrinks at each go-live step, and never grows;
// every new tournament is on the new platform without any change here.

import { toOrigin } from '@/platform/origins/config.mjs';

export interface RoutingConfig {
  enabled: boolean;
  legacyOrigin: string | null;
  legacySlugs: ReadonlySet<string>;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function readRoutingConfig(env: Record<string, string | undefined>): RoutingConfig {
  const enabled = (env.PLATFORM_ROUTING ?? '').trim().toLowerCase() === 'on';
  const rawOrigin = (env.LEGACY_ORIGIN ?? '').trim();
  const legacyOrigin = rawOrigin ? toOrigin(rawOrigin) : null;
  if (enabled && rawOrigin && !legacyOrigin) {
    throw new Error('LEGACY_ORIGIN is not an http(s) address');
  }
  const legacySlugs = new Set<string>();
  for (const part of (env.LEGACY_SLUGS ?? '').split(',')) {
    const slug = part.trim().toLowerCase();
    if (!slug) continue;
    if (enabled && !SLUG.test(slug)) throw new Error(`LEGACY_SLUGS: ${JSON.stringify(slug)} is not a slug`);
    legacySlugs.add(slug);
  }
  return { enabled, legacyOrigin, legacySlugs };
}
