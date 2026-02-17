// src/hooks/usePDLData.ts
// Hook to fetch real PDL data from Firestore

'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { format } from 'date-fns';

interface TeamStanding {
  position: number;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  matchesPlayed: number; // Alias for gamesPlayed for compatibility
  points: number;
  wins: number;
  draws: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
}

interface Division {
  id: string;
  name: string;
  color: string;
  teams: TeamStanding[];
  theme?: string;
  medalUrl?: string;
  tier?: number;
  matchday?: string;
}

interface NextMatch {
  id: string;
  teamA: string;
  teamB: string;
  scheduledFor: string;
  dateLabel: string;
}

interface UsePDLDataResult {
  divisions: Division[];
  nextMatch: NextMatch | null;
  loading: boolean;
  error: string | null;
}

const DIVISION_COLORS: Record<string, string> = {
  'elite': '#FFD700',
  'challenger': '#C0C0C0',
  'adept': '#CD7F32',
};

export function usePDLData(): UsePDLDataResult {
  const { tournament } = useTournament();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');

        // OPTIMIZATION: Fetch divisions, all teams, and matches in parallel
        const [divisionsSnapshot, allTeamsSnapshot, matchesSnapshot] = await Promise.all([
          getDocs(divisionsRef),
          getDocs(teamsRef),
          getDocs(query(matchesRef, where('status', '==', 'scheduled')))
        ]);

        if (!isMounted) return;

        // Create a map of teams by divisionId for O(1) lookup
        const teamsByDivision = new Map<string, TeamStanding[]>();
        allTeamsSnapshot.docs.forEach(teamDoc => {
          const team = teamDoc.data();
          const divisionId = team.divisionId;
          if (!divisionId) return;

          const stats = team.stats || {};
          const teamStanding: TeamStanding = {
            position: 0,
            teamId: teamDoc.id,
            teamName: team.name || teamDoc.id,
            gamesPlayed: stats.played || 0,
            matchesPlayed: stats.played || 0,
            points: calculatePoints(stats),
            wins: stats.wins || 0,
            draws: stats.draws || 0,
            losses: stats.losses || 0,
            gamesWon: stats.gamesWon || 0,
            gamesLost: stats.gamesLost || 0,
          };

          if (!teamsByDivision.has(divisionId)) {
            teamsByDivision.set(divisionId, []);
          }
          teamsByDivision.get(divisionId)!.push(teamStanding);
        });

        // Build divisions data with pre-fetched teams
        const divisionsData: Division[] = divisionsSnapshot.docs.map(divisionDoc => {
          const divisionData = divisionDoc.data();
          const divisionId = divisionDoc.id;
          const teams = teamsByDivision.get(divisionId) || [];

          // Sort teams by points (descending), then by games played
          teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.gamesPlayed - a.gamesPlayed;
          });

          // Update positions
          teams.forEach((team, index) => {
            team.position = index + 1;
          });

          return {
            id: divisionId,
            name: capitalize(divisionData.name || divisionId),
            color: divisionData.color || DIVISION_COLORS[divisionId.toLowerCase()] || '#808080',
            theme: divisionData.theme,
            medalUrl: divisionData.medalUrl,
            tier: divisionData.tier,
            matchday: divisionData.matchday,
            teams,
          };
        });

        // Sort divisions: Elite, Challenger, Adept
        const divisionOrder = ['elite', 'challenger', 'adept'];
        divisionsData.sort((a, b) => {
          const aIndex = divisionOrder.indexOf(a.name.toLowerCase());
          const bIndex = divisionOrder.indexOf(b.name.toLowerCase());
          return aIndex - bIndex;
        });

        setDivisions(divisionsData);

        // Process next match from already-fetched matches
        const now = new Date();
        const futureMatches = matchesSnapshot.docs
          .map(doc => ({
            id: doc.id,
            data: doc.data(),
            scheduledDate: new Date(doc.data().scheduledFor)
          }))
          .filter(match => match.scheduledDate >= now)
          .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
        
        if (futureMatches.length > 0) {
          const nextMatchData = futureMatches[0];
          const matchData = nextMatchData.data;
          
          setNextMatch({
            id: nextMatchData.id,
            teamA: matchData.teamA?.name || matchData.teamA?.id || 'Team A',
            teamB: matchData.teamB?.name || matchData.teamB?.id || 'Team B',
            scheduledFor: matchData.scheduledFor,
            dateLabel: formatMatchDate(matchData.scheduledFor),
          });
        } else {
          setNextMatch(null);
        }

      } catch (err: any) {
        if (isMounted) {
          console.error('Error fetching PDL data:', err);
          setError(err.message || 'Failed to load data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [tournament?.id]);

  return { divisions, nextMatch, loading, error };
}

// Helper to calculate points based on stats
function calculatePoints(stats: any): number {
  if (!stats) return 0;
  
  // PDL scoring: Win 2-0 = 2 points, Draw 1-1 = 1 point, Loss 0-2 = 0 points
  // For now, simple calculation: wins * 2 + draws * 1
  const wins = stats.wins || 0;
  const draws = stats.draws || 0;
  
  return wins * 2 + draws * 1;
}

// Helper to capitalize first letter
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper to format match date
function formatMatchDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'dd.MM.yyyy • HH:mm');
  } catch {
    return dateString;
  }
}
