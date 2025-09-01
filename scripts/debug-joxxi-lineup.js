#!/usr/bin/env node

const admin = require('firebase-admin');

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

async function debugJoxxiLineup() {
  console.log('🔍 Debugging .joxxi lineup structure...\n');
  
  try {
    // Check all fantasy lineups to understand the structure
    console.log('📋 Checking all fantasy lineups...');
    const lineupsSnapshot = await db.collection('fantasyLineups').get();
    console.log(`   Total fantasy lineups: ${lineupsSnapshot.docs.length}`);
    
    let joxxiLineup = null;
    
    for (const doc of lineupsSnapshot.docs) {
      const lineup = doc.data();
      console.log(`\n   📄 Lineup ${doc.id}:`);
      console.log(`      Username: ${lineup.username || 'none'}`);
      console.log(`      Display Name: ${lineup.displayName || 'none'}`);
      console.log(`      UID: ${lineup.uid || 'none'}`);
      console.log(`      Data keys: ${Object.keys(lineup).join(', ')}`);
      
      // Check if this might be joxxi
      if (lineup.username === '.joxxi' || lineup.displayName === '.joxxi' || 
          lineup.username === 'joxxi' || lineup.displayName === 'joxxi' ||
          doc.id.includes('joxxi') || JSON.stringify(lineup).toLowerCase().includes('joxxi')) {
        
        console.log(`      🎯 POTENTIAL JOXXI LINEUP!`);
        console.log(`      Full data: ${JSON.stringify(lineup, null, 2)}`);
        joxxiLineup = lineup;
      }
    }
    
    if (!joxxiLineup) {
      console.log('\n❌ Could not find any lineup that looks like .joxxi');
      console.log('   Checking if there are lineups with CINCO PERROS players...');
      
      // CINCO PERROS player IDs
      const cincoPlayerIds = [
        "HsMv06e5VSBpzpkBsNQd", // Juxi1337
        "7sXBiIbXSl5ijRV0weub", // Joxxi
        "GJUf61LWQo85fHSf9Jr8", // SZYMI  
        "UVkSkax9ePXxQWIniYIV", // kero
        "zuPIOY1NbX6zpHdaiwA8"  // Abedzik
      ];
      
      for (const doc of lineupsSnapshot.docs) {
        const lineup = doc.data();
        const lineupData = JSON.stringify(lineup);
        
        // Check if this lineup contains any CINCO PERROS players
        const hasCincoPlayers = cincoPlayerIds.some(playerId => lineupData.includes(playerId));
        
        if (hasCincoPlayers) {
          console.log(`\n   🎯 Found lineup with CINCO PERROS players: ${doc.id}`);
          console.log(`      Username: ${lineup.username || 'none'}`);
          console.log(`      Full data: ${JSON.stringify(lineup, null, 2)}`);
          
          // Count how many CINCO players
          const matchedPlayers = cincoPlayerIds.filter(playerId => lineupData.includes(playerId));
          console.log(`      CINCO PERROS players: ${matchedPlayers.length}/5`);
        }
      }
    }
    
    // Also check if the API endpoint is working
    console.log('\n🌐 Testing fantasy leaderboard API endpoint...');
    
  } catch (error) {
    console.error('❌ Error debugging lineup:', error);
  }
}

// Run the script
if (require.main === module) {
  debugJoxxiLineup().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { debugJoxxiLineup };