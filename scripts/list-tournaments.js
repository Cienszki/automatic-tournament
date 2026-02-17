// List all tournaments
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBzQ0o9VPTKsj4JiKKvJqTlr3hRqZCdslY",
  authDomain: "tournament-tracker-f35tb.firebaseapp.com",
  projectId: "tournament-tracker-f35tb",
  storageBucket: "tournament-tracker-f35tb.firebasestorage.app",
  messagingSenderId: "598690043336",
  appId: "1:598690043336:web:7d38ede22ec13e4f5a97a9",
  measurementId: "G-RLGZV2GFGE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listTournaments() {
  try {
    const tournamentsRef = collection(db, 'tournaments');
    const snapshot = await getDocs(tournamentsRef);

    console.log(`\n📋 Found ${snapshot.size} tournaments:\n`);

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Slug: ${data.slug}`);
      console.log(`  Type: ${data.type}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Current Round: ${data.currentRound || 'not set'}`);
      console.log(`  Rounds Per Season: ${data.roundsPerSeason || 'not set'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

listTournaments();
