
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { type User } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export interface TournamentStatus {
  roundId: string;
  // You can add other relevant fields here, e.g.,
  // stage: 'groups' | 'playoffs' | 'finished';
  // currentMatch: number;
}

/**
 * Checks if a user is an administrator by calling a Firebase Cloud Function.
 * @param user The Firebase User object.
 * @returns A promise that resolves to true if the user is an admin, otherwise false.
 */
export async function checkIfAdmin(user: User | null): Promise<boolean> {
  if (!user) {
    return false;
  }

  try {
    const functions = getFunctions();
    const checkAdminStatus = httpsCallable(functions, 'checkAdminStatus');
    const result = await checkAdminStatus();
    return (result.data as { isAdmin: boolean }).isAdmin;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}


/**
 * Retrieves the current status of the tournament from Firestore.
 * This function handles legacy data structures by checking for 'current' and mapping it to 'roundId'.
 * @returns A promise that resolves to the tournament status object if it exists, otherwise null.
 */
export async function getTournamentStatus(): Promise<TournamentStatus | null> {
  const statusDocRef = doc(db, "tournament", "status");
  try {
    const statusDocSnap = await getDoc(statusDocRef);
    if (statusDocSnap.exists()) {
      const data = statusDocSnap.data() as any; // Read data with any type
      // Check for legacy 'current' field and map to 'roundId'
      if (data.current && !data.roundId) {
        return { roundId: data.current };
      }
      return data as TournamentStatus;
    } else {
      // Return null if the document does not exist. The UI will handle this.
      return null;
    }
  } catch (error) {
    console.error("Error getting tournament status:", error);
    // Return null on error as well, so the UI can display an error message.
    return null;
  }
}

/**
 * Creates or updates the tournament status in Firestore.
 * @param newStatus The new status object to set.
 * @returns A promise that resolves to true if the update was successful, otherwise false.
 */
export async function updateTournamentStatus(newStatus: Partial<TournamentStatus>): Promise<boolean> {
  try {
    const statusDocRef = doc(db, "tournament", "status");
    // Use set with merge:true to create the document if it doesn't exist or update it if it does.
    await setDoc(statusDocRef, newStatus, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating tournament status:", error);
    return false;
  }
}
