// src/lib/post-sync-recalculations.ts
// Comprehensive recalculation functions to run after match sync

import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';
import { getAllMatchesAdmin } from './admin-actions';

/**
 * Recalculate all group standings from scratch
 */
export async function recalculateGroupStandingsAdmin(): Promise<{ success: boolean; message: string; groupsProcessed: number; matchesProcessed: number }> {
  try {
    console.log('Recalculating all group standings...');
    ensureAdminInitialized();
    const db = getAdminDb();

    // Step 1: Reset all group standings to zero
    const groupsRef = db.collection('groups');
    const groupsSnap = await groupsRef.get();
    
    let groupsProcessed = 0;
    
    for (const groupDoc of groupsSnap.docs) {
      const groupData = groupDoc.data();
      if (groupData.standings) {
        // Reset all team standings in this group
        const resetStandings = { ...groupData.standings };
        
        for (const teamId in resetStandings) {
          resetStandings[teamId] = {
            ...resetStandings[teamId],
            points: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            matchesPlayed: 0,
            headToHead: {}
          };
        }
        
        await groupDoc.ref.update({ standings: resetStandings });
        groupsProcessed++;
      }
    }

    // Step 2: Recalculate from all completed matches
    const allMatches = await getAllMatchesAdmin();
    const completedMatches = allMatches.filter(match => match.status === 'completed');
    
    let matchesProcessed = 0;
    
    for (const match of completedMatches) {
      try {
        await updateStandingsForMatchAdmin(match);
        matchesProcessed++;
      } catch (error) {
        console.error(`Failed to update standings for match ${match.id}:`, error);
      }
    }

    return { 
      success: true, 
      message: `Group standings recalculated: ${groupsProcessed} groups reset, ${matchesProcessed} matches processed`,
      groupsProcessed,
      matchesProcessed
    };
  } catch (error) {
    console.error('Error recalculating group standings:', error);
    return { 
      success: false, 
      message: `Failed to recalculate group standings: ${(error as Error).message}`,
      groupsProcessed: 0,
      matchesProcessed: 0
    };
  }
}

/**
 * Update standings for a single match (helper function)
 */
async function updateStandingsForMatchAdmin(match: any): Promise<void> {
  ensureAdminInitialized();
  const db = getAdminDb();

  const { teams } = match;
  if (!teams || teams.length !== 2) return;

  const [teamAId, teamBId] = teams;
  const teamAScore = match.teamA?.score || 0;
  const teamBScore = match.teamB?.score || 0;
  const isDraw = teamAScore === teamBScore;

  // Find the group containing both teams
  const groupsRef = db.collection('groups');
  const groupsSnap = await groupsRef.get();
  
  let targetGroupDoc = null;
  for (const groupDoc of groupsSnap.docs) {
    const groupData = groupDoc.data();
    if (groupData.standings?.[teamAId] && groupData.standings?.[teamBId]) {
      targetGroupDoc = groupDoc;
      break;
    }
  }

  if (!targetGroupDoc) return; // Not a group stage match

  // Update standings in transaction
  await db.runTransaction(async (transaction: any) => {
    const groupSnapshot = await transaction.get(targetGroupDoc.ref);
    if (!groupSnapshot.exists) return;

    const currentGroupData = groupSnapshot.data();
    const standings = currentGroupData.standings;

    const teamAStanding = standings[teamAId];
    const teamBStanding = standings[teamBId];

    // Update match count and points
    teamAStanding.matchesPlayed += 1;
    teamAStanding.points += teamAScore;
    teamBStanding.matchesPlayed += 1;
    teamBStanding.points += teamBScore;

    // Update wins/losses/draws
    if (isDraw) {
      teamAStanding.draws += 1;
      teamBStanding.draws += 1;
      if (!teamAStanding.headToHead) teamAStanding.headToHead = {};
      if (!teamBStanding.headToHead) teamBStanding.headToHead = {};
      teamAStanding.headToHead[teamBId] = 'draw';
      teamBStanding.headToHead[teamAId] = 'draw';
    } else {
      const winnerId = teamAScore > teamBScore ? teamAId : teamBId;
      const loserId = teamAScore > teamBScore ? teamBId : teamAId;
      
      standings[winnerId].wins += 1;
      standings[loserId].losses += 1;
      
      if (!standings[winnerId].headToHead) standings[winnerId].headToHead = {};
      if (!standings[loserId].headToHead) standings[loserId].headToHead = {};
      standings[winnerId].headToHead[loserId] = 'win';
      standings[loserId].headToHead[winnerId] = 'loss';
    }
    
    transaction.update(targetGroupDoc.ref, { standings });
  });
}

