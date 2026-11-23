import { NextResponse, type NextRequest } from 'next/server';

// dota2inhouse.pl is the community site on Vercel; paths it doesn't own reach
// us through its fallback rewrite. Vercel's Next.js routing first turns every
// client-side navigation/prefetch request (`RSC: 1`) for `/x` into `/x.rsc`,
// and the rewrite forwards that path unchanged — so we'd render the tournament
// slug "pdl-s2.rsc" (or 404 on `/pdl-s2/teams.rsc`) and in-app navigation
// breaks until a hard refresh. Our own server never adds the suffix (Next only
// strips it in Vercel's minimal mode), so strip it here before routing.
const RSC_SUFFIX = /(\.prefetch)?\.rsc$/;

// The admin API lives at /api/manage/* and checks the caller on every route.
// Anything still under the old /api/admin prefix (one-off debug and migration
// routes that never checked who called them) is closed. The community site also
// claims every /api/admin* path on dota2inhouse.pl, so nothing of ours may live there.
const CLOSED_PREFIX = '/api/admin';

// The new platform's pages before WP-08 live under /platform/<slug>/...; visitors reach them only
// through the config rewrites of src/platform/routing/rules.mjs, which do not run the middleware
// again. From outside the address does not exist, whether the routing is on or not.
const PLATFORM_PREFIX = '/platform';

// Set by next.config.mjs when the app is built (PLATFORM_ROUTING=on), so that it always agrees with
// the built rewrites; changing PLATFORM_ROUTING on a running deployment has no effect.
const ROUTING_ON = process.env.PLATFORM_ROUTING_AT_BUILD === 'on';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(CLOSED_PREFIX)) {
    return NextResponse.json({ success: false, error: 'Gone — the admin API moved to /api/manage' }, { status: 410 });
  }
  if (pathname === PLATFORM_PREFIX || pathname.startsWith(`${PLATFORM_PREFIX}/`)) {
    return new NextResponse(null, { status: 404 });
  }
  // With the routing on, the config rewrites strip the suffix: under `next start` a middleware
  // rewrite next to them falls through to the fallback rewrite (docs/overhaul/spikes/WP-06.md).
  if (ROUTING_ON) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = url.pathname.replace(RSC_SUFFIX, '') || '/';
  return NextResponse.rewrite(url);
}

// Only `.rsc` paths, the closed prefix and the internal platform address; everything else skips
// the middleware entirely. On the old hosting (Firebase's adapter) a route the middleware matches
// is served by Cloud Run instead of the CDN, so the matcher stays this narrow.
export const config = {
  matcher: ['/(.*\\.rsc)', '/api/admin(.*)', '/platform', '/platform/:path*'],
};
