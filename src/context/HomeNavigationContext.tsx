"use client";

import React, { createContext, useContext, useRef, useCallback, useState } from 'react';

interface HomeNavigationContextValue {
  /** Register the homepage's goToSection function. Pass null when unmounting. */
  registerGoToSection: (fn: ((index: number) => void) | null) => void;
  /** Scroll the homepage to a specific section index (no-op if not on homepage). */
  goToHomeSection: (index: number) => void;
  /** Returns true if the homepage is currently mounted and registered. */
  isHomeActive: () => boolean;
  /** The currently selected group/division ID to show inline, or null for the overview grid. */
  selectedGroupId: string | null;
  /** Directly set the selected group without scrolling. */
  setSelectedGroupId: (id: string | null) => void;
  /** Scroll to section 1 (groups) and show a specific group/division inline. */
  goToGroup: (id: string) => void;
  /** The team ID to highlight/expand in the Teams section, or null. */
  highlightedTeamId: string | null;
  /** Directly set the highlighted team ID without scrolling. */
  setHighlightedTeamId: (id: string | null) => void;
  /** Scroll to section 3 (teams) and expand a specific team card. */
  goToTeam: (id: string) => void;
  /** Which view section 1 shows when playoffs are visible: the bracket or the tables. */
  section1View: 'playoffs' | 'groups';
  /** Set section 1's view (driven by the navbar's Playoffs / Grupy buttons). */
  setSection1View: (view: 'playoffs' | 'groups') => void;
  /** A stats-hub view (catalog id) the stats section should open, or null once it has. */
  statsView: string | null;
  /** Ask the stats section to open a view; the hub clears it after switching. */
  setStatsView: (view: string | null) => void;
}

const HomeNavigationContext = createContext<HomeNavigationContextValue>({
  registerGoToSection: () => {},
  goToHomeSection: () => {},
  isHomeActive: () => false,
  selectedGroupId: null,
  setSelectedGroupId: () => {},
  goToGroup: () => {},
  highlightedTeamId: null,
  setHighlightedTeamId: () => {},
  goToTeam: () => {},
  section1View: 'playoffs',
  setSection1View: () => {},
  statsView: null,
  setStatsView: () => {},
});

export function HomeNavigationProvider({ children }: { children: React.ReactNode }) {
  const goToSectionRef = useRef<((index: number) => void) | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(null);
  const [section1View, setSection1View] = useState<'playoffs' | 'groups'>('playoffs');
  const [statsView, setStatsView] = useState<string | null>(null);

  const registerGoToSection = useCallback((fn: ((index: number) => void) | null) => {
    goToSectionRef.current = fn;
  }, []);

  const goToHomeSection = useCallback((index: number) => {
    goToSectionRef.current?.(index);
  }, []);

  const isHomeActive = useCallback(() => goToSectionRef.current !== null, []);

  const goToGroup = useCallback((id: string) => {
    setSelectedGroupId(id);
    setSection1View('groups');
    goToSectionRef.current?.(1);
  }, []);

  const goToTeam = useCallback((id: string) => {
    setHighlightedTeamId(id);
    goToSectionRef.current?.(3);
  }, []);

  return (
    <HomeNavigationContext.Provider value={{ registerGoToSection, goToHomeSection, isHomeActive, selectedGroupId, setSelectedGroupId, goToGroup, highlightedTeamId, setHighlightedTeamId, goToTeam, section1View, setSection1View, statsView, setStatsView }}>
      {children}
    </HomeNavigationContext.Provider>
  );
}

export const useHomeNavigation = () => useContext(HomeNavigationContext);

/** All homepage sections in display order; optional ones are dropped by getHomeSections. */
const HOME_SECTION_ORDER = ['start', 'groups', 'schedule', 'teams', 'stats', 'pickem', 'my-team'] as const;
export type HomeSectionKey = (typeof HOME_SECTION_ORDER)[number];

export interface HomeSectionOptions {
  /** tournament.pickem?.enabled — a disabled Pick'em gets no section at all */
  pickemEnabled: boolean;
  /** The signed-in user captains a team in this tournament */
  hasTeam: boolean;
}

/** Sections FullScreenHomePage renders for this tournament/user, in order (index = section index). */
export function getHomeSections({ pickemEnabled, hasTeam }: HomeSectionOptions): HomeSectionKey[] {
  return HOME_SECTION_ORDER.filter(key => (key !== 'pickem' || pickemEnabled) && (key !== 'my-team' || hasTeam));
}

/**
 * `?view=` keys that open a view inside the stats section rather than a section of their own
 * (key → stats-hub catalog id). Rankings used to be a section; old links still land on it.
 */
export const STATS_VIEW_KEYS: Record<string, string> = { rankings: 'rankingi', prep: 'przygotowanie' };

/**
 * Section index for a view key (`?view=` values and navbar targets), or undefined when the
 * section doesn't exist. "playoffs" shares the groups section, "rankings" lives in stats.
 * Sections before Pick'em never move, so callers that don't know hasTeam can omit it —
 * "my-team" is always last.
 */
export function getHomeSectionIndex(view: string, { pickemEnabled, hasTeam = true }: Pick<HomeSectionOptions, 'pickemEnabled'> & Partial<HomeSectionOptions>): number | undefined {
  const key = view === 'playoffs' ? 'groups' : STATS_VIEW_KEYS[view] ? 'stats' : view;
  const index = getHomeSections({ pickemEnabled, hasTeam }).indexOf(key as HomeSectionKey);
  return index === -1 ? undefined : index;
}
