'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

/**
 * For old standalone routes whose content now lives in a home-page section: replaces the URL with
 * the home page opened on that section (`?view=…`, see getHomeSectionIndex).
 */
export function HomeViewRedirect({ view }: { view: string }) {
  const router = useRouter();
  const { getTournamentPath } = useTournament();
  useEffect(() => {
    router.replace(`${getTournamentPath('')}?view=${view}`);
  }, [router, getTournamentPath, view]);
  return <LoadingScreen />;
}
