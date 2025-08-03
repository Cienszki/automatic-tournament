// Quick test to check fantasy data structure
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDvxTgVH39ZCw6UOdxx6TdWTM6NE1vuVa4',
  authDomain: 'tournament-tracker-f35tb.firebaseapp.com',
  projectId: 'tournament-tracker-f35tb',
  storageBucket: 'tournament-tracker-f35tb.firebasestorage.app',
  messagingSenderId: '910618712944',
  appId: '1:910618712944:web:ce571be24bda274cde8db5'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFantasyData() {
  try {
    console.log("Testing fantasy data...");
    
    // Check if there are any fantasy lineups
    const fantasyCol = collection(db, "fantasyLineups");
    const snapshot = await getDocs(fantasyCol);
    
    console.log("Fantasy lineups found:", snapshot.docs.length);
    
    if (snapshot.docs.length > 0) {
      const firstUser = snapshot.docs[0];
      console.log("First user data:", firstUser.data());
      
      // Check tournament status using our fixed function
      const statusDoc = await getDoc(doc(db, "tournament", "status"));
      const statusData = statusDoc.exists() ? statusDoc.data() : null;
      const currentRoundId = statusData?.roundId || statusData?.current || null;
      console.log("Current round ID:", currentRoundId);
      console.log("Status data:", statusData);
      
      if (currentRoundId) {
        // Check if this user has a lineup for the current round
        const lineupRef = doc(db, "fantasyLineups", firstUser.id, "rounds", currentRoundId);
        const lineupSnap = await getDoc(lineupRef);
        
        if (lineupSnap.exists()) {
          console.log("User lineup for round", currentRoundId, ":", lineupSnap.data());
        } else {
          console.log("No lineup found for user", firstUser.id, "in round", currentRoundId);
        }
      }
    }
    
    // Check teams data
    const teamsCol = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCol);
    console.log("Teams found:", teamsSnapshot.docs.length);
    
    if (teamsSnapshot.docs.length > 0) {
      const firstTeam = teamsSnapshot.docs[0];
      console.log("First team data:", firstTeam.data());
      
      // Check players in this team
      const playersCol = collection(db, "teams", firstTeam.id, "players");
      const playersSnapshot = await getDocs(playersCol);
      console.log("Players in first team:", playersSnapshot.docs.length);
      
      if (playersSnapshot.docs.length > 0) {
        console.log("First player data:", playersSnapshot.docs[0].data());
      }
    }
    
  } catch (error) {
    console.error("Error testing fantasy data:", error);
  }
}

testFantasyData();
