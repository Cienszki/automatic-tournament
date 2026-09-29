// src/hooks/useDivisionData.ts
// Hook to fetch data for a specific division

'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import type { Match, GroupHighlight } from '@/lib/definitions';
import {
  computeSwissStandings,
  compareForTable,
  isSwissByeTeam,
  type SwissMatchResult,
} from '@/lib/swiss/pairing';

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
  totalMMR: number;
  form?: ('W' | 'D' | 'L')[];
  headToHead: Record<string, 'win' | 'loss' | 'draw'>;
  /** Swiss only — schedule strength. Absent for league/MMR tournaments. */
  buchholz?: number;
  /** Swiss only — walkovers received from the virtual BYE opponent. */
  byeCount?: number;
  /** Swiss only — marks the BYE sentinel row so the UI can grey it out. */
  isBye?: boolean;
}

interface DivisionInfo {
  id: string;
  name: string;
  tier: number;
  color: string;
  matchday?: string;
  currentRound?: number;
  totalRounds?: number;
  theme?: string;
  medalUrl?: string;
  highlights?: GroupHighlight[];
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
      const dateA = new Date(a.completed_at || a.scheduledFor || 0).getTime();
      const dateB = new Date(b.completed_at || b.scheduledFor || 0).getTime();
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

        // Fetch division from database
        const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
        const divisionsSnapshot = await getDocs(divisionsRef);
        const divisionDoc = divisionsSnapshot.docs.find(doc => doc.id === divisionId);
        
        if (!divisionDoc) {
          setError('Dywizja nie istnieje');
          setLoading(false);
          return;
        }

