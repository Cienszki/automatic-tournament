
"use server";

import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- More robust admin app initialization with detailed logging ---
const ADMIN_APP_NAME = "firebase-admin-app-2"; // Using a new name to be safe

let adminDb;

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

export { adminDb };
