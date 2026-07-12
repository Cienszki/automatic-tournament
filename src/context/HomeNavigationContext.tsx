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
});

export function HomeNavigationProvider({ children }: { children: React.ReactNode }) {
  const goToSectionRef = useRef<((index: number) => void) | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(null);
  const [section1View, setSection1View] = useState<'playoffs' | 'groups'>('playoffs');

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
    <HomeNavigationContext.Provider value={{ registerGoToSection, goToHomeSection, isHomeActive, selectedGroupId, setSelectedGroupId, goToGroup, highlightedTeamId, setHighlightedTeamId, goToTeam, section1View, setSection1View }}>
      {children}
    </HomeNavigationContext.Provider>
  );
}

export const useHomeNavigation = () => useContext(HomeNavigationContext);

/** Maps view key strings to section indices in FullScreenHomePage. */
export const HOME_VIEW_TO_SECTION: Record<string, number> = {
  groups: 1,
  playoffs: 1, // playoffs replaces groups/divisions in section 1
  schedule: 2,
  teams: 3,
  rankings: 4,
  stats: 5,
  pickem: 6,
  'my-team': 7,
};
