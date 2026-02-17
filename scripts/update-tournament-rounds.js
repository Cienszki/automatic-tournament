// Update PDL tournament configuration
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

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

async function updateTournamentConfig() {
  try {
    const tournamentRef = doc(db, 'tournaments', 'pdl-s1');
    
    await updateDoc(tournamentRef, {
      roundsPerSeason: 1,
      currentRound: 1
    });

    console.log('✅ Updated tournament configuration:');
    console.log('  - roundsPerSeason: 1');
    console.log('  - currentRound: 1');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateTournamentConfig();
