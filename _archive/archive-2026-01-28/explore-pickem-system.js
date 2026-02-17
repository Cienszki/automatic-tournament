const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin SDK
function initializeAdmin() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64EncodedServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 not found in environment variables");
  }

  const serviceAccount = JSON.parse(Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8'));
  
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

async function explorePickemSystem() {
  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    const app = initializeAdmin();
    const db = admin.firestore();

    // List all collections
    console.log('📚 Listing all Firestore collections...');
    const collections = await db.listCollections();
    console.log('Available collections:');
    collections.forEach(col => console.log(`  - ${col.id}`));
    console.log('');

    // Let's look for pickem-related collections
    const pickemCollections = collections.filter(col => 
      col.id.toLowerCase().includes('pick') || 
      col.id.toLowerCase().includes('question') ||
      col.id.toLowerCase().includes('match') ||
      col.id.toLowerCase().includes('game')
    );

    if (pickemCollections.length > 0) {
      console.log('🎯 Found potential pick\'em related collections:');
      pickemCollections.forEach(col => console.log(`  - ${col.id}`));
      console.log('');
    }

    // Check if there are any documents that might contain the questions/matches
    console.log('🔍 Looking for pickem questions or matches collection...');
    
    // Try common collection names
    const potentialCollections = ['pickemQuestions', 'questions', 'matches', 'pickemMatches', 'gameQuestions'];
    
    for (const collectionName of potentialCollections) {
      try {
        const snap = await db.collection(collectionName).limit(1).get();
        if (!snap.empty) {
          console.log(`✅ Found collection: ${collectionName}`);
          const doc = snap.docs[0];
          console.log(`   Sample document ID: ${doc.id}`);
          console.log(`   Sample data:`, JSON.stringify(doc.data(), null, 2));
          console.log('');
        }
      } catch (e) {
        // Collection doesn't exist, continue
      }
    }

    // Let's also check what one of those score IDs might reference
    console.log('🎲 Checking if score IDs reference documents in other collections...');
    const sampleScoreId = 'sWEfGOW9ZLezKBJhsFGV'; // From the first document
    
    // Try to find this ID in various collections
    for (const collection of collections) {
      try {
        const doc = await db.collection(collection.id).doc(sampleScoreId).get();
        if (doc.exists) {
          console.log(`🎯 Found score ID ${sampleScoreId} in collection: ${collection.id}`);
          console.log(`   Data:`, JSON.stringify(doc.data(), null, 2));
          console.log('');
        }
      } catch (e) {
        // Continue silently
      }
    }

    // Let's see if we can find any documents in the teams collection that might help
    console.log('🏆 Examining teams collection for context...');
    const teamsSnap = await db.collection('teams').limit(5).get();
    teamsSnap.forEach(doc => {
      console.log(`Team ${doc.id}:`, doc.data());
    });

  } catch (error) {
    console.error('❌ Exploration failed:', error);
    process.exit(1);
  }
}

// Run the exploration
explorePickemSystem()
  .then(() => {
    console.log('🎉 Exploration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });