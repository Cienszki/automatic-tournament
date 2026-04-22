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
}

const HomeNavigationContext = createContext<HomeNavigationContextValue>({
  registerGoToSection: () => {},
  goToHomeSection: () => {},
  isHomeActive: () => false,
  selectedGroupId: null,
  setSelectedGroupId: () => {},
  goToGroup: () => {},
});

export function HomeNavigationProvider({ children }: { children: React.ReactNode }) {
  const goToSectionRef = useRef<((index: number) => void) | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const registerGoToSection = useCallback((fn: ((index: number) => void) | null) => {
    goToSectionRef.current = fn;
  }, []);

  const goToHomeSection = useCallback((index: number) => {
    goToSectionRef.current?.(index);
  }, []);

  const isHomeActive = useCallback(() => goToSectionRef.current !== null, []);

  const goToGroup = useCallback((id: string) => {
    setSelectedGroupId(id);
    goToSectionRef.current?.(1);
  }, []);

  return (
    <HomeNavigationContext.Provider value={{ registerGoToSection, goToHomeSection, isHomeActive, selectedGroupId, setSelectedGroupId, goToGroup }}>
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
  stats: 4,
  'my-team': 5,
};
