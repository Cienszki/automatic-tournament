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

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(CLOSED_PREFIX)) {
    return NextResponse.json({ success: false, error: 'Gone — the admin API moved to /api/manage' }, { status: 410 });
  }
  const url = request.nextUrl.clone();
  url.pathname = url.pathname.replace(RSC_SUFFIX, '') || '/';
  return NextResponse.rewrite(url);
}

// Only `.rsc` paths and the closed prefix — everything else skips middleware entirely.
export const config = {
  matcher: ['/(.*\\.rsc)', '/api/admin(.*)'],
};
