"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import MyTeamView from '@/components/team/MyTeamView';

/** Letnia Batalia keeps its own page; every newer tournament manages the team on the account page */
export default function MyTeamPage() {
  const { tournament, isLegacyTournament, getTournamentPath } = useTournament();
  const router = useRouter();
  const pathname = usePathname();
  // Only when this really is the /my-team address (never when the component is shown elsewhere)
  const onMyTeam = /\/my-team\/?$/.test(pathname ?? '');
  useEffect(() => {
    if (onMyTeam && tournament && !isLegacyTournament) router.replace(getTournamentPath('/account'));
  }, [onMyTeam, tournament, isLegacyTournament, getTournamentPath, router]);
  return isLegacyTournament ? <MyTeamView /> : null;
}
