"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { LeagueHomePage } from '@/components/tournament/LeagueHomePage';
import { MmrTournamentHomePage } from '@/components/tournament/MmrTournamentHomePage';

/**
 * Tournament home page
 * Renders different content based on tournament type
 */
export default function TournamentHomePage() {
  const { tournament } = useTournament();
  const { isLeague } = useTournamentType();

  if (!tournament) {
    return null;
  }

  // Render appropriate home page based on tournament type
  if (isLeague) {
    return <LeagueHomePage />;
  }

  return <MmrTournamentHomePage />;
}
