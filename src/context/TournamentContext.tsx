"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode, useCallback } from 'react';
import { TournamentConfig, TournamentSummary, TournamentTheme } from '@/types/tournament';
import { PDL_THEME, LETNIA_THEME, getThemeCssVariables, getThemeBySlug } from '@/lib/themes';
import { fetchTournaments, fetchTournamentBySlug } from '@/lib/api/tournaments';

// Re-export themes for convenience
export { PDL_THEME, LETNIA_THEME };

// Default theme (Letnia Batalia style)
const DEFAULT_THEME: TournamentTheme = LETNIA_THEME;

// --- Theme cache helpers (sessionStorage) ---
// Pre-applying the cached theme during loading prevents the LoadingScreen
// from briefly showing the wrong (default) theme colors on refresh.
function getCachedTheme(slug: string): TournamentTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`theme-cache-${slug}`);
    if (raw) return JSON.parse(raw) as TournamentTheme;
  } catch { /* ignore parse errors */ }
  return null;
}

function setCachedTheme(slug: string, theme: TournamentTheme): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`theme-cache-${slug}`, JSON.stringify(theme));
  } catch { /* ignore quota errors */ }
}

interface TournamentContextType {
  // Current tournament
  tournament: TournamentConfig | null;
  tournamentSlug: string | null;
  theme: TournamentTheme;
  isLoading: boolean;
  error: string | null;

  // Available tournaments
  tournaments: TournamentSummary[];
  activeTournaments: TournamentSummary[];
  archivedTournaments: TournamentSummary[];

  // Actions
  setTournament: (tournament: TournamentConfig | null) => void;
  setTournamentSlug: (slug: string | null) => void;
  refreshTournaments: () => Promise<void>;
  refetchTournament: () => Promise<void>; // Refetch current tournament from Firestore

  // Helpers
  isLegacyTournament: boolean; // True for Letnia (uses old data structure)
  getTournamentPath: (path: string) => string; // Returns full path with tournament slug
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

interface TournamentProviderProps {
  children: ReactNode;
  initialTournamentSlug?: string;
}

export function TournamentProvider({ children, initialTournamentSlug }: TournamentProviderProps) {
  // Initialize with static tournaments to avoid SSR issues
  const [tournament, setTournament] = useState<TournamentConfig | null>(null);
  const [tournamentSlug, setTournamentSlug] = useState<string | null>(initialTournamentSlug || null);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([
    {
      id: 'letnia-2025',
      slug: 'letnia',
      name: 'Letnia Batalia',
      shortName: 'Letnia',
      type: 'mmr-limited',
      status: 'completed',
      visibility: 'active',
      logoUrl: '/logos/letnia/letnia-logo-transparent.png',
      primaryColor: 'hsl(330, 100%, 54%)',
      startDate: '2025-06-01',
      endDate: '2025-09-30',
      teamsCount: 16,
      organizerId: 'pd2ih',
    },
    {
      id: 'pdl-s1',
      slug: 'pdl',
      name: 'Polish Dota League',
      shortName: 'PDL',
      type: 'league',
      status: 'registration',
      visibility: 'active',
      logoUrl: '/logos/pdl/pdl-s1-logo-transparent.png',
      primaryColor: 'hsl(345, 75%, 31%)',
      startDate: '2026-02-21',
      teamsCount: 0,
      organizerId: 'pd2ih',
    },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  // Separate flag for the tournament-list fetch so it never races against
  // the per-tournament config fetch (which controls the LoadingScreen).
  const [isListLoading, setIsListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Holds the cached theme for the current slug so the LoadingScreen shows
  // the correct tournament colors while the Firestore fetch is in progress.
  // Lazy initializer reads from sessionStorage synchronously so the first
  // useLayoutEffect fires with the correct theme — preventing the dark flash
  // that would otherwise occur when DEFAULT_THEME briefly overwrites the
  // inline script's CSS variables during React hydration.
  const [pendingTheme, setPendingTheme] = useState<TournamentTheme | null>(() => {
    if (typeof window === 'undefined') return null;
    const slug = window.location.pathname.split('/')[1];
    if (!slug) return null;
    return getCachedTheme(slug);
  });

  // Derive theme from tournament config, pending cached theme, or use default
  const theme = tournament?.theme || pendingTheme || DEFAULT_THEME;

  // Filter tournaments by visibility
  // 'active' visibility means it shows on the main landing page (regardless of status)
  const activeTournaments = tournaments.filter(
    t => t.visibility === 'active'
  );

  // 'archived' visibility means it goes to the dropdown
  const archivedTournaments = tournaments.filter(
    t => t.visibility === 'archived'
  );

  // Check if this is the legacy Letnia tournament (uses old data structure)
  const isLegacyTournament = tournamentSlug === 'letnia';

  // Helper to build tournament-aware paths
  const getTournamentPath = useCallback((path: string): string => {
    if (!tournamentSlug) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `/${tournamentSlug}${cleanPath}`;
  }, [tournamentSlug]);

  // Fetch all tournaments
  const refreshTournaments = useCallback(async () => {
    // Only fetch on client side
    if (typeof window === 'undefined') {
      return;
    }

    try {
      setIsListLoading(true);

      // Fetch live tournament list from Firestore so status/visibility changes
      // made in the admin panel are reflected immediately without a code deploy.
      // Falls back to the static initial state if Firestore returns nothing.
      const fetched = await fetchTournaments();
      if (fetched.length > 0) {
        setTournaments(fetched);
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    } finally {
      setIsListLoading(false);
    }
  }, []);

  // Function to fetch tournament config
  const fetchTournamentConfig = useCallback(async (slug: string) => {
    // Pre-apply cached theme so the LoadingScreen shows correct colors
    // while the async Firestore fetch is in progress.
    const cached = getCachedTheme(slug);
    if (cached) {
      setPendingTheme(cached);
    }

    try {
      setIsLoading(true);

      // Fetch from Firestore
      const tournamentData = await fetchTournamentBySlug(slug);
        
      if (tournamentData) {
        // Use Firestore data
        setTournament(tournamentData);
        // Persist the fresh theme so future page loads / refreshes get it immediately
        if (tournamentData.theme) {
          setCachedTheme(slug, tournamentData.theme);
        }
        setPendingTheme(null);
      } else {
        // Fallback to static config for legacy tournaments
        console.warn(`Tournament "${slug}" not found in Firestore, using static config`);
        
        if (slug === 'letnia' || slug === 'letnia-2025') {
            // Letnia uses legacy structure, minimal config needed
            setTournament({
              id: 'letnia-2025',
              slug: 'letnia', // Normalize slug
              name: 'Letnia Batalia',
            shortName: 'Letnia',
            description: 'Turniej z limitem MMR dla polskiej społeczności Dota 2',
            organizerId: 'pd2ih',
            type: 'mmr-limited',
            status: 'completed',
            visibility: 'archived',
            startDate: '2025-06-01',
            endDate: '2025-09-30',
            leagueId: 18559,
            teamSize: 5,
            mmrCap: 24000,
            mmrVerificationRequired: true,
            coachMode: 'disabled',
            defaultMatchFormat: 'bo2',
            schedulingMethod: 'captain-scheduled',
            groupsCount: 4,
            teamsPerGroup: 4,
            fantasy: {
              enabled: true,
              type: 'round-based',
              rosterSize: 5,
              budget: 24000,
              lockBeforeMatchday: true,
              scoring: {
                killPoints: 2.5,
                deathPoints: -2.5,
                assistPoints: 1,
                lastHitPoints: 0.003,
                gpmPoints: 0.002,
                xpmPoints: 0.002,
                towerKillPoints: 1,
                roshanKillPoints: 3,
                obsPlacedPoints: 0.5,
                senPlacedPoints: 0.25,
                teamWinPoints: 10,
              },
            },
            pickem: {
              enabled: true,
              matchPredictions: true,
              standingsPredictions: true,
              playoffBracket: true,
              mvpPredictions: false,
              lockTime: 'before-round',
            },
            standins: {
              enabled: true,
              requireRegistration: true,
              requireOpponentApproval: false,
              adminCanOverride: true,
              maxPerMatch: 2,
              mmrRestrictions: true,
            },
            playoffs: {
              enabled: true,
              format: 'double-elimination',
              teamsCount: 8,
              wildcardSpots: 2,
              thirdPlaceMatch: false,
              thirdPlaceFormat: 'bo3',
              semifinalFormat: 'bo3',
              finalFormat: 'bo3',
              grandFinalFormat: 'bo5',
            },
            theme: DEFAULT_THEME,
            createdAt: '2025-05-01T00:00:00Z',
            updatedAt: '2025-09-30T00:00:00Z',
          });
        } else if (slug === 'pdl' || slug === 'pdl-s1') {
          setTournament({
              id: 'pdl-s1',
              slug: 'pdl', // Normalize slug
              name: 'Polish Dota League',
            shortName: 'PDL',
            description: 'Profesjonalna liga dla najlepszych polskich drużyn Dota 2',
            organizerId: 'pd2ih',
            type: 'league',
            status: 'registration',
            visibility: 'active',
            startDate: '2026-02-21',
            leagueId: 19206,
            teamSize: 5,
            mmrVerificationRequired: false,
            coachMode: 'per-game',
            defaultMatchFormat: 'bo2',
            schedulingMethod: 'admin-scheduled',
            promotionRelegationEnabled: true,
            roundsPerSeason: 1, // Single round-robin: each team plays every other team once
            divisions: [],
            fantasy: {
              enabled: true,
              type: 'season-long',
              rosterSize: 5,
              budget: 100,
              maxTransfersPerRound: 2,
              lockBeforeMatchday: true,
              priceChangePercentage: 4,
              scoring: {
                killPoints: 0.3,
                deathPoints: 0,
                assistPoints: 0.15,
                lastHitPoints: 0.003,
                gpmPoints: 0.002,
                xpmPoints: 0.002,
                towerKillPoints: 0.75,
                roshanKillPoints: 0.5,
                obsPlacedPoints: 0.05,
                senPlacedPoints: 0.05,
                teamWinPoints: 4,
              },
            },
            pickem: {
              enabled: true,
              matchPredictions: false,
              standingsPredictions: true,
              playoffBracket: true,
              mvpPredictions: false,
              lockTime: 'before-season',
            },
            standins: {
              enabled: true,
              requireRegistration: false,
              requireOpponentApproval: true,
              adminCanOverride: true,
              maxPerMatch: 1,
              maxPerRound: 1,
              mmrRestrictions: false,
            },
            playoffs: {
              enabled: true,
              format: 'single-elimination',
              teamsCount: 4,
              wildcardSpots: 0,
              thirdPlaceMatch: false,
              thirdPlaceFormat: 'bo3',
              semifinalFormat: 'bo3',
              finalFormat: 'bo3',
              grandFinalFormat: 'bo5',
            },
            theme: PDL_THEME,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-12T00:00:00Z',
          });
        } else {
          setError('Tournament not found');
          setTournament(null);
          setPendingTheme(null);
        }
      }
    } catch (err) {
      console.error('Error fetching tournament config:', err);
      setError('Failed to load tournament');
      setTournament(null);
      setPendingTheme(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refetch current tournament (for use after admin updates)
  const refetchTournament = useCallback(async () => {
    if (!tournamentSlug) return;
    await fetchTournamentConfig(tournamentSlug);
  }, [tournamentSlug, fetchTournamentConfig]);

  // Fetch current tournament config when slug changes
  useEffect(() => {
    if (!tournamentSlug) {
      setTournament(null);
      return;
    }

    fetchTournamentConfig(tournamentSlug);
  }, [tournamentSlug, fetchTournamentConfig]);

  // Initial load of tournaments list
  useEffect(() => {
    refreshTournaments();
  }, [refreshTournaments]);

  // Apply theme CSS variables when theme changes.
  // useLayoutEffect runs synchronously after DOM mutations but BEFORE the browser
  // paints, so CSS variables are always up-to-date by the time the user sees any
  // pixels — eliminating the brief "wrong-colour" flash on first load / refresh.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--tournament-primary', theme.primaryColor);
    root.style.setProperty('--tournament-secondary', theme.secondaryColor);
    root.style.setProperty('--tournament-accent', theme.accentColor);
    root.style.setProperty('--tournament-background', theme.backgroundColor);
    root.style.setProperty('--tournament-card', theme.cardColor);
    root.style.setProperty('--tournament-text', theme.textColor);
    root.style.setProperty('--tournament-muted', theme.mutedTextColor);
    root.style.setProperty('--tournament-border', theme.borderColor);

    // Text hierarchy colors — admin-configurable, fall back to base theme values
    root.style.setProperty('--tournament-heading', theme.headingColor || theme.textColor || '#ffffff');
    root.style.setProperty('--tournament-title', theme.titleColor || theme.textColor || '#ffffff');
    root.style.setProperty('--tournament-section-header', theme.sectionHeaderColor || theme.textColor || '#ffffff');
    root.style.setProperty('--tournament-primary-text', theme.primaryTextColor || theme.textColor || '#ffffff');
    root.style.setProperty('--tournament-secondary-text', theme.secondaryTextColor || theme.mutedTextColor || 'rgba(255,255,255,0.6)');
    root.style.setProperty('--tournament-glow', theme.glowColor || theme.primaryColor);

    if (theme.backgroundGradient) {
      root.style.setProperty('--tournament-bg-gradient', theme.backgroundGradient);
    }
  }, [theme]);

  return (
    <TournamentContext.Provider
      value={{
        tournament,
        tournamentSlug,
        theme,
        isLoading,
        error,
        tournaments,
        activeTournaments,
        archivedTournaments,
        setTournament,
        setTournamentSlug,
        refreshTournaments,
        refetchTournament,
        isLegacyTournament,
        getTournamentPath,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}

// Helper hook to get current theme
export function useTournamentTheme() {
  const { theme } = useTournament();
  return theme;
}

// Helper hook to check tournament type
export function useTournamentType() {
  const { tournament } = useTournament();
  return {
    isLeague: tournament?.type === 'league',
    isMmrLimited: tournament?.type === 'mmr-limited',
    type: tournament?.type,
  };
}