/**
 * Recalculate all fantasy scores
 */
export async function recalculateFantasyScoresAdmin(): Promise<{ success: boolean; message: string; usersProcessed: number; roundsProcessed: number }> {
  try {
    console.log('Recalculating fantasy scores...');
    const { recalculateAllFantasyScores } = await import('./fantasy-scoring-admin');
    
    const result = await recalculateAllFantasyScores();
    
    return {
      success: result.success,
      message: result.message,
      usersProcessed: result.usersProcessed || 0,
      roundsProcessed: Array.isArray(result.roundsProcessed) ? result.roundsProcessed.length : (result.roundsProcessed || 0)
    };
  } catch (error) {
    console.error('Error recalculating fantasy scores:', error);
    return {
      success: false,
      message: `Failed to recalculate fantasy scores: ${(error as Error).message}`,
      usersProcessed: 0,
      roundsProcessed: 0
    };
  }
}

/**
 * Update tournament statistics (admin version)
 */
export async function updateTournamentStatsAdmin(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('Updating tournament statistics...');
    
    // Import the stats calculation functions
    const { recalculateBasicTournamentStatsAdmin } = await import('./stats-calculator-admin');
    
    await recalculateBasicTournamentStatsAdmin();
    
    return {
      success: true,
      message: 'Tournament statistics updated successfully'
    };
  } catch (error) {
    console.error('Error updating tournament statistics:', error);
    return {
      success: false,
      message: `Failed to update tournament statistics: ${(error as Error).message}`
    };
  }
}

/**
 * Run all post-sync recalculations
 */
export async function runAllPostSyncRecalculations(): Promise<{ success: boolean; message: string; details: any }> {
  const startTime = Date.now();
  console.log('🔄 Starting comprehensive post-sync recalculations...');
  
  const results = {
    groupStandings: { success: false, message: '', groupsProcessed: 0, matchesProcessed: 0 },
    fantasyScores: { success: false, message: '', usersProcessed: 0, roundsProcessed: 0 },
    tournamentStats: { success: false, message: '' }
  };

  try {
    // 1. Recalculate Group Standings
    console.log('📊 Recalculating group standings...');
    results.groupStandings = await recalculateGroupStandingsAdmin();
    console.log(`✅ Group standings: ${results.groupStandings.message}`);

    // 2. Recalculate Fantasy Scores  
    console.log('🏆 Recalculating fantasy scores...');
    results.fantasyScores = await recalculateFantasyScoresAdmin();
    console.log(`✅ Fantasy scores: ${results.fantasyScores.message}`);

    // 3. Update Tournament Statistics
    console.log('📈 Updating tournament statistics...');
    results.tournamentStats = await updateTournamentStatsAdmin();
    console.log(`✅ Tournament stats: ${results.tournamentStats.message}`);

    const duration = Date.now() - startTime;
    const allSuccessful = results.groupStandings.success && results.fantasyScores.success && results.tournamentStats.success;
    
    const summary = `Post-sync recalculations completed in ${duration}ms. Groups: ${results.groupStandings.groupsProcessed} processed, Fantasy: ${results.fantasyScores.usersProcessed} users updated, Stats: ${results.tournamentStats.success ? 'updated' : 'failed'}`;

    return {
      success: allSuccessful,
      message: allSuccessful ? `✅ ${summary}` : `⚠️ ${summary} (some operations failed)`,
      details: results
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Error during post-sync recalculations:', error);
    return {
      success: false,
      message: `❌ Post-sync recalculations failed after ${duration}ms: ${(error as Error).message}`,
      details: results
    };
  }
}