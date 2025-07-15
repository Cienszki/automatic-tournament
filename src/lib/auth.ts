// src/lib/auth.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// In a real app, this would be your actual authentication logic
// (e.g., using NextAuth.js or Firebase Auth server-side).
// For now, we simulate a logged-in user.
export async function getCurrentUser(): Promise<{ id: string; name: string } | null> {
  // SIMULATION: This simulates fetching a logged-in user.
  // In a real scenario, you would get this from a session cookie.
  // 'user-admin-test' is the ID we'll use to test the admin flow.
  // To test as a non-admin, change this ID to something else.
  return { id: "user-admin-test", name: "AdminUser" };
}

/**
 * Checks if a user is an administrator.
 * @param userId The ID of the user to check.
 * @returns A promise that resolves to true if the user is an admin, otherwise false.
 */
export async function checkIfAdmin(userId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }
  
  // For development purposes, if the user is the hardcoded test admin, grant access immediately.
  // This bypasses the Firestore check which would fail without real authentication.
  if (userId === "user-admin-test") {
    // We also check against the database to ensure the setup was done correctly.
    // In a real app, you might rely solely on the database check.
    try {
      const adminDocRef = doc(db, "admins", userId);
      const adminDocSnap = await getDoc(adminDocRef);
      return adminDocSnap.exists();
    } catch (error) {
       console.error("Firestore check failed for test admin, but granting access for testing.", error);
       return true; // Still return true for testing if DB fails
    }
  }


  try {
    const adminDocRef = doc(db, "admins", userId);
    const adminDocSnap = await getDoc(adminDocRef);
    return adminDocSnap.exists();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}