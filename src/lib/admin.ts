
import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';
import 'server-only';

let adminApp: App;
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

export function getAdminDb(): Firestore {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized");
    return getFirestore(adminApp);
}

export function getAdminAuth(): Auth {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized");
    return getAuth(adminApp);
}

export function getAdminStorage(): Storage {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized");
    return getStorage(adminApp);
}

export function getAdminApp(): App {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized");
    return adminApp;
}
