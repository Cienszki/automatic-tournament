#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  try {
    // Load environment variables
    require('dotenv').config({ path: '.env.local' });
    
    // Decode the base64 encoded service account
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!serviceAccountBase64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not found');
    }
    
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function addGameToCincoMatch() {
  console.log('➕ Adding Game 8427125277 to the CINCO PERROS match...\n');
  
  try {
    // Read the OpenDota format data for game 8427125277
    const parsedReplaysDir = path.join(__dirname, '..', 'parsed replays');
    const opendotaFilePath = path.join(parsedReplaysDir, '8427125277_opendota.json');
    
    console.log('📄 Reading parsed replay data...');
    const fileContent = await fs.readFile(opendotaFilePath, 'utf8');
    const opendotaData = JSON.parse(fileContent);
    console.log(`   ✅ Loaded game data: ${opendotaData.players?.length || 0} players, Duration: ${Math.floor((opendotaData.duration || 0) / 60)}:${String((opendotaData.duration || 0) % 60).padStart(2, '0')}`);
    
    // Find the CINCO PERROS match (the one that had Game ID: 2)
    const targetMatchId = "KWrwrjEWK7yL7r6GOipp"; // From our previous deletion
    const matchDoc = await db.collection('matches').doc(targetMatchId).get();
    
    if (!matchDoc.exists) {
      throw new Error(`Match ${targetMatchId} not found`);
    }
    
    console.log(`📍 Found target match: ${targetMatchId}`);
    const matchData = matchDoc.data();
    console.log(`   Current game_ids: ${JSON.stringify(matchData.game_ids || [])}`);
    
    // Check if the game already exists in this match
    const existingGameDoc = await matchDoc.ref.collection('games').doc('8427125277').get();
    if (existingGameDoc.exists) {
      console.log('⚠️  Game 8427125277 already exists in this match, updating it...');
    }
    
    // Create the game document with proper OpenDota structure
    const gameData = {
      id: parseInt('8427125277'),
      duration: opendotaData.duration || 0,
      start_time: opendotaData.start_time || Math.floor(Date.now() / 1000),
      radiant_win: opendotaData.radiant_win || false,
      firstBloodTime: opendotaData.first_blood_time || 0,
      isParsed: true,
      isManualImport: true,
      lastReprocessed: admin.firestore.Timestamp.now(),
      
      // Add proper team structures
      radiant_team: {
        id: opendotaData.radiant_team_id || null,
        name: opendotaData.radiant_name || "Radiant"
      },
      dire_team: {
        id: opendotaData.dire_team_id || null,
        name: opendotaData.dire_name || "Dire"
      },
      
      // Add picks/bans if available
      picksBans: opendotaData.picks_bans || []
    };
    
    console.log('\n💾 Creating/updating game document...');
    await matchDoc.ref.collection('games').doc('8427125277').set(gameData);
    console.log('   ✅ Game document created/updated');
    
    // Update match game_ids array
    const currentGameIds = matchData.game_ids || [];
    if (!currentGameIds.includes('8427125277')) {
      const updatedGameIds = [...currentGameIds, '8427125277'];
      
      console.log('\n📝 Updating match game_ids array...');
      console.log(`   Old game_ids: ${JSON.stringify(currentGameIds)}`);
      console.log(`   New game_ids: ${JSON.stringify(updatedGameIds)}`);
      
      await matchDoc.ref.update({
        game_ids: updatedGameIds
      });
      
      console.log('   ✅ Match game_ids updated');
    } else {
      console.log('\n✅ Game ID already in match game_ids array');
    }
    
    // Now create performance documents for all players
    if (opendotaData.players && Array.isArray(opendotaData.players)) {
      console.log(`\n👥 Creating performance documents for ${opendotaData.players.length} players...`);
      
      // CINCO PERROS player mapping (from our previous analysis)
      const playerMapping = {
        372574802: "HsMv06e5VSBpzpkBsNQd", // Juxi1337
        114011482: "7sXBiIbXSl5ijRV0weub", // Joxxi
        68945677: "GJUf61LWQo85fHSf9Jr8",  // SZYMI
        14947875: "UVkSkax9ePXxQWIniYIV",  // kero
        325826555: "zuPIOY1NbX6zpHdaiwA8" // Abedzik
      };
      
      const batch = db.batch();
      let performancesCreated = 0;
      
      for (const player of opendotaData.players) {
        const playerId = playerMapping[player.account_id];
        
        if (playerId) {
          // Create performance document
          const performance = {
            playerId: playerId,
            teamId: null,
            heroId: player.hero_id || 0,
            kills: player.kills || 0,
            deaths: player.deaths || 0,
            assists: player.assists || 0,
            last_hits: player.last_hits || 0,
            denies: player.denies || 0,
            gold_per_min: player.gold_per_min || 0,
            xp_per_min: player.xp_per_min || 0,
            level: player.level || 0,
            net_worth: player.net_worth || 0,
            hero_damage: player.hero_damage || 0,
            tower_damage: player.tower_damage || 0,
            hero_healing: player.hero_healing || 0,
            obs_placed: player.obs_placed || 0,
            sen_placed: player.sen_placed || 0,
            stuns: player.stuns || 0,
            creeps_stacked: player.creeps_stacked || 0,
            camps_stacked: player.camps_stacked || 0,
            rune_pickups: player.rune_pickups || 0,
            firstblood_claimed: player.firstblood_claimed || 0,
            teamfight_participation: player.teamfight_participation || 0,
            towers_killed: player.towers_killed || 0,
            roshans_killed: player.roshans_killed || 0,
            
            // These will be calculated by the fantasy system
            fantasyPoints: 0,
            basePoints: 0,
            bonusPoints: 0,
            bonusBreakdown: {},
            killPoints: 0,
            deathPoints: 0,
            assistPoints: 0,
            
            // Game context
            matchId: targetMatchId,
            gameId: '8427125277',
            gameDate: new Date((opendotaData.start_time || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            win: player.win || 0,
            isRadiant: player.isRadiant || false
          };
          
          const performanceRef = matchDoc.ref.collection('games').doc('8427125277').collection('performances').doc(playerId);
          batch.set(performanceRef, performance);
          performancesCreated++;
          
          console.log(`   📊 Mapped account_id ${player.account_id} to player ${playerId.substring(0, 8)}...`);
        } else {
          console.log(`   ⚠️  Could not map account_id ${player.account_id} to tournament player`);
        }
      }
      
      if (performancesCreated > 0) {
        console.log(`\n💾 Saving ${performancesCreated} performance documents...`);
        await batch.commit();
        console.log('   ✅ All performance documents saved');
      }
    }
    
    console.log('\n🎉 SUCCESS! Game 8427125277 has been properly added to the CINCO PERROS match!');
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Game document created with proper OpenDota structure`);
    console.log(`   ✅ Match game_ids array updated`);
    console.log(`   ✅ ${performancesCreated || 0} performance documents created`);
    console.log(`   ✅ CINCO PERROS should now have 6 complete games`);
    
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Run fantasy recalculation to update all scores');
    console.log('   2. Verify that .joxxi now has 30 fantasy games (5 players × 6 games)');
    console.log('   3. Check that all CINCO PERROS players show 6 games in their stats');
    
  } catch (error) {
    console.error('❌ Error adding game to match:', error);
  }
}

// Run the script
if (require.main === module) {
  addGameToCincoMatch().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { addGameToCincoMatch };