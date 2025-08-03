// Admin version of group standings update using Firebase Admin SDK
import type { Match } from './definitions';

export async function updateStandingsAfterGameAdmin(match: Match): Promise<{ success: boolean; message: string }> {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    const { teams, winnerId } = match;
    if (teams.length !== 2) {
      return { success: false, message: 'Match must have exactly two teams.' };
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
    
    let targetGroupDoc = null;
    for (const groupDoc of groupsSnap.docs) {
      const groupData = groupDoc.data();
      if (groupData.standings?.[teamAId] && groupData.standings?.[teamBId]) {
        targetGroupDoc = groupDoc;
        break;
      }
    }

    if (!targetGroupDoc) {
      // This is not an error, it just means the match was not part of a group stage.
      return { success: true, message: 'Match was not a group stage match, no standings updated.' };
    }

    const groupRef = targetGroupDoc.ref;
    const groupData = targetGroupDoc.data();
    
    // Update standings in a transaction
    await db.runTransaction(async (transaction: any) => {
      const groupSnapshot = await transaction.get(groupRef);
      if (!groupSnapshot.exists) throw new Error('Group not found!');

      const currentGroupData = groupSnapshot.data();
      const standings = currentGroupData.standings;

      const teamAStanding = standings[teamAId];
      const teamBStanding = standings[teamBId];

      // Award points based on individual games won
      teamAStanding.matchesPlayed += 1;
      teamAStanding.points += teamAScore; // Points = games won
      
      teamBStanding.matchesPlayed += 1;
      teamBStanding.points += teamBScore; // Points = games won

      // Update wins/losses/draws based on match result
      if (isDraw) {
        // Both teams get a draw
        teamAStanding.draws += 1;
        teamBStanding.draws += 1;
        
        // Head-to-head tracking for draws
        if (!teamAStanding.headToHead) teamAStanding.headToHead = {};
        if (!teamBStanding.headToHead) teamBStanding.headToHead = {};
        teamAStanding.headToHead[teamBId] = 'draw';
        teamBStanding.headToHead[teamAId] = 'draw';
      } else {
        // Determine winner based on scores
        const actualWinnerId = teamAScore > teamBScore ? teamAId : teamBId;
        const actualLoserId = teamAScore > teamBScore ? teamBId : teamAId;
        
        const winnerStanding = standings[actualWinnerId];
        const loserStanding = standings[actualLoserId];

        winnerStanding.wins += 1;
        loserStanding.losses += 1;
        
        // Update head-to-head
        if (!winnerStanding.headToHead) winnerStanding.headToHead = {};
        if (!loserStanding.headToHead) loserStanding.headToHead = {};
        winnerStanding.headToHead[actualLoserId] = 'win';
        loserStanding.headToHead[actualWinnerId] = 'loss';
      }
      
      transaction.update(groupRef, { standings });
    });

    const resultType = isDraw ? 'draw' : 'win/loss';
    const scoreText = `${teamAScore}-${teamBScore}`;
    return { success: true, message: `Standings updated for group ${targetGroupDoc.id} after match ${match.id} (${scoreText}, ${resultType}).` };
  } catch (error) {
    console.error('Error updating standings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `Failed to update standings: ${errorMessage}` };
  }
}
