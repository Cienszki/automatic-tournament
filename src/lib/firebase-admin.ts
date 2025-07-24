
// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

if (!process.env.APP_FIREBASE_SERVICE_ACCOUNT_BASE64) {
  throw new Error('The APP_FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set.');
}

const serviceAccount = JSON.parse(
    Buffer.from(process.env.APP_FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
);

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
