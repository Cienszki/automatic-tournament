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

async function debugPickemStructure() {
  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    const app = initializeAdmin();
    const db = admin.firestore();

    console.log('📊 Fetching first few pickem documents...');
    const pickemsSnap = await db.collection('pickems').limit(3).get();

    console.log(`Found ${pickemsSnap.docs.length} sample documents`);
    console.log('');

    pickemsSnap.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`📄 Document ${index + 1} (ID: ${doc.id}):`);
      console.log('   Keys:', Object.keys(data));
      console.log('   Full data structure:');
      console.log(JSON.stringify(data, null, 2));
      console.log('   Raw predictions field type:', typeof data.predictions);
      console.log('   Raw predictions content:', data.predictions);
      console.log('');
      console.log('---'.repeat(20));
      console.log('');
    });

    // Also check if there are any collections inside the pickems documents
    const firstDoc = pickemsSnap.docs[0];
    if (firstDoc) {
      console.log('🔍 Checking for subcollections in first document...');
      const collections = await firstDoc.ref.listCollections();
      console.log('   Subcollections:', collections.map(c => c.id));
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

// Run the debug
debugPickemStructure()
  .then(() => {
    console.log('🎉 Debug completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });