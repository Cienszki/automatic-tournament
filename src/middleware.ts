import { NextResponse, type NextRequest } from 'next/server';
import { decideRoute, readRoutingConfig, type RoutingConfig } from '@/platform/routing';

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

const ROUTE_HEADER = 'x-platform-route';

// Read once per server process (or edge isolate); the variables are fixed per deployment.
let routing: RoutingConfig | undefined;

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(CLOSED_PREFIX)) {
    return NextResponse.json({ success: false, error: 'Gone — the admin API moved to /api/manage' }, { status: 410 });
  }
  const pathname = request.nextUrl.pathname.replace(RSC_SUFFIX, '') || '/';
  routing ??= readRoutingConfig(process.env);
  const decision = decideRoute(pathname, request.nextUrl.search, routing);

  // Says which way the request went, for the WP-06 measurements and for debugging a forward.
  const headers = routing.enabled ? { [ROUTE_HEADER]: decision.kind } : undefined;
  if (decision.kind === 'forward') return NextResponse.rewrite(new URL(decision.url), { headers });
  if (decision.kind === 'not-found') return new NextResponse(null, { status: 404, headers });
  // With routing on, a moved page or a served path goes on unchanged: next.config.mjs rewrites the
  // moved pages to /platform/... and strips the .rsc suffix (src/platform/routing/rules.mjs says
  // why the middleware must not). With routing off, the suffix is stripped here, as before.
  if (routing.enabled || pathname === request.nextUrl.pathname) return NextResponse.next({ headers });
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url, { headers });
}

// Every page and route, but not this build's static files or files with an extension (images,
// fonts, sitemap.xml, robots.txt): those are served without running the middleware. `.rsc`
// paths are listed on their own because they have an extension.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp4|webm|txt|xml|json|webmanifest|js|mjs|css|map)$).*)',
    '/(.*\\.rsc)',
  ],
};
