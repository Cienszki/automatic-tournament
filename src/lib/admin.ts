
import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';
import 'server-only';

let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;
let adminStorage: Storage;
let _adminInitialized = false;

function initializeAdmin() {
  if (_adminInitialized) {
    return;
  }

  const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64EncodedServiceAccount || base64EncodedServiceAccount.length <= 1) {
    console.warn("FIREBASE_SERVICE_ACCOUNT_BASE64 env variable not found. Admin features will be disabled.");
    return;
  }
  
  try {
    const serviceAccount = JSON.parse(Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8'));
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    const appConfig = {
      credential: cert(serviceAccount),
      storageBucket: storageBucket,
    };

    adminApp = !getApps().length ? initializeApp(appConfig) : getApp();
    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    adminStorage = getStorage(adminApp);
    _adminInitialized = true;
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", error);
    _adminInitialized = false;
  }
}

// These functions ensure the admin SDK is only initialized once.
export function ensureAdminInitialized() {
    initializeAdmin();
}

export function isAdminInitialized() {
    return _adminInitialized;
}

// Call initialization logic when the module is loaded.
initializeAdmin();

export { adminApp, adminDb, adminAuth, adminStorage };
