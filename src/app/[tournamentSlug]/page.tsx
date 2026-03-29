"use client";

import { TournamentHomePage } from '@/components/tournament/MmrTournamentHomePage';

/**
 * Tournament home page — unified for all tournament types.
 * Conditional sections are rendered inside TournamentHomePage based on tournament type.
 */
export default function TournamentHomePageRoute() {
  return <TournamentHomePage />;
}
