#!/usr/bin/env node
/**
 * Script to fix game IDs in the database.
 * Changes game document IDs from series numbers (like "2") to their actual OpenDota match IDs.
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

// Initialize Firebase Admin
const app = initializeApp({
  credential: credential.applicationDefault(),
  projectId: 'tournament-tracker-f35tb'
});

const db = getFirestore(app);

async function fixGameIds() {
  console.log('Starting to fix game IDs...');
  
  try {
    // Get all matches
    const matchesSnapshot = await db.collection('matches').get();
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      console.log(`\nProcessing match: ${matchId}`);
      console.log(`Current game_ids: ${matchData.game_ids || 'none'}`);
      
      // Get all games in this match
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      
      const newGameIds = [];
      const gamesToMove = [];
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        console.log(`  Found game: ${gameId}`);
        
        // Check if this game has an OpenDota match ID that's different from the document ID
        const openDotaMatchId = gameData.id; // This should be the OpenDota match ID
        
        if (openDotaMatchId && openDotaMatchId.toString() !== gameId) {
          console.log(`    Game ID mismatch: doc ID "${gameId}" vs OpenDota ID "${openDotaMatchId}"`);
          gamesToMove.push({
            oldId: gameId,
            newId: openDotaMatchId.toString(),
            data: gameData
          });
          newGameIds.push(parseInt(openDotaMatchId));
        } else if (openDotaMatchId) {
          // Game ID is already correct
          newGameIds.push(parseInt(openDotaMatchId));
        } else {
          console.log(`    Warning: Game "${gameId}" has no OpenDota match ID`);
        }
      }
      
      // Move games with incorrect IDs
      for (const gameToMove of gamesToMove) {
        console.log(`    Moving game from "${gameToMove.oldId}" to "${gameToMove.newId}"`);
        
        // Create new game document with correct ID
        await matchDoc.ref.collection('games').doc(gameToMove.newId).set(gameToMove.data);
        
        // Delete old game document
        await matchDoc.ref.collection('games').doc(gameToMove.oldId).delete();
        
        console.log(`    ✅ Moved game successfully`);
      }
      
      // Update match game_ids array if needed
      if (gamesToMove.length > 0) {
        console.log(`  Updating match game_ids to: [${newGameIds.join(', ')}]`);
        await matchDoc.ref.update({
          game_ids: newGameIds
        });
        console.log(`  ✅ Updated match game_ids`);
      }
    }
    
    console.log('\n✅ Game ID fix completed!');
  } catch (error) {
    console.error('❌ Error fixing game IDs:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fixGameIds()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixGameIds };