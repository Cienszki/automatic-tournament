// src/lib/group-actions.ts
'use server';

import { collection, getDocs, doc, runTransaction, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Match, Group, GroupStanding } from './definitions';
import { revalidatePath } from 'next/cache';

/**
 * Updates the group standings based on the result of a single match.
 * Points are awarded based on individual games won (not matches won):
 * - Win 2-0: 2 points
 * - Draw 1-1: 1 point each
 * - Loss 0-2: 0 points
 * @param match The completed match object.
 */
export async function updateStandingsAfterGame(match: Match): Promise<{ success: boolean; message: string }> {
  const { teams, winnerId } = match;
  if (teams.length !== 2) {
    return { success: false, message: 'Match must have exactly two teams.' };
  }

  // Only process matches that have a group_id (group stage matches)
  if (!match.group_id) {
    return { success: true, message: 'Match is not a group stage match (no group_id), no standings updated.' };
  }

  const [teamAId, teamBId] = teams;
  const isDraw = !winnerId; // No winner means it's a draw (BO2 1-1)

  // Get the actual scores from the match
  const teamAScore = match.teamA?.score || 0; // Number of games won by team A
  const teamBScore = match.teamB?.score || 0; // Number of games won by team B

  // Find the group that contains both teams.
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where(`standings.${teamAId}.teamId`, '==', teamAId), where(`standings.${teamBId}.teamId`, '==', teamBId));
  
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    // This is not an error, it just means the match was not part of a group stage.
    return { success: true, message: 'Match was not a group stage match, no standings updated.' };
  }

  const groupDoc = querySnapshot.docs[0];
  const groupRef = groupDoc.ref;

  try {
    await runTransaction(db, async (transaction) => {
      const groupSnapshot = await transaction.get(groupRef);
      if (!groupSnapshot.exists()) throw new Error('Group not found!');

      const groupData = groupSnapshot.data() as Group;
      const standings = groupData.standings;

      const teamAStanding = standings[teamAId];
      const teamBStanding = standings[teamBId];

      // Award points based on individual games won
      teamAStanding.matchesPlayed += 1;
      teamAStanding.points += teamAScore; // Points = games won
      
      teamBStanding.matchesPlayed += 1;
      teamBStanding.points += teamBScore; // Points = games won

      // Update wins/losses based on match result
      if (isDraw) {
        // Both teams get no additional wins/losses for draws
        // Head-to-head tracking for draws (optional)
        if (!teamAStanding.headToHead) teamAStanding.headToHead = {};
        if (!teamBStanding.headToHead) teamBStanding.headToHead = {};
      } else {
        // Update match wins/losses
        const winnerStanding = standings[winnerId];
        const loserId = teamAId === winnerId ? teamBId : teamAId;
        const loserStanding = standings[loserId];

        winnerStanding.wins += 1;
        loserStanding.losses += 1;
        
        // Update head-to-head
        if (!winnerStanding.headToHead) winnerStanding.headToHead = {};
        if (!loserStanding.headToHead) loserStanding.headToHead = {};
        winnerStanding.headToHead[loserId] = 'win';
        loserStanding.headToHead[winnerId] = 'loss';
      }
      
      transaction.update(groupRef, { standings });
    });

    revalidatePath('/groups'); // Invalidate cache for the groups page
    const resultType = isDraw ? 'draw' : 'win/loss';
    const scoreText = `${teamAScore}-${teamBScore}`;
    return { success: true, message: `Standings updated for group ${groupDoc.id} after match ${match.id} (${scoreText}, ${resultType}).` };
  } catch (error) {
    console.error('Error updating standings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `Failed to update standings: ${errorMessage}` };
  }
}
