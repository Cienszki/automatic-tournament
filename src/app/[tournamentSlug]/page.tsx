"use client";

import { Suspense } from 'react';
import { TournamentHomePage } from '@/components/tournament/FullScreenHomePage';

/**
 * Tournament home page — unified for all tournament types.
 * Full-screen snap-scrolling layout with 5 views.
 */
export default function TournamentHomePageRoute() {
  return (
    <Suspense>
      <TournamentHomePage />
    </Suspense>
  );
}
