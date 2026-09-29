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

import React, { useEffect } from 'react';
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

  const shouldRedirect = !!target && !isAdminRoute && !optedOut && !isSelf;

  useEffect(() => {
    if (!shouldRedirect || !target || !tournamentSlug) return;
    // Preserve the sub-path: /pdl/teams -> /pdl-s2/teams
    const rest = pathname?.startsWith(`/${tournamentSlug}`)
      ? pathname.slice(`/${tournamentSlug}`.length)
      : '';
    router.replace(`/${target}${rest}`);
  }, [shouldRedirect, target, tournamentSlug, pathname, router]);

  if (shouldRedirect) {
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
