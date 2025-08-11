import type { Match } from "./definitions";
import { updateStandingsAfterGameAdmin } from "./group-actions-admin";
import { updateStatsAfterMatchChange } from "./stats-service-simple";

// Delete a game, block it from sync, and update match/game_ids and standings - ADMIN VERSION
export async function adminDeleteGameAndHandleScore(match: Match, gameId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    ensureAdminInitialized();
    const db = getAdminDb();

    // 1. Delete the game from the games subcollection
    const gameRef = db.collection("matches").doc(match.id).collection("games").doc(gameId);
    await gameRef.delete();

    // 2. Mark this game as blocked for sync
    const blockedRef = db.collection("blockedGames").doc(`${match.id}_${gameId}`);
    await blockedRef.set({ matchId: match.id, gameId, blockedAt: new Date().toISOString() });

    // 3. Remove the gameId from the match's game_ids array
    const matchRef = db.collection("matches").doc(match.id);
    await matchRef.update({ game_ids: FieldValue.arrayRemove(Number(gameId)) });

    // 4. Recalculate match scores based on remaining games
    await recalculateMatchScoresAdmin(match.id);
    
    // 5. Update tournament statistics
    try {
      await updateStatsAfterMatchChange(match.id);
      console.log('Tournament statistics updated after game deletion');
    } catch (statsError) {
      console.error('Failed to update tournament statistics:', statsError);
      // Don't fail the entire operation if stats update fails
    }

    return { success: true, message: "Game deleted, blocked from sync, and scores/standings updated." };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

// Helper function to recalculate match scores after game deletion
export async function recalculateMatchScoresAdmin(matchId: string): Promise<void> {
  const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const matchRef = db.collection("matches").doc(matchId);
  const matchDoc = await matchRef.get();
  
  if (!matchDoc.exists) {
    return;
  }

  const matchData = matchDoc.data();
  if (!matchData) {
    return;
  }
  
  // Get all remaining games for this match
  const gamesSnapshot = await matchRef.collection("games").get();
  const games = gamesSnapshot.docs.map(doc => doc.data());
  
  if (games.length === 0) {
    // No games left, reset to pending
    await matchRef.update({
      'teamA.score': 0,
      'teamB.score': 0,
      status: 'pending',
      winnerId: null,
      completed_at: null
    });
    return;
  }

  // Calculate series score
  const teamAId = matchData.teams?.[0];
  const teamBId = matchData.teams?.[1];
  
  if (!teamAId || !teamBId) {
    return;
  }

  let teamAWins = 0;
  let teamBWins = 0;

  // Count wins for each team
  games.forEach(game => {
    if (game.radiant_win) {
      if (game.radiant_team?.id === teamAId) {
        teamAWins++;
      } else if (game.radiant_team?.id === teamBId) {
        teamBWins++;
      }
    } else {
      if (game.dire_team?.id === teamAId) {
        teamAWins++;
      } else if (game.dire_team?.id === teamBId) {
        teamBWins++;
      }
    }
  });

  const totalGames = games.length;

  // Determine if series is still complete based on format
  const seriesFormat = matchData.series_format || (matchData.group_id ? 'bo2' : 'bo3'); // Default: BO2 for groups, BO3 for playoffs
  
  let isComplete = false;
  let winnerId = null;
  
  if (seriesFormat === 'bo1') {
    // BO1: Complete after 1 game
    isComplete = totalGames >= 1;
    winnerId = teamAWins > teamBWins ? teamAId : teamBId;
  } else if (seriesFormat === 'bo2') {
    // BO2: Complete after 2 games OR if one team has 2 wins
    isComplete = totalGames >= 2 || teamAWins >= 2 || teamBWins >= 2;
    // Winner is only determined if one team has more wins
    if (teamAWins > teamBWins) winnerId = teamAId;
    else if (teamBWins > teamAWins) winnerId = teamBId;
    // If tied (1-1), winnerId remains null (draw)
  } else if (seriesFormat === 'bo3') {
    // BO3: Complete when one team gets 2 wins
    isComplete = teamAWins >= 2 || teamBWins >= 2;
    winnerId = teamAWins >= 2 ? teamAId : teamBWins >= 2 ? teamBId : null;
  } else if (seriesFormat === 'bo5') {
    // BO5: Complete when one team gets 3 wins
    isComplete = teamAWins >= 3 || teamBWins >= 3;
    winnerId = teamAWins >= 3 ? teamAId : teamBWins >= 3 ? teamBId : null;
  }

  // Update match document
  const updateData: any = {
    'teamA.score': teamAWins,
    'teamB.score': teamBWins
  };

  if (isComplete) {
    updateData.status = 'completed';
    updateData.winnerId = winnerId; // Can be null for draws in BO2
    updateData.completed_at = new Date().toISOString();
  } else {
    updateData.status = 'pending';
    updateData.winnerId = null;
    updateData.completed_at = null;
  }

  await matchRef.update(updateData);

  // If match is completed, update group standings
  if (isComplete) {
    // Trigger full group standings recalculation instead of incremental update
    // This ensures accurate standings after game deletion
    await triggerFullGroupRecalculation();
  }

  console.log(`Match ${matchId} recalculated: ${teamAWins}-${teamBWins}, complete: ${isComplete}`);
}

// Helper function to trigger full group standings recalculation
async function triggerFullGroupRecalculation(): Promise<void> {
  try {
    const { getAllMatches } = await import('./firestore');
    
    // Step 1: Reset all group standings to zero
    await resetAllGroupStandingsAdmin();
    
    // Step 2: Get all completed matches and recalculate
    const allMatches = await getAllMatches();
    const completedMatches = allMatches.filter(match => match.status === 'completed');
    
    // Step 3: Process each completed match
    for (const match of completedMatches) {
      try {
        await updateStandingsDirectAdmin(match);
      } catch (error) {
        console.error(`Failed to update standings for match ${match.id}:`, error);
      }
    }
    
    console.log(`Full group recalculation completed for ${completedMatches.length} matches`);
  } catch (error) {
    console.error('Error in full group recalculation:', error);
  }
}

// Function to reset all group standings to zero (admin version)
async function resetAllGroupStandingsAdmin(): Promise<void> {
  const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const groupsRef = db.collection('groups');
  const groupsSnap = await groupsRef.get();
  
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
    }
  }
}

// Direct admin standings update function (copied from recalculateStandings route)
async function updateStandingsDirectAdmin(match: any): Promise<void> {
  const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const { teams, winnerId } = match;
  if (teams.length !== 2) {
    return;
  }

  const [teamAId, teamBId] = teams;
  
  // Get the actual scores from the match
  const teamAScore = match.teamA?.score || 0; // Number of games won by team A
  const teamBScore = match.teamB?.score || 0; // Number of games won by team B
  
  // Determine if it's a draw based on scores being equal (e.g., 1-1 in BO2)
  const isDraw = teamAScore === teamBScore;

  // Find the group that contains both teams
  const groupsRef = db.collection('groups');
  const groupsSnap = await groupsRef.get();

  let targetGroupRef = null;
  for (const groupDoc of groupsSnap.docs) {
    const groupData = groupDoc.data();
    const standings = groupData.standings || {};
    
    if (standings[teamAId] && standings[teamBId]) {
      targetGroupRef = groupDoc.ref;
      break;
    }
  }

  if (!targetGroupRef) {
    console.log(`No group found containing both teams ${teamAId} and ${teamBId}`);
    return;
  }

  // Get current standings
  const groupDoc = await targetGroupRef.get();
  const groupData = groupDoc.data();
  const standings = groupData?.standings || {};

  // Ensure both teams have standings entries
  if (!standings[teamAId]) standings[teamAId] = { points: 0, wins: 0, draws: 0, losses: 0, matchesPlayed: 0, headToHead: {} };
  if (!standings[teamBId]) standings[teamBId] = { points: 0, wins: 0, draws: 0, losses: 0, matchesPlayed: 0, headToHead: {} };

  // Update matches played
  standings[teamAId].matchesPlayed = (standings[teamAId].matchesPlayed || 0) + 1;
  standings[teamBId].matchesPlayed = (standings[teamBId].matchesPlayed || 0) + 1;

  // Update wins, draws, losses and points
  if (isDraw) {
    // Draw - both teams get 1 point
    standings[teamAId].draws = (standings[teamAId].draws || 0) + 1;
    standings[teamBId].draws = (standings[teamBId].draws || 0) + 1;
    standings[teamAId].points = (standings[teamAId].points || 0) + 1;
    standings[teamBId].points = (standings[teamBId].points || 0) + 1;
    
    // Update head-to-head for draws
    if (!standings[teamAId].headToHead) standings[teamAId].headToHead = {};
    if (!standings[teamBId].headToHead) standings[teamBId].headToHead = {};
    standings[teamAId].headToHead[teamBId] = 'draw';
    standings[teamBId].headToHead[teamAId] = 'draw';
  } else if (winnerId === teamAId) {
    // Team A wins
    standings[teamAId].wins = (standings[teamAId].wins || 0) + 1;
    standings[teamBId].losses = (standings[teamBId].losses || 0) + 1;
    standings[teamAId].points = (standings[teamAId].points || 0) + 3;
    
    // Update head-to-head
    if (!standings[teamAId].headToHead) standings[teamAId].headToHead = {};
    if (!standings[teamBId].headToHead) standings[teamBId].headToHead = {};
    standings[teamAId].headToHead[teamBId] = 'win';
    standings[teamBId].headToHead[teamAId] = 'loss';
  } else if (winnerId === teamBId) {
    // Team B wins
    standings[teamBId].wins = (standings[teamBId].wins || 0) + 1;
    standings[teamAId].losses = (standings[teamAId].losses || 0) + 1;
    standings[teamBId].points = (standings[teamBId].points || 0) + 3;
    
    // Update head-to-head
    if (!standings[teamAId].headToHead) standings[teamAId].headToHead = {};
    if (!standings[teamBId].headToHead) standings[teamBId].headToHead = {};
    standings[teamBId].headToHead[teamAId] = 'win';
    standings[teamAId].headToHead[teamBId] = 'loss';
  }

  // Save updated standings
  await targetGroupRef.update({ standings });
}
