
import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import 'server-only';

// Get the Base64 encoded service account from environment variables
const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!base64EncodedServiceAccount) {
  throw new Error('The FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set. Please add it to your .env.local file.');
}

// Decode the Base64 string back to a JSON string
const decodedServiceAccount = Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8');

// Parse the JSON string into a service account object
const serviceAccount = JSON.parse(decodedServiceAccount);

// Get the storage bucket from environment variables
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
if (!storageBucket) {
    throw new Error('The NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set.');
}

// Initialize the Firebase Admin App
const app: App = !getApps().length
  ? initializeApp({ 
      credential: cert(serviceAccount),
      storageBucket: storageBucket 
    })
  : getApp();

const adminDb: Firestore = getFirestore(app);
const adminStorage: Storage = getStorage(app);

export { adminDb, adminStorage };
