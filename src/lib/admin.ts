
// src/lib/admin.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { type User } from "firebase/auth";

export interface TournamentStatus {
  roundId: string;
  // You can add other relevant fields here, e.g.,
  // stage: 'groups' | 'playoffs' | 'finished';
  // currentMatch: number;
}

/**
 * Checks if a user is an administrator by checking their UID against the 'admins' collection.
 * @param user The Firebase User object.
 * @returns A promise that resolves to true if the user is an admin, otherwise false.
 */
export async function checkIfAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.uid) {
    return false;
  }
  
  try {
    const adminDocRef = doc(db, "admins", user.uid);
    const adminDocSnap = await getDoc(adminDocRef);
    return adminDocSnap.exists();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Retrieves the current status of the tournament from Firestore.
 * Fetches the document 'status' from the 'tournament' collection.
 * @returns A promise that resolves to the tournament status object, or a default if not found.
 */
export async function getTournamentStatus(): Promise<TournamentStatus | null> {
  try {
    const statusDocRef = doc(db, "tournament", "status");
    const statusDocSnap = await getDoc(statusDocRef);
    if (statusDocSnap.exists()) {
      return statusDocSnap.data() as TournamentStatus;
    } else {
      console.log("Tournament status document not found, returning default.");
      // Return a default status if the document doesn't exist yet
      return { roundId: 'initial' };
    }
  } catch (error) {
    console.error("Error getting tournament status:", error);
    return null;
  }
}

/**
 * Updates the tournament status in Firestore.
 * @param newStatus The new status object to set.
 * @returns A promise that resolves to true if the update was successful, otherwise false.
 */
export async function updateTournamentStatus(newStatus: Partial<TournamentStatus>): Promise<boolean> {
  try {
    const statusDocRef = doc(db, "tournament", "status");
    await setDoc(statusDocRef, newStatus, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating tournament status:", error);
    return false;
  }
}
