// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// Check if the service account JSON is available in the environment variables
if (!process.env.SERVICE_ACCOUNT_KEY_JSON) {
  throw new Error('The SERVICE_ACCOUNT_KEY_JSON environment variable is not set.');
}

// Parse the service account key from the environment variable
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);

// Initialize the Firebase Admin SDK if it hasn't been already
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
