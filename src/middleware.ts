import { NextResponse, type NextRequest } from 'next/server';

// dota2inhouse.pl is the community site on Vercel; paths it doesn't own reach
// us through its fallback rewrite. Vercel's Next.js routing first turns every
// client-side navigation/prefetch request (`RSC: 1`) for `/x` into `/x.rsc`,
// and the rewrite forwards that path unchanged — so we'd render the tournament
// slug "pdl-s2.rsc" (or 404 on `/pdl-s2/teams.rsc`) and in-app navigation
// breaks until a hard refresh. Our own server never adds the suffix (Next only
// strips it in Vercel's minimal mode), so strip it here before routing.
const RSC_SUFFIX = /(\.prefetch)?\.rsc$/;

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = url.pathname.replace(RSC_SUFFIX, '') || '/';
  return NextResponse.rewrite(url);
}

// Only `.rsc` paths — everything else skips middleware entirely.
export const config = {
  matcher: '/(.*\\.rsc)',
};
