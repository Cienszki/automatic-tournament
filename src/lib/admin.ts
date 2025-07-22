
import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import 'server-only';

let adminDb: Firestore;
let adminStorage: Storage;
let adminInitialized = false;
let isInitializing = false;

// This function will be called on-demand and has a timeout.
async function initializeAdmin() {
  if (adminInitialized) return;
  if (isInitializing) {
    // Avoid concurrent initializations
    await new Promise(resolve => setTimeout(resolve, 1000));
    return;
  }
  isInitializing = true;

  try {
    const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (base64EncodedServiceAccount && base64EncodedServiceAccount.length > 1) {
      const decodedServiceAccount = Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decodedServiceAccount);
      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

      if (!storageBucket) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set.');

      const appConfig = {
        credential: cert(serviceAccount),
        storageBucket: storageBucket 
      };

      const app: App = !getApps().length ? initializeApp(appConfig) : getApp();

      adminDb = getFirestore(app);
      adminStorage = getStorage(app);
      adminInitialized = true;
      console.log("Firebase Admin SDK initialized successfully.");
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT_BASE64 env variable not found. Admin features will be disabled.");
    }
  } catch (error) {
    console.error("CRITICAL: Failed to initialize Firebase Admin SDK. Admin features will be disabled.", error);
  } finally {
    isInitializing = false;
  }
}

// This is the only function that server actions should call.
export const ensureAdminInitialized = async () => {
    if (adminInitialized) return;

    // Race the initialization against a timeout.
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Firebase Admin SDK initialization timed out after 5 seconds.")), 5000)
    );
    
    try {
        await Promise.race([initializeAdmin(), timeoutPromise]);
    } catch (error) {
        console.error(error); // Log the timeout error
        adminInitialized = false; // Ensure it's marked as not initialized
    }
};

export const isAdminInitialized = () => adminInitialized;
export { adminDb, adminStorage };
