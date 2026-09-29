'use client';

// Hides a tournament that has not been published yet.
//
// Before this existed, `status: 'draft'` + `visibility: 'inactive'` only kept a
// tournament off the landing-page LIST — the tournament itself was fully
// readable by anyone with the URL, and crawlable. The wizard creates drafts, so
// that made "draft" mean "unlisted" rather than "not published yet".
//
// Three ways past the gate:
//   1. the tournament is published (anything other than status 'draft')
//   2. ?preview=<token> matches the tournament's previewToken
//   3. the viewer is an admin of this tournament
//
// Honest limitation: tournament documents are public-read in firestore.rules, so
// the preview token is discoverable by anyone willing to query Firestore
// directly. It is a "don't show this to visitors and search engines" control,
// not a security boundary. Making it a real one means denying reads of draft
// tournaments in rules and routing previews through a server route — worth doing
// if drafts ever hold anything sensitive.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { checkIfAdmin } from '@/lib/auth';
import { FileClock, Eye } from 'lucide-react';

export function DraftGate({ children }: { children: React.ReactNode }) {
  const { tournament } = useTournament();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const isDraft = tournament?.status === 'draft';

  useEffect(() => {
    if (!isDraft || !user || !tournament?.id) {
      setAdminChecked(true);
      return;
    }
    let cancelled = false;
    checkIfAdmin(user, tournament.id)
      .then(ok => { if (!cancelled) { setIsAdmin(ok); setAdminChecked(true); } })
      .catch(() => { if (!cancelled) setAdminChecked(true); });
    return () => { cancelled = true; };
  }, [isDraft, user, tournament?.id]);

  // Keep drafts out of search results even when previewed.
  useEffect(() => {
    if (!isDraft) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, [isDraft]);

  if (!tournament || !isDraft) return <>{children}</>;

  const token = searchParams.get('preview');
  const hasValidToken =
    !!token && !!tournament.previewToken && token === tournament.previewToken;

  if (!hasValidToken && !isAdmin) {
    // Wait for the admin check before showing the wall, so an organizer does not
    // see "not published" flash on every navigation.
    if (user && !adminChecked) return null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center bg-card border border-border rounded-xl p-8 shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <FileClock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Turniej nie został jeszcze opublikowany</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Organizator wciąż go przygotowuje. Zajrzyj tu ponownie, gdy ruszy rejestracja.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-lg border border-border font-medium hover:bg-muted transition-colors"
          >
            Zobacz inne turnieje
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Standing reminder that what you are looking at is not public yet. */}
      <div className="sticky top-0 z-[60] bg-amber-500 text-black text-sm font-medium px-4 py-1.5 flex items-center justify-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          Podgląd wersji roboczej — ta strona nie jest jeszcze widoczna publicznie.
        </span>
      </div>
      {children}
    </>
  );
}
