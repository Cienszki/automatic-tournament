// src/lib/auth.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { type User } from "firebase/auth";

// This function is now deprecated as we use a real-time auth context.
// It's kept here for reference but should not be used for new features.
export async function getCurrentUser_DEPRECATED(): Promise<{ id: string; name: string } | null> {
  // SIMULATION: This function is no longer in use with real authentication.
  return null;
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
