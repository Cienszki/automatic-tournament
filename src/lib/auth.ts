
// src/lib/auth.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { type User } from "firebase/auth";
import { functions } from './firebase'; // Make sure functions is exported from firebase.ts
import { httpsCallable } from 'firebase/functions';

/**
 * Checks if a user is an administrator by calling a Cloud Function.
 * This is the secure way to check for admin privileges.
 *
 * @param user The Firebase user object.
 * @returns A promise that resolves to true if the user is an admin, otherwise false.
 */
export async function checkIfAdmin(user: User): Promise<boolean> {
  if (!user) return false;

  try {
    // Ensure the user's ID token is refreshed before calling the function.
    await user.getIdToken(true); 

    const checkAdminStatus = httpsCallable(functions, 'checkAdminStatus');
    const result = await checkAdminStatus();
    
    // The callable function returns an object with a 'data' property.
    const { isAdmin } = result.data as { isAdmin: boolean };
    return isAdmin;

  } catch (error) {
    console.error("Error calling checkAdminStatus function:", error);
    // In case of any error (e.g., network, function not found), default to not being an admin.
    return false;
  }
}
