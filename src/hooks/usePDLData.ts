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
      console.log('[usePDLData] No tournament ID');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        console.log('[usePDLData] Fetching data for tournament:', tournament.id);
        setLoading(true);
        setError(null);

        // Fetch divisions with standings
        const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
        const divisionsSnapshot = await getDocs(divisionsRef);
        
        console.log('[usePDLData] Found divisions in DB:', divisionsSnapshot.docs.length);
        
        const divisionsData: Division[] = [];

        for (const divisionDoc of divisionsSnapshot.docs) {
          const divisionData = divisionDoc.data();
          const divisionId = divisionDoc.id;
          
          console.log('[usePDLData] Processing division:', divisionId, divisionData);

          // Get teams in this division
          const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
          const teamsQuery = query(
            teamsRef,
            where('divisionId', '==', divisionId)
          );
          const teamsSnapshot = await getDocs(teamsQuery);

          const teams: TeamStanding[] = teamsSnapshot.docs.map((teamDoc, index) => {
            const team = teamDoc.data();
            const stats = team.stats || {};
            return {
              position: index + 1,
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
          });

          // Sort teams by points (descending), then by games played
          teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.gamesPlayed - a.gamesPlayed;
          });

          // Update positions
          teams.forEach((team, index) => {
            team.position = index + 1;
          });

          divisionsData.push({
            id: divisionId,
            name: capitalize(divisionData.name || divisionId),
            color: divisionData.color || DIVISION_COLORS[divisionId.toLowerCase()] || '#808080',
            theme: divisionData.theme,
            medalUrl: divisionData.medalUrl,
            tier: divisionData.tier,
            matchday: divisionData.matchday,
            teams,
          });
        }

        // Sort divisions: Elite, Challenger, Adept
        const divisionOrder = ['elite', 'challenger', 'adept'];
        divisionsData.sort((a, b) => {
          const aIndex = divisionOrder.indexOf(a.name.toLowerCase());
          const bIndex = divisionOrder.indexOf(b.name.toLowerCase());
          return aIndex - bIndex;
        });

        console.log('[usePDLData] Final divisions data:', divisionsData);
        setDivisions(divisionsData);

        // Fetch next scheduled match
        // Note: Fetching all scheduled matches to avoid index requirements
        // Once index is built, this can be optimized with orderBy
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
        const nextMatchQuery = query(
          matchesRef,
          where('status', '==', 'scheduled')
        );
        
        const matchesSnapshot = await getDocs(nextMatchQuery);
        
        // Filter for future matches and sort client-side
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
        console.error('Error fetching PDL data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
