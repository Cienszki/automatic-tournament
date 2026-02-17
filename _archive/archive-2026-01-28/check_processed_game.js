const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Decode base64 encoded service account
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!serviceAccountBase64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not found');
  }
  
  const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkProcessedGame(gameId) {
  console.log(`🔍 Checking processed game: ${gameId}...`);
  
  try {
    // Check the processedGames collection
    const processedRef = db.collection('processedGames').doc(gameId);
    const processedDoc = await processedRef.get();
    
    if (!processedDoc.exists) {
      console.log(`❌ Game ${gameId} not found in processedGames collection`);
      return;
    }
    
    const processedData = processedDoc.data();
    console.log(`✅ Found game ${gameId} in processedGames collection`);
    console.log('\n📊 Processed Game Data:');
    console.log(`- Processed At: ${processedData.processedAt}`);
    console.log(`- Source: ${processedData.source || 'unknown'}`);
    console.log(`- Status: ${processedData.status || 'unknown'}`);
    console.log(`- Match ID: ${processedData.matchId || 'none'}`);
    console.log(`- Error: ${processedData.error || 'none'}`);
    console.log(`- Skip Reason: ${processedData.skipReason || 'none'}`);
    console.log(`- Is Manual Import: ${processedData.isManualImport || false}`);
    console.log(`- Fantasy Updated: ${processedData.fantasyUpdated || false}`);
    
    // Show all available fields
    console.log('\n🔍 All fields in processed game document:');
    Object.keys(processedData).forEach(key => {
      console.log(`- ${key}: ${JSON.stringify(processedData[key])}`);
    });
    
    // If there was an error or skip reason, show more details
    if (processedData.error) {
      console.log(`\n❌ ERROR DETAILS: ${processedData.error}`);
    }
    
    if (processedData.skipReason) {
      console.log(`\n⏭️  SKIP REASON: ${processedData.skipReason}`);
    }
    
    // Check if the game was supposed to be saved to a specific match
    if (processedData.matchId) {
      console.log(`\n🔗 Checking if game was saved to match: ${processedData.matchId}`);
      
      try {
        const matchRef = db.collection('matches').doc(processedData.matchId);
        const matchDoc = await matchRef.get();
        
        if (matchDoc.exists) {
          const matchData = matchDoc.data();
          console.log(`✅ Match exists: ${matchData.teamA?.name || 'Team A'} vs ${matchData.teamB?.name || 'Team B'}`);
          console.log(`- Game IDs in match: ${JSON.stringify(matchData.game_ids || [])}`);
          
          // Check games subcollection
          const gamesRef = matchRef.collection('games');
          const gameDoc = await gamesRef.doc(gameId).get();
          
          if (gameDoc.exists) {
            console.log(`✅ Game document exists in match games subcollection`);
          } else {
            console.log(`❌ Game document NOT found in match games subcollection`);
          }
          
        } else {
          console.log(`❌ Match ${processedData.matchId} does not exist`);
        }
      } catch (matchError) {
        console.log(`❌ Error checking match: ${matchError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking processed game:', error);
  }
}

// Get game ID from command line argument or use default
const gameId = process.argv[2] || '8451562432';
checkProcessedGame(gameId);