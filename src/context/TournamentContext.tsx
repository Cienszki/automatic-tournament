"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { TournamentConfig, TournamentSummary, TournamentTheme } from '@/types/tournament';

// Default theme (Letnia Batalia style)
const DEFAULT_THEME: TournamentTheme = {
  primaryColor: 'hsl(330, 100%, 50%)', // Pink
  secondaryColor: 'hsl(180, 100%, 50%)', // Cyan
  accentColor: 'hsl(280, 100%, 60%)', // Purple
  backgroundColor: 'hsl(240, 20%, 8%)', // Dark
  backgroundGradient: 'linear-gradient(135deg, hsl(240, 20%, 8%) 0%, hsl(280, 30%, 12%) 100%)',
  cardColor: 'hsl(240, 15%, 12%)',
  textColor: 'hsl(0, 0%, 95%)',
  mutedTextColor: 'hsl(240, 10%, 60%)',
  borderColor: 'hsl(240, 15%, 20%)',
  headerFont: 'var(--font-neon-bines)',
  bodyFont: 'var(--font-space-mono)',
  logoUrl: '/logo_transparent.webp',
};

// PDL Theme (Professional Esports)
export const PDL_THEME: TournamentTheme = {
  primaryColor: 'hsl(215, 50%, 25%)', // Deep navy blue
  secondaryColor: 'hsl(45, 80%, 45%)', // Gold
  accentColor: 'hsl(215, 60%, 40%)', // Lighter blue
  backgroundColor: 'hsl(220, 25%, 8%)', // Dark blue-ish
  backgroundGradient: 'linear-gradient(135deg, hsl(220, 25%, 8%) 0%, hsl(220, 30%, 12%) 100%)',
  cardColor: 'hsl(220, 20%, 12%)',
  textColor: 'hsl(0, 0%, 95%)',
  mutedTextColor: 'hsl(220, 10%, 55%)',
  borderColor: 'hsl(220, 20%, 20%)',
  headerFont: 'var(--font-geist-sans)', // Will be Logik when available
  bodyFont: 'var(--font-geist-sans)',
  logoUrl: '/pdl-logo.png',
};

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
  const [tournament, setTournament] = useState<TournamentConfig | null>(null);
  const [tournamentSlug, setTournamentSlug] = useState<string | null>(initialTournamentSlug || null);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive theme from tournament config or use default
  const theme = tournament?.theme || DEFAULT_THEME;

  // Filter tournaments by visibility
  const activeTournaments = tournaments.filter(
    t => t.visibility === 'active' && (t.status === 'active' || t.status === 'registration')
  );
  
  const archivedTournaments = tournaments.filter(
    t => t.visibility === 'archived' || t.status === 'completed'
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
    try {
      setIsLoading(true);
      setError(null);

      // For now, return static tournament data
      // TODO: Replace with Firestore fetch
      const staticTournaments: TournamentSummary[] = [
        {
          id: 'letnia-2025',
          slug: 'letnia',
          name: 'Letnia Batalia',
          shortName: 'Letnia',
          type: 'mmr-limited',
          status: 'completed',
          visibility: 'archived',
          logoUrl: '/logo_transparent.webp',
          primaryColor: 'hsl(330, 100%, 50%)',
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
          logoUrl: '/pdl-logo.png',
          primaryColor: 'hsl(215, 50%, 25%)',
          startDate: '2026-02-21',
          teamsCount: 0,
          organizerId: 'pd2ih',
        },
      ];

      setTournaments(staticTournaments);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournaments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch current tournament config when slug changes
  useEffect(() => {
    if (!tournamentSlug) {
      setTournament(null);
      return;
    }

    const fetchTournamentConfig = async () => {
      try {
        setIsLoading(true);
        
        // TODO: Replace with Firestore fetch
        // For now, use static config based on slug
        if (tournamentSlug === 'letnia') {
          // Letnia uses legacy structure, minimal config needed
          setTournament({
            id: 'letnia-2025',
            slug: 'letnia',
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
        } else if (tournamentSlug === 'pdl') {
          setTournament({
            id: 'pdl-s1',
            slug: 'pdl',
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
            roundsPerSeason: 2, // Full round-robin twice
            divisions: [
              { id: 'elite', name: 'Elite', tier: 1, matchday: 'Czwartek 20:00', color: 'hsl(45, 80%, 45%)' },
              { id: 'challenger', name: 'Challenger', tier: 2, matchday: 'Środa 20:00', color: 'hsl(215, 60%, 50%)' },
              { id: 'adept', name: 'Adept', tier: 3, matchday: 'Środa 20:00', color: 'hsl(215, 40%, 40%)' },
            ],
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
        }
      } catch (err) {
        console.error('Error fetching tournament config:', err);
        setError('Failed to load tournament');
        setTournament(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournamentConfig();
  }, [tournamentSlug]);

  // Initial load of tournaments list
  useEffect(() => {
    refreshTournaments();
  }, [refreshTournaments]);

  // Apply theme CSS variables when theme changes
  useEffect(() => {
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
