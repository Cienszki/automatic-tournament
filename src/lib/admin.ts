// This file is intentionally left blank. All admin logic is now in server/lib/admin.ts. Import from '../../server/lib/admin' instead.

import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';
import 'server-only';
import dotenv from 'dotenv';

dotenv.config();

let adminApp: App | undefined;
let _adminInitialized = false;

function initializeAdmin() {
  if (_adminInitialized && adminApp) {
    return;
  }

  const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64EncodedServiceAccount || base64EncodedServiceAccount.length <= 1) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 env variable is not set. Admin features will be disabled.");
  }
  
  try {
    const serviceAccount = JSON.parse(Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8'));
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    const appName = 'firebase-admin-app';
    const existingApp = getApps().find(app => app.name === appName);

    adminApp = existingApp || initializeApp({
      credential: cert(serviceAccount),
      storageBucket: storageBucket,
    }, appName);

    _adminInitialized = true;
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", error);
    _adminInitialized = false;
    adminApp = undefined;
    throw error;
  }
}

export function ensureAdminInitialized() {
    initializeAdmin();
}

export function isAdminInitialized() {
    return _adminInitialized && !!adminApp;
}

export function getAdminDb(): Firestore {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized. Check server logs for details.");
    return getFirestore(adminApp);
}

export function getAdminAuth(): Auth {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized. Check server logs for details.");
    return getAuth(adminApp);
}

export function getAdminStorage(): Storage {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized. Check server logs for details.");
    return getStorage(adminApp);
}

export function getAdminApp(): App {
    ensureAdminInitialized();
    if (!adminApp) throw new Error("Admin App not initialized. Check server logs for details.");
    return adminApp;
}