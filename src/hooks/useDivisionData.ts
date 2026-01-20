// src/hooks/useDivisionData.ts
// Hook to fetch data for a specific division

'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import type { Match } from '@/lib/definitions';

interface TeamStanding {
  position: number;
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  neustadtlScore: number;
  points: number;
  form?: ('W' | 'D' | 'L')[];
}

interface DivisionInfo {
  id: string;
  name: string;
  tier: number;
  color: string;
  matchday?: string;
  currentRound?: number;
}

interface UseDivisionDataResult {
  standings: TeamStanding[];
  matches: Match[];
  divisionInfo: DivisionInfo | null;
  loading: boolean;
  error: string | null;
}

// Helper to calculate points: 2 for win (2-0), 1 for draw (1-1), 0 for loss (0-2)
function calculatePoints(stats: any): number {
  const wins = stats.wins || 0;
  const draws = stats.draws || 0;
  return wins * 2 + draws * 1;
}

// Helper to calculate Neustadtl (Sonnenborn-Berger) score
// This is calculated based on the points of opponents beaten/drawn
// For now, return a mock value - should be calculated properly based on match history
function calculateNeustadtl(teamId: string, matches: Match[], allTeams: any[]): number {
  let score = 0;
  
  matches.forEach(match => {
    if (match.status !== 'completed') return;
    
    let isHome = match.teamA.id === teamId;
    let isAway = match.teamB.id === teamId;
    
    if (!isHome && !isAway) return;
    
    let opponentId = isHome ? match.teamB.id : match.teamA.id;
    let opponentTeam = allTeams.find(t => t.id === opponentId);
    
    if (!opponentTeam) return;
    
    let opponentPoints = calculatePoints(opponentTeam.stats || {});
    let teamScore = isHome ? match.teamA.score : match.teamB.score;
    let opponentScore = isHome ? match.teamB.score : match.teamA.score;
    
    // In BO2, add opponent's points weighted by match result
    if (teamScore > opponentScore) {
      // Win: full opponent points
      score += opponentPoints;
    } else if (teamScore === opponentScore) {
      // Draw: half opponent points
      score += opponentPoints * 0.5;
    }
    // Loss: 0 points added
  });
  
  return score;
}

// Helper to extract form (last 5 matches)
function calculateForm(teamId: string, matches: Match[]): ('W' | 'D' | 'L')[] {
  const teamMatches = matches
    .filter(m => 
      m.status === 'completed' && 
      (m.teamA.id === teamId || m.teamB.id === teamId)
    )
    .sort((a, b) => {
      const dateA = new Date(a.completed_at || a.scheduled_for || 0).getTime();
      const dateB = new Date(b.completed_at || b.scheduled_for || 0).getTime();
      return dateA - dateB;
    })
    .slice(-5);

  return teamMatches.map(match => {
    const isTeamA = match.teamA.id === teamId;
    const teamScore = isTeamA ? match.teamA.score : match.teamB.score;
    const opponentScore = isTeamA ? match.teamB.score : match.teamA.score;
    
    if (teamScore > opponentScore) return 'W';
    if (teamScore < opponentScore) return 'L';
    return 'D';
  });
}

const DIVISION_COLORS: Record<string, string> = {
  'elite': '#FFD700',
  'challenger': '#C0C0C0',
  'adept': '#CD7F32',
};

export function useDivisionData(divisionId: string): UseDivisionDataResult {
  const { tournament } = useTournament();
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [divisionInfo, setDivisionInfo] = useState<DivisionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament?.id || !divisionId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Find division config
        const divConfig = tournament.divisions?.find(d => d.id === divisionId);
        
        if (!divConfig) {
          setError('Dywizja nie istnieje');
          setLoading(false);
          return;
        }

        // Get teams in this division
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const teamsQuery = query(
          teamsRef,
          where('divisionId', '==', divisionId)
        );
        const teamsSnapshot = await getDocs(teamsQuery);
        const teamsData = teamsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Get all matches for this division
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
        const matchesQuery = query(
          matchesRef,
          where('divisionId', '==', divisionId)
        );
        const matchesSnapshot = await getDocs(matchesQuery);
        const matchesData: Match[] = matchesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            teamA: data.teamA || { id: '', name: '', score: 0, logoUrl: '' },
            teamB: data.teamB || { id: '', name: '', score: 0, logoUrl: '' },
            teams: data.teams || [],
            status: data.status || 'scheduled',
            scheduled_for: data.scheduled_for || '',
            defaultMatchTime: data.defaultMatchTime || '',
            schedulingStatus: data.schedulingStatus || 'unscheduled',
            series_format: data.series_format || 'bo2',
            winnerId: data.winnerId || null,
            completed_at: data.completed_at,
            game_ids: data.game_ids || [],
          } as Match;
        });

        // Calculate standings
        const standingsData: TeamStanding[] = teamsData.map((team, index) => {
          const stats = team.stats || {};
          const form = calculateForm(team.id, matchesData);
          const neustadtl = calculateNeustadtl(team.id, matchesData, teamsData);
          
          return {
            position: index + 1,
            teamId: team.id,
            teamName: team.name || team.id,
            teamLogoUrl: team.logoUrl,
            matchesPlayed: stats.played || 0,
            wins: stats.wins || 0,
            draws: stats.draws || 0,
            losses: stats.losses || 0,
            gamesWon: stats.gamesWon || 0,
            gamesLost: stats.gamesLost || 0,
            neustadtlScore: neustadtl,
            points: calculatePoints(stats),
            form: form,
          };
        });

        // Sort standings by points (desc), then by neustadtl (desc), then by games won-lost diff
        standingsData.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.neustadtlScore !== a.neustadtlScore) return b.neustadtlScore - a.neustadtlScore;
          const aDiff = a.gamesWon - a.gamesLost;
          const bDiff = b.gamesWon - b.gamesLost;
          return bDiff - aDiff;
        });

        // Update positions
        standingsData.forEach((team, index) => {
          team.position = index + 1;
        });

        // Calculate current round (highest round number in completed or scheduled matches)
        const currentRound = matchesData.reduce((max, match) => {
          const round = (match as any).round || 1;
          return Math.max(max, round);
        }, 1);

        setStandings(standingsData);
        setMatches(matchesData);
        setDivisionInfo({
          id: divisionId,
          name: divConfig.name,
          tier: divConfig.tier,
          color: divConfig.color || DIVISION_COLORS[divisionId.toLowerCase()] || '#808080',
          matchday: divConfig.matchday,
          currentRound,
        });

      } catch (err: any) {
        console.error('Error fetching division data:', err);
        setError(err.message || 'Błąd podczas ładowania danych');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tournament, divisionId]);

  return { standings, matches, divisionInfo, loading, error };
}
