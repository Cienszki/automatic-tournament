'use client';

// Opening the match-prep tool from elsewhere (the schedule's next match, the my-team match card)
// already pointed at that match. Deliberately tiny: no engine, no stats model.

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import { getHomeSectionIndex, useHomeNavigation } from '@/context/HomeNavigationContext';

export const PREP_VIEW = 'przygotowanie';
export const PRESET_EVENT = 'draft-prep:preset';
/** The tournament key the prep tool stores its selections under */
export const prepTid = (tournamentId: string, isLegacy: boolean) => (isLegacy ? 'letnia' : tournamentId);
export const prepStorageKey = (tid: string) => `draft-prep:${tid}`;

/**
 * Point the prep tool at a match. With `us` the sides are fixed (my-team page); with only a pair the
 * captain's own team becomes "us" if it plays, else the first one (resolved by the tool).
 */
export function presetMatchPrep(tid: string, teams: { us?: string; them?: string; pair?: [string, string] }) {
  try {
    const s = JSON.parse(localStorage.getItem(prepStorageKey(tid)) || '{}');
    const n = teams.us && teams.them ? { ...s, pair: [teams.us, teams.them], pairUs: teams.us } : { ...s, pair: teams.pair, pairUs: undefined };
    localStorage.setItem(prepStorageKey(tid), JSON.stringify(n));
    window.dispatchEvent(new Event(PRESET_EVENT));
  } catch { /* storage blocked: the tool falls back to its own defaults */ }
}

/** Open the prep tool (inside the home page's stats section) on a given match */
export function useOpenMatchPrep() {
  const { tournament, isLegacyTournament, getTournamentPath } = useTournament();
  const { setStatsView, isHomeActive, goToHomeSection } = useHomeNavigation();
  const router = useRouter();
  return useCallback((teams: { us?: string; them?: string; pair?: [string, string] }) => {
    if (!tournament) return;
    presetMatchPrep(prepTid(tournament.id, isLegacyTournament), teams);
    if (isHomeActive()) {
      setStatsView(PREP_VIEW);
      goToHomeSection(getHomeSectionIndex('stats', { pickemEnabled: !!tournament.pickem?.enabled }) ?? 0);
    } else {
      router.push(`${getTournamentPath('')}?view=stats&sv=${PREP_VIEW}`);
    }
  }, [tournament, isLegacyTournament, getTournamentPath, setStatsView, isHomeActive, goToHomeSection, router]);
}
