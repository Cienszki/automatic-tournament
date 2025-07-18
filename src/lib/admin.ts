
// src/lib/admin.ts
"use server";

import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { DocumentData } from 'firebase-admin/firestore';

// --- More robust admin app initialization with detailed logging ---
const ADMIN_APP_NAME = "firebase-admin-app-2"; // Using a new name to be safe

let adminDb: ReturnType<typeof getFirestore>;

try {
  console.log("Attempting to initialize Firebase Admin SDK...");

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountString) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set.");
  }
  console.log("Service account environment variable found.");

  const serviceAccount = JSON.parse(serviceAccountString);

  const adminApp = getApps().find(app => app.name === ADMIN_APP_NAME)
    ? getApp(ADMIN_APP_NAME)
    : initializeApp({
        credential: cert(serviceAccount),
      }, ADMIN_APP_NAME);

  console.log("Firebase Admin App initialized successfully:", adminApp.name);

  adminDb = getFirestore(adminApp);
  console.log("Firestore for admin app obtained successfully.");

} catch (error) {
  console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", error);
  // We're throwing the error here to make it clear that the server-side functions will not work.
  // This will prevent the application from continuing with a broken admin setup.
  throw new Error("Could not initialize Firebase Admin SDK. Check server logs for details.");
}

export type TournamentStatus = {
  roundId: string;
};

/**
 * Fetches the current tournament status from Firestore.
 * This is a server-side function.
 */
export async function getTournamentStatus(): Promise<TournamentStatus | null> {
  try {
    const statusDocRef = adminDb.collection('tournament').doc('status');
    const statusDocSnap = await statusDocRef.get();

    if (statusDocSnap.exists) {
      return statusDocSnap.data() as TournamentStatus;
    }
    // If the document doesn't exist, return a default initial state or null.
    return null;
  } catch (error) {
    console.error("Error fetching tournament status:", error);
    // In case of an error, it's safer to return null and handle it in the UI.
    return null;
  }
}

/**
 * Updates the tournament status document.
 * @param newStatus - The new status object to set.
 * @returns An object indicating success or failure.
 */
export async function updateTournamentStatus(newStatus: Partial<TournamentStatus>): Promise<boolean> {
    try {
        const statusDocRef = adminDb.collection('tournament').doc('status');
        await statusDocRef.set(newStatus, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating tournament status:", error);
        return false;
    }
}


export { adminDb };
