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
  neustadtlScore: number;
  headToHead: Record<string, 'win' | 'loss' | 'draw'>;
  totalMMR: number;
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
        const [divisionsSnapshot, allTeamsSnapshot, scheduledMatchesSnapshot, completedMatchesSnapshot] = await Promise.all([
          getDocs(divisionsRef),
          getDocs(teamsRef),
          getDocs(query(matchesRef, where('status', '==', 'scheduled'))),
          getDocs(query(matchesRef, where('status', '==', 'completed'))),
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
            // wins/draws/losses/points are computed from match results below (not team.stats)
            // so MMR-limited tournaments (which don't populate team.stats) work correctly
            gamesPlayed: 0,
            matchesPlayed: 0,
            points: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            gamesWon: stats.gamesWon || 0,
            gamesLost: stats.gamesLost || 0,
            neustadtlScore: 0,
            headToHead: {},
            totalMMR: team.totalMMR || (Array.isArray(team.players) ? (team.players as Array<{mmr?: number}>).reduce((s: number, p) => s + (p.mmr || 0), 0) : 0),
          };

          if (!teamsByDivision.has(divisionId)) {
            teamsByDivision.set(divisionId, []);
          }
          teamsByDivision.get(divisionId)!.push(teamStanding);
        });

        // Group completed matches by divisionId (or group_id for MMR-limited tournaments)
        // MMR-limited tournaments use group_id on match documents; PDL uses divisionId
        const completedMatchesByDivision = new Map<string, any[]>();
        completedMatchesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const divId = data.divisionId || data.group_id;
          if (!divId) return;
          if (!completedMatchesByDivision.has(divId)) completedMatchesByDivision.set(divId, []);
          completedMatchesByDivision.get(divId)!.push(data);
        });

        // Build divisions data with pre-fetched teams
        const divisionsData: Division[] = divisionsSnapshot.docs.map(divisionDoc => {
          const divisionData = divisionDoc.data();
          const divisionId = divisionDoc.id;
          const teams = teamsByDivision.get(divisionId) || [];
          const divisionMatches = completedMatchesByDivision.get(divisionId) || [];

          // FIRST PASS: compute wins/draws/losses/points from match results.
          // This works for both PDL (divisionId on matches) and MMR-limited (group_id on matches).
          for (const match of divisionMatches) {
            const aId: string = match.teamA?.id || match.teams?.[0];
            const bId: string = match.teamB?.id || match.teams?.[1];
            const aScore: number = match.teamA?.score ?? 0;
            const bScore: number = match.teamB?.score ?? 0;
            if (!aId || !bId) continue;

            const teamA = teams.find(t => t.teamId === aId);
            const teamB = teams.find(t => t.teamId === bId);
            if (!teamA || !teamB) continue;

            teamA.matchesPlayed++;
            teamB.matchesPlayed++;
            teamA.gamesPlayed++;
            teamB.gamesPlayed++;

            if (aScore > bScore) {
              teamA.wins++; teamA.points += 2;
              teamB.losses++;
            } else if (bScore > aScore) {
              teamB.wins++; teamB.points += 2;
              teamA.losses++;
            } else {
              teamA.draws++; teamA.points++;
              teamB.draws++; teamB.points++;
            }
          }

          // SECOND PASS: compute neustadtl and head-to-head using the final points from above
          const pointsMap = new Map(teams.map(t => [t.teamId, t.points]));
          // Track h2h win counts: teamId -> opponentId -> wins
          const h2hWins = new Map<string, Map<string, number>>();
          teams.forEach(t => h2hWins.set(t.teamId, new Map()));

          for (const match of divisionMatches) {
            const aId: string = match.teamA?.id || match.teams?.[0];
            const bId: string = match.teamB?.id || match.teams?.[1];
            const aScore: number = match.teamA?.score ?? 0;
            const bScore: number = match.teamB?.score ?? 0;
            if (!aId || !bId) continue;

            const teamA = teams.find(t => t.teamId === aId);
            const teamB = teams.find(t => t.teamId === bId);
            if (!teamA || !teamB) continue;

            const aPoints = pointsMap.get(aId) ?? 0;
            const bPoints = pointsMap.get(bId) ?? 0;

            if (aScore > bScore) {
              teamA.neustadtlScore += bPoints;
              h2hWins.get(aId)!.set(bId, (h2hWins.get(aId)!.get(bId) ?? 0) + 1);
            } else if (bScore > aScore) {
              teamB.neustadtlScore += aPoints;
              h2hWins.get(bId)!.set(aId, (h2hWins.get(bId)!.get(aId) ?? 0) + 1);
            } else {
              teamA.neustadtlScore += bPoints * 0.5;
              teamB.neustadtlScore += aPoints * 0.5;
            }
          }

          // Convert win counts to win/loss/draw headToHead entries
          teams.forEach(t => {
            const wins = h2hWins.get(t.teamId)!;
            teams.forEach(opp => {
              if (opp.teamId === t.teamId) return;
              const w = wins.get(opp.teamId) ?? 0;
              const l = h2hWins.get(opp.teamId)!.get(t.teamId) ?? 0;
              if (w > l) t.headToHead[opp.teamId] = 'win';
              else if (l > w) t.headToHead[opp.teamId] = 'loss';
              else if (w > 0 || l > 0) t.headToHead[opp.teamId] = 'draw';
            });
          });

          // Sort: points DESC → head-to-head → neustadtl DESC → lower totalMMR ASC
          teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            // Head-to-head among tied teams
            const tiedIds = teams.filter(s => s.points === a.points).map(s => s.teamId);
            if (tiedIds.length > 1) {
              const aWins = tiedIds.reduce((sum, id) => id !== a.teamId && a.headToHead[id] === 'win' ? sum + 1 : sum, 0);
              const bWins = tiedIds.reduce((sum, id) => id !== b.teamId && b.headToHead[id] === 'win' ? sum + 1 : sum, 0);
              if (aWins !== bWins) return bWins - aWins;
            }
            if (b.neustadtlScore !== a.neustadtlScore) return b.neustadtlScore - a.neustadtlScore;
            // Lower total MMR wins the tiebreak
            return a.totalMMR - b.totalMMR;
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

        // Process next match from already-fetched scheduled matches
        const now = new Date();
        const futureMatches = scheduledMatchesSnapshot.docs
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
