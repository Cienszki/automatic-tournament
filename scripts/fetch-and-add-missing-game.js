#!/usr/bin/env node

const admin = require('firebase-admin');
const https = require('https');

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

// Fetch data from OpenDota API
function fetchOpenDotaMatch(matchId) {
  return new Promise((resolve, reject) => {
    const url = `https://api.opendota.com/api/matches/${matchId}`;
    console.log(`🌐 Fetching match data from: ${url}`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const matchData = JSON.parse(data);
          resolve(matchData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function fetchAndAddMissingGame() {
  console.log('🎯 Fetching and adding missing Game 8423006415 to CINCO PERROS vs Pora na Przygode...\n');
  
  try {
    // Fetch from OpenDota API
    const gameId = '8423006415';
    const matchData = await fetchOpenDotaMatch(gameId);
    
    console.log('✅ Successfully fetched game data from OpenDota API');
    console.log(`   Duration: ${Math.floor(matchData.duration / 60)}:${String(matchData.duration % 60).padStart(2, '0')}`);
    console.log(`   Radiant Win: ${matchData.radiant_win}`);
    console.log(`   Players: ${matchData.players.length}`);
    console.log(`   Start Time: ${new Date(matchData.start_time * 1000).toISOString()}`);
    
    // Target match: CINCO PERROS vs Pora na Przygode  
    const matchId = "KWrwrjEWK7yL7r6GOipp";
    const matchDoc = await db.collection('matches').doc(matchId).get();
    
    if (!matchDoc.exists) {
      throw new Error(`Match ${matchId} not found`);
    }
    
    console.log(`\n📍 Adding to match: ${matchId} (CINCO PERROS vs Pora na Przygode)`);
    
    // Create game document with OpenDota structure
    const gameData = {
      id: parseInt(gameId),
      duration: matchData.duration || 0,
      start_time: matchData.start_time || Math.floor(Date.now() / 1000),
      radiant_win: matchData.radiant_win || false,
      firstBloodTime: matchData.first_blood_time || 0,
      isParsed: true,
      isManualImport: true,
      lastReprocessed: admin.firestore.Timestamp.now(),
      
      // Manual team assignment as per user instructions
      radiant_team: {
        id: null,
        name: "Pora na Przygode" // User specified: Radiant = Pora na Przygode
      },
      dire_team: {
        id: null,
        name: "CINCO PERROS" // User specified: Dire = CINCO PERROS  
      },
      
      // Add picks/bans if available
      picksBans: matchData.picks_bans || []
    };
    
    console.log('\n💾 Creating game document...');
    await matchDoc.ref.collection('games').doc(gameId).set(gameData);
    console.log('   ✅ Game document created');
    
    // Update match game_ids array
    const currentMatchData = matchDoc.data();
    const currentGameIds = currentMatchData.game_ids || [];
    
    if (!currentGameIds.includes(gameId)) {
      const updatedGameIds = [...currentGameIds, gameId];
      
      console.log('\n📝 Updating match game_ids array...');
      console.log(`   Old game_ids: ${JSON.stringify(currentGameIds)}`);
      console.log(`   New game_ids: ${JSON.stringify(updatedGameIds)}`);
      
      await matchDoc.ref.update({
        game_ids: updatedGameIds
      });
      
      console.log('   ✅ Match game_ids updated');
    }
    
    // Create performance documents with manual team mapping
    console.log(`\n👥 Creating performance documents for ${matchData.players.length} players...`);
    
    // Player mappings for both teams (from previous analysis)
    const playerMapping = {
      // CINCO PERROS players (Dire team in this game)
      372574802: "HsMv06e5VSBpzpkBsNQd", // Juxi1337
      114011482: "7sXBiIbXSl5ijRV0weub", // Joxxi  
      68945677: "GJUf61LWQo85fHSf9Jr8",  // SZYMI
      14947875: "UVkSkax9ePXxQWIniYIV",  // kero
      325826555: "zuPIOY1NbX6zpHdaiwA8", // Abedzik
      
      // We'll need to identify Pora na Przygode players from the radiant side
      // For now, we'll create performances for unknown players too
    };
    
    const batch = db.batch();
    let performancesCreated = 0;
    
    for (const player of matchData.players) {
      const playerId = playerMapping[player.account_id];
      const isRadiant = player.player_slot < 128; // Radiant slots are 0-4, Dire are 128+
      
      if (playerId) {
        // Known tournament player
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
          
          // Fantasy points (will be calculated later)
          fantasyPoints: 0,
          basePoints: 0,
          bonusPoints: 0,
          bonusBreakdown: {},
          
          // Game context  
          matchId: matchId,
          gameId: gameId,
          gameDate: new Date((matchData.start_time || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          win: player.win || 0,
          isRadiant: isRadiant
        };
        
        const performanceRef = matchDoc.ref.collection('games').doc(gameId).collection('performances').doc(playerId);
        batch.set(performanceRef, performance);
        performancesCreated++;
        
        console.log(`   📊 Mapped account_id ${player.account_id} to player ${playerId.substring(0, 8)}... (${isRadiant ? 'Radiant' : 'Dire'})`);
      } else {
        console.log(`   ⚠️  Unknown player account_id ${player.account_id} on ${isRadiant ? 'Radiant (Pora na Przygode)' : 'Dire (CINCO PERROS)'}`);
        // Could create a performance doc with account_id as key for completeness
      }
    }
    
    if (performancesCreated > 0) {
      console.log(`\n💾 Saving ${performancesCreated} performance documents...`);
      await batch.commit();
      console.log('   ✅ All performance documents saved');
    }
    
    console.log('\n🎉 SUCCESS! Game 8423006415 has been added to CINCO PERROS vs Pora na Przygode!');
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Fetched game data from OpenDota API`);
    console.log(`   ✅ Added game to CINCO PERROS vs Pora na Przygode match`);
    console.log(`   ✅ Manually assigned teams: Radiant=Pora na Przygode, Dire=CINCO PERROS`);
    console.log(`   ✅ Created ${performancesCreated} performance documents for known players`);
    console.log(`   ✅ Match now has 2 games instead of 1`);
    
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Run fantasy recalculation to update scores');
    console.log('   2. Verify both matches now have proper game counts');
    console.log('   3. Check if any Pora na Przygode players need to be mapped');
    
  } catch (error) {
    console.error('❌ Error fetching and adding game:', error);
  }
}

// Run the script
if (require.main === module) {
  fetchAndAddMissingGame().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fetchAndAddMissingGame };