// Simple approach to debug Pick'em data structure without Firebase Admin SDK
// This will use client-side Firebase to examine the data structure

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Use the same config as the client app
const firebaseConfig = {
  apiKey: "AIzaSyBaQsO4kLZMvNgBudZ6j9jrFnUL7kAhVs8",
  authDomain: "automatic-tournament.firebaseapp.com", 
  projectId: "automatic-tournament",
  storageBucket: "automatic-tournament.firebasestorage.app",
  messagingSenderId: "556276303296",
  appId: "1:556276303296:web:3df8f5e8216b877e665a73"
};

async function debugPickemData() {
  try {
    console.log('Initializing Firebase client SDK...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('\n=== Fetching Pick\'em Collection ===');
    const pickemsSnapshot = await getDocs(collection(db, 'pickems'));
    
    console.log(`Found ${pickemsSnapshot.size} pick'em documents`);
    
    if (pickemsSnapshot.size > 0) {
      console.log('\n=== Sample Pick\'em Document Structure ===');
      const firstDoc = pickemsSnapshot.docs[0];
      console.log('Document ID:', firstDoc.id);
      console.log('Document data:', JSON.stringify(firstDoc.data(), null, 2));
      
      console.log('\n=== All Pick\'em Document Fields ===');
      pickemsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\nDocument ${index + 1} (ID: ${doc.id}):`);
        console.log('- Fields:', Object.keys(data));
        console.log('- Has champion:', 'champion' in data);
        console.log('- Has runnerUp:', 'runnerUp' in data);
        console.log('- Has thirdPlace:', 'thirdPlace' in data);
        console.log('- Has submittedAt:', 'submittedAt' in data);
        console.log('- Has userId:', 'userId' in data);
      });
    }

    // Also check teams collection for reference
    console.log('\n=== Fetching Teams Collection ===');
    const teamsSnapshot = await getDocs(collection(db, 'teams'));
    console.log(`Found ${teamsSnapshot.size} team documents`);
    
    if (teamsSnapshot.size > 0) {
      console.log('\n=== Sample Team Document ===');
      const firstTeam = teamsSnapshot.docs[0];
      console.log('Team ID:', firstTeam.id);
      console.log('Team data:', JSON.stringify(firstTeam.data(), null, 2));
    }

    console.log('\n=== Debug Complete ===');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugPickemData();