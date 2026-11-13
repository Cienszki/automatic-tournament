// useDivisionData.ts on captured data; see old-site-inputs.ts for how the inputs are built.
// The blocks between BEGIN COPY and END COPY are the hook's own code, unchanged.

/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
import type { Match } from '@/lib/definitions';
import { countsForStandings } from '@/lib/match-flags';
import { computeSwissStandings, compareForTable, isSwissByeTeam, type SwissMatchResult } from '@/lib/swiss/pairing';
import type { ExportRecord } from '../lib/format';
import { eq, snapshot, type TournamentLike } from './old-site-inputs';

// BEGIN COPY useDivisionData.ts
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
// END COPY

// BEGIN COPY useDivisionData.ts
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
// END COPY

export type DivisionTableRow = TeamStanding;

/** The rows `useDivisionData(divisionId)` sets as `standings`, in display order. */
export function divisionTable(tournament: TournamentLike, divisionId: string, teams: ExportRecord[], matches: ExportRecord[]): TeamStanding[] {
  const teamsSnapshot = snapshot(teams, eq('divisionId', divisionId));
  const teamsData = teamsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];
  const matchesByDivisionId = snapshot(matches, eq('divisionId', divisionId));
  const matchesByGroupId = snapshot(matches, eq('group_id', divisionId));

  // BEGIN COPY useDivisionData.ts
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
            extra: data.extra,
            replacesMatchId: data.replacesMatchId,
            replacedByMatchId: data.replacedByMatchId,
          } as Match;
        });
        // The table counts only matches that count (no tiebreaks / showmatches, no replayed
        // originals — their rematch counts instead); the schedule shows them all
        const tableMatches = matchesData.filter(countsForStandings);

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
          form: calculateForm(team.id, tableMatches),
          headToHead: {},
        }));

        const standingsMap = new Map(standingsData.map(t => [t.teamId, t]));

        // FIRST PASS: accumulate wins/draws/losses/points from completed match results
        tableMatches.forEach(match => {
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

        tableMatches.forEach(match => {
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
          const swissResults: SwissMatchResult[] = tableMatches.map(m => ({
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
  // END COPY

  return standingsData;
}
