"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import MyTeamView from '@/components/team/MyTeamView';

/** Letnia Batalia keeps its own page; every newer tournament manages the team on the account page */
export default function MyTeamPage() {
  const { tournament, isLegacyTournament, getTournamentPath } = useTournament();
  const router = useRouter();
  useEffect(() => {
    if (tournament && !isLegacyTournament) router.replace(getTournamentPath('/account'));
  }, [tournament, isLegacyTournament, getTournamentPath, router]);
  return isLegacyTournament ? <MyTeamView /> : null;
}
