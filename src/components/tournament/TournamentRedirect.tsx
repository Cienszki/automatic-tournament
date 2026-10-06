'use client';

// Sends visitors of a superseded tournament to its successor — `/pdl` -> `/pdl-s2`.
//
// Three rules keep this from becoming a trap:
//
//  1. NEVER redirects anything under /admin. An old season still needs to be
//     manageable, and an organiser who redirected it would otherwise have locked
//     themselves out of their own tournament.
//  2. `?noredirect=1` escapes it anywhere, so a public page can still be
//     inspected directly.
//  3. Single hop only. The target's own redirect is not chased, so a cycle
//     cannot be built by accident.
//
// Known limitation: this is a client-side redirect, so it costs a brief render
// and passes no 301 to search engines. Doing it properly needs middleware with a
// slug lookup on every request; not worth that cost until the redirects matter
// for SEO rather than convenience.

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import { Loader2 } from 'lucide-react';

export function TournamentRedirect({ children }: { children: React.ReactNode }) {
  const { tournament, tournamentSlug } = useTournament();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const target = tournament?.redirectToSlug?.trim() || null;
  const isAdminRoute = pathname?.includes('/admin') ?? false;
  const optedOut = searchParams.get('noredirect') === '1';
  const isSelf = !!target && !!tournamentSlug && target === tournamentSlug;
  const redirectable = !!target && !isAdminRoute && !optedOut && !isSelf;

  // Whole path segments only: "/pdl" must not match "/pdl-s2". After router.replace the
  // pathname is already "/pdl-s2" while the context still holds the old "pdl" tournament;
  // a plain startsWith("/pdl") then re-fired the redirect with the leftover "-s2" and sent
  // visitors to "/pdl-s2-s2" -> "Tournament not found".
  const underPath = (slug: string | null | undefined) =>
    !!slug && !!pathname && (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`));
  const onOldTournament = underPath(tournamentSlug);
  // Redirect already issued; the new tournament is still loading into the context.
  const handingOver = redirectable && underPath(target);

  const shouldRedirect = redirectable && onOldTournament;
  const redirectedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldRedirect || !target || !tournamentSlug || !pathname) return;
    // Fire once per old -> new pair, however often this effect re-runs mid-navigation
    const key = `${tournamentSlug}->${target}`;
    if (redirectedFor.current === key) return;
    redirectedFor.current = key;
    // Preserve the sub-path and query: /pdl/teams -> /pdl-s2/teams, /pdl?view=stats -> /pdl-s2?view=stats
    const rest = pathname.slice(`/${tournamentSlug}`.length);
    const query = searchParams.toString();
    router.replace(`/${target}${rest}${query ? `?${query}` : ''}`);
  }, [shouldRedirect, target, tournamentSlug, pathname, searchParams, router]);

  if (shouldRedirect || handingOver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Ten turniej ma nowszą edycję — przenosimy Cię...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* On /admin we suppress the redirect, so say why the public page differs. */}
      {target && isAdminRoute && (
        <div className="bg-sky-500/90 text-white text-sm px-4 py-1.5 text-center">
          Ten turniej przekierowuje odwiedzających na <strong>/{target}</strong>.
          Panel administracyjny działa normalnie.
        </div>
      )}
      {children}
    </>
  );
}
