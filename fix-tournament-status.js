// Fix tournament status to use correct field name
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

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

async function fixTournamentStatus() {
  try {
    console.log("Updating tournament status to use 'roundId' field...");
    await updateDoc(doc(db, "tournament", "status"), {
      roundId: 'initial'
    });
    console.log("Tournament status updated successfully");
  } catch (error) {
    console.error("Error updating tournament status:", error);
  }
}

fixTournamentStatus();
