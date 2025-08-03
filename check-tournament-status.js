// Check tournament status
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

async function checkTournamentStatus() {
  try {
    const statusDoc = await getDoc(doc(db, "tournament", "status"));
    console.log("Tournament status document exists:", statusDoc.exists());
    
    if (statusDoc.exists()) {
      console.log("Tournament status data:", statusDoc.data());
    } else {
      console.log("Creating tournament status document with initial round...");
      await setDoc(doc(db, "tournament", "status"), {
        roundId: 'initial',
        status: 'registration'
      });
      console.log("Tournament status document created");
    }
  } catch (error) {
    console.error("Error checking tournament status:", error);
  }
}

checkTournamentStatus();
