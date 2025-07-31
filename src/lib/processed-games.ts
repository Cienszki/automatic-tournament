import { db } from "./firebase";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

// Save a processed external match/game ID
export async function markGameAsProcessed(externalMatchId: string) {
  const ref = doc(db, "processedGames", externalMatchId);
  await setDoc(ref, { processedAt: new Date().toISOString() });
}

// Check if a match/game has already been processed
export async function isGameProcessed(externalMatchId: string): Promise<boolean> {
  const ref = doc(db, "processedGames", externalMatchId);
  const snap = await getDoc(ref);
  return snap.exists();
}

// Get all processed match/game IDs
export async function getAllProcessedGameIds(): Promise<string[]> {
  const col = collection(db, "processedGames");
  const snap = await getDocs(col);
  return snap.docs.map(doc => doc.id);
}