        const divisionData = divisionDoc.data();

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
        })) as any[];

        // Get all matches for this division.
        // PDL matches have `divisionId`; MMR-limited matches have `group_id`.
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
        const [matchesByDivisionId, matchesByGroupId] = await Promise.all([
          getDocs(query(matchesRef, where('divisionId', '==', divisionId))),
          getDocs(query(matchesRef, where('group_id', '==', divisionId))),
        ]);
        // Use whichever returned results; prefer divisionId if both somehow have results
        const matchesSnapshot = matchesByDivisionId.docs.length > 0 ? matchesByDivisionId : matchesByGroupId;
        const matchesData: Match[] = matchesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            teamA: data.teamA || { id: '', name: '', score: 0, logoUrl: '' },
            teamB: data.teamB || { id: '', name: '', score: 0, logoUrl: '' },
            teams: data.teams || [],
            status: data.status || 'scheduled',
            scheduledFor: data.scheduledFor || data.scheduled_for || '',
            schedulingStatus: data.schedulingStatus || 'unscheduled',
            series_format: data.series_format || 'bo2',
            winnerId: data.winnerId || null,
            completed_at: data.completed_at,
            game_ids: data.game_ids || [],
            approvedStandins: data.approvedStandins,
            isBanForfeit: data.isBanForfeit || false,
          } as Match;
        });

        // Matches involving a banned team are kept for standings calculation
        // (opponents still get their walkover wins) but excluded from the schedule view.
        // Swiss bye walkovers are hidden for the same reason: they count toward
        // points but there is no game for anyone to watch or reschedule.
        const visibleMatches = matchesData.filter(
          m => !m.isBanForfeit && !(m as { isSwissByeMatch?: boolean }).isSwissByeMatch
        );

        // Calculate standings: initialise all teams, then accumulate from match results.
        // We deliberately do NOT use team.stats because that field is only populated for PDL
        // (via server-side updatePDLDivisionStandingsAdmin). MMR-limited tournaments never
        // write team.stats, so we always compute from actual completed matches.
        const standingsData: TeamStanding[] = teamsData.map((team) => ({
          position: 1,
          teamId: team.id,
          teamName: team.name || team.id,
          teamLogoUrl: team.logoUrl,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gamesWon: team.stats?.gamesWon || 0,
          gamesLost: team.stats?.gamesLost || 0,
          neustadtlScore: 0,
          points: 0,
          totalMMR: team.totalMMR || (Array.isArray(team.players) ? (team.players as Array<{mmr?: number}>).reduce((s: number, p) => s + (p.mmr || 0), 0) : 0),
          form: calculateForm(team.id, matchesData),
          headToHead: {},
        }));

        const standingsMap = new Map(standingsData.map(t => [t.teamId, t]));

        // FIRST PASS: accumulate wins/draws/losses/points from completed match results
        matchesData.forEach(match => {
          if (match.status !== 'completed') return;
          const aId = match.teamA.id;
          const bId = match.teamB.id;
          const aScore = match.teamA.score ?? 0;
          const bScore = match.teamB.score ?? 0;
          if (!aId || !bId) return;
          const sA = standingsMap.get(aId);
          const sB = standingsMap.get(bId);
          if (!sA || !sB) return;
          sA.matchesPlayed++;
          sB.matchesPlayed++;
          if (aScore > bScore) {
            sA.wins++; sA.points += 2; sB.losses++;
          } else if (bScore > aScore) {
            sB.wins++; sB.points += 2; sA.losses++;
          } else {
            sA.draws++; sA.points++;
            sB.draws++; sB.points++;
          }
        });

        // SECOND PASS: compute neustadtl and head-to-head using the final points above
        const pointsMap = new Map(standingsData.map(t => [t.teamId, t.points]));
        const h2hWins = new Map<string, Map<string, number>>();
        standingsData.forEach(t => h2hWins.set(t.teamId, new Map()));

        matchesData.forEach(match => {
          if (match.status !== 'completed') return;
          const aId = match.teamA.id;
          const bId = match.teamB.id;
          const aScore = match.teamA.score ?? 0;
          const bScore = match.teamB.score ?? 0;
          if (!aId || !bId) return;
          if (!h2hWins.has(aId) || !h2hWins.has(bId)) return;
          const aPoints = pointsMap.get(aId) ?? 0;
          const bPoints = pointsMap.get(bId) ?? 0;
          const sA = standingsMap.get(aId);
          const sB = standingsMap.get(bId);
          if (!sA || !sB) return;
          if (aScore > bScore) {
            sA.neustadtlScore += bPoints;
            h2hWins.get(aId)!.set(bId, (h2hWins.get(aId)!.get(bId) ?? 0) + 1);
          } else if (bScore > aScore) {
            sB.neustadtlScore += aPoints;
            h2hWins.get(bId)!.set(aId, (h2hWins.get(bId)!.get(aId) ?? 0) + 1);
          } else {
            sA.neustadtlScore += bPoints * 0.5;
            sB.neustadtlScore += aPoints * 0.5;
          }
        });

        standingsData.forEach(t => {
          standingsData.forEach(opp => {
            if (opp.teamId === t.teamId) return;
            const w = h2hWins.get(t.teamId)!.get(opp.teamId) ?? 0;
            const l = h2hWins.get(opp.teamId)!.get(t.teamId) ?? 0;
            if (w > l) t.headToHead[opp.teamId] = 'win';
            else if (l > w) t.headToHead[opp.teamId] = 'loss';
            else if (w > 0 || l > 0) t.headToHead[opp.teamId] = 'draw';
          });
        });

        // ── Swiss override ────────────────────────────────────────────────
        // Swiss scores GAMES won, not 2-per-series, and breaks ties on Buchholz
        // rather than "lower total MMR" (which is meaningless when MMR is a
        // self-reported seeding figure). Recompute those fields from the Swiss
        // engine and use its ordering. Everything above — team names, logos,
        // form, match fetching — is shared; only the numbers differ.
        if (tournament?.type === 'swiss') {
          const swissResults: SwissMatchResult[] = matchesData.map(m => ({
            teamAId: m.teamA.id,
            teamBId: m.teamB.id,
            scoreA: m.teamA.score ?? 0,
            scoreB: m.teamB.score ?? 0,
            round: m.round ?? 0,
            completed: m.status === 'completed',
          }));

          // Include the BYE sentinel as a row when it has actually played, so a
          // walkover win has a visible explanation in the table.
          const ids = standingsData.map(t => t.teamId);
          if (swissResults.some(r => isSwissByeTeam(r.teamAId) || isSwissByeTeam(r.teamBId))) {
            const byeId = swissResults
              .flatMap(r => [r.teamAId, r.teamBId])
              .find(isSwissByeTeam);
            if (byeId && !ids.includes(byeId)) ids.push(byeId);
          }

          const swissRows = computeSwissStandings(ids, swissResults);
          const swissById = new Map(swissRows.map(r => [r.teamId, r]));

          // Make sure the BYE sentinel has a display row if it wasn't a team doc.
          for (const row of swissRows) {
            if (standingsData.some(s => s.teamId === row.teamId)) continue;
            standingsData.push({
              position: standingsData.length + 1,
              teamId: row.teamId,
              teamName: 'BYE',
              matchesPlayed: 0,
              wins: 0, draws: 0, losses: 0,
              gamesWon: 0, gamesLost: 0,
              neustadtlScore: 0, points: 0, totalMMR: 0,
              headToHead: {},
            });
          }

          for (const s of standingsData) {
            const row = swissById.get(s.teamId);
            if (!row) continue;
            s.points = row.points;              // games won
            s.wins = row.matchWins;
            s.losses = row.matchLosses;
            s.matchesPlayed = row.opponentIds.length;
            s.draws = Math.max(0, s.matchesPlayed - row.matchWins - row.matchLosses);
            s.gamesWon = row.gamesWon;
            s.gamesLost = row.gamesLost;
            s.buchholz = row.buchholz;
            s.byeCount = row.byeCount;
            s.neustadtlScore = row.buchholz; // reuse the existing display slot
            s.isBye = isSwissByeTeam(s.teamId);
          }

          standingsData.sort((a, b) => {
            const ra = swissById.get(a.teamId);
            const rb = swissById.get(b.teamId);
            if (!ra || !rb) return 0;
            return compareForTable(ra, rb);
          });
        } else {
          // Sort: points DESC → head-to-head → neustadtl DESC → lower totalMMR ASC
          standingsData.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            // Head-to-head among tied teams
            const tiedIds = standingsData.filter(s => s.points === a.points).map(s => s.teamId);
            if (tiedIds.length > 1) {
              const aWins = tiedIds.reduce((sum, id) => id !== a.teamId && a.headToHead[id] === 'win' ? sum + 1 : sum, 0);
              const bWins = tiedIds.reduce((sum, id) => id !== b.teamId && b.headToHead[id] === 'win' ? sum + 1 : sum, 0);
              if (aWins !== bWins) return bWins - aWins;
            }
            if (b.neustadtlScore !== a.neustadtlScore) return b.neustadtlScore - a.neustadtlScore;
            // Lower total MMR wins the tiebreak
            return a.totalMMR - b.totalMMR;
          });
        }

        // Update positions
        standingsData.forEach((team, index) => {
          team.position = index + 1;
        });

        // Calculate actual season progress based on completed matches
        // Count completed matches to determine actual progress
        const completedMatches = matchesData.filter(m => m.status === 'completed').length;
        // Expected total matches: (n teams * (n-1 teams)) / 2 for single round-robin
        const totalExpectedMatches = teamsData.length > 1 ? (teamsData.length * (teamsData.length - 1)) / 2 : 0;
        // Calculate progress as a decimal (0-1), then scale to rounds
        const progressRatio = totalExpectedMatches > 0 ? completedMatches / totalExpectedMatches : 0;
        // Use totalRounds from division data if available, otherwise calculate from team count
        // For single round-robin: (n-1) matchdays/rounds for n teams
        const totalRounds = divisionData.totalRounds || (teamsData.length > 1 ? (teamsData.length - 1) : 1);
        const currentRound = Math.max(1, Math.ceil(progressRatio * totalRounds));

        setStandings(standingsData);
        setMatches(visibleMatches);
        setDivisionInfo({
          id: divisionId,
          name: divisionData.name || divisionId,
          tier: divisionData.tier || 1,
          color: divisionData.color || DIVISION_COLORS[divisionId.toLowerCase()] || '#808080',
          matchday: divisionData.matchday,
          currentRound,
          theme: divisionData.theme,
          medalUrl: divisionData.medalUrl,
          totalRounds,
          highlights: divisionData.highlights || [],
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
