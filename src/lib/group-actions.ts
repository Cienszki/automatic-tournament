// src/lib/group-actions.ts
'use server';

import { collection, getDocs, doc, runTransaction, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Match, Group, GroupStanding } from './definitions';
import { revalidatePath } from 'next/cache';

/**
 * Updates the group standings based on the result of a single game (match).
 * This function is designed to be called automatically after a game result is saved.
 * @param match The completed match object, representing one game.
 */
export async function updateStandingsAfterGame(match: Match): Promise<{ success: boolean; message: string }> {
  const { teams, winnerId } = match;
  if (teams.length !== 2 || !winnerId) {
    return { success: false, message: 'Match must have exactly two teams and a winner.' };
  }

  const loserId = teams.find(id => id !== winnerId);
  if (!loserId) {
    return { success: false, message: 'Could not determine loser.' };
  }

  // Find the group that contains both teams.
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where(`standings.${winnerId}.teamId`, '==', winnerId), where(`standings.${loserId}.teamId`, '==', loserId));
  
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

      const winnerStanding = standings[winnerId];
      const loserStanding = standings[loserId];

      // Update winner's stats
      winnerStanding.matchesPlayed += 1;
      winnerStanding.points += 1;
      winnerStanding.wins += 1;
      if (!winnerStanding.headToHead) winnerStanding.headToHead = {};
      winnerStanding.headToHead[loserId] = (winnerStanding.headToHead[loserId] || 0) + 1;


      // Update loser's stats
      loserStanding.matchesPlayed += 1;
      loserStanding.losses += 1;
      
      transaction.update(groupRef, { standings });
    });

    revalidatePath('/groups'); // Invalidate cache for the groups page
    return { success: true, message: `Standings updated for group ${groupDoc.id} after match ${match.id}.` };
  } catch (error) {
    console.error('Error updating standings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `Failed to update standings: ${errorMessage}` };
  }
}
