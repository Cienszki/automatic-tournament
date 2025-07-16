// src/lib/admin.ts
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface TournamentStatus {
  roundId: string;
}

/**
 * Fetches the current tournament status from Firestore.
 * @returns A promise that resolves to the tournament status object or null if not found.
 */
export async function getTournamentStatus(): Promise<TournamentStatus | null> {
  const statusDocRef = doc(db, "tournament_status", "current");
  const docSnap = await getDoc(statusDocRef);
  if (docSnap.exists()) {
    return docSnap.data() as TournamentStatus;
  }
  // If the document doesn't exist, create a default one.
  console.warn("Tournament status document not found! Creating a default 'pre_season' status.");
  const defaultStatus: TournamentStatus = { roundId: 'pre_season' };
  await updateDoc(statusDocRef, defaultStatus);
  return defaultStatus;
}

/**
 * Updates the tournament status in Firestore.
 * @param newStatus The new status object to set.
 * @returns A promise that resolves when the update is complete.
 */
export async function updateTournamentStatus(newStatus: Partial<TournamentStatus>): Promise<void> {
  const statusDocRef = doc(db, "tournament_status", "current");
  await updateDoc(statusDocRef, newStatus);
}
