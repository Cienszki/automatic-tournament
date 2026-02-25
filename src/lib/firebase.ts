
import { initializeApp, getApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";

// These are guaranteed to be present at runtime because next.config.ts validates
// them at build time. The non-null assertions (!) are therefore safe.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

if (typeof window !== 'undefined') {
  // Client-side: initialize Firebase normally.
  // If this throws, it means env vars are missing or malformed — the build
  // should have caught this already via the check in next.config.ts.
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    auth.tenantId = null;
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app);
  } catch (e) {
    throw new Error(
      `Firebase client initialization failed. Ensure all NEXT_PUBLIC_FIREBASE_* env vars are set.\nCause: ${e}`
    );
  }
} else {
  // Server-side (SSR pass of "use client" components): return typed stubs so
  // the module resolves without error. Real Firebase calls only happen in the
  // browser where window is defined. Server-side data access must use
  // src/server/lib/admin.ts instead.
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
  functions = {} as Functions;
}

export { app, auth, db, storage, functions };

/** Returns true only when the Firebase client SDK is fully initialised (browser only). */
export function isFirebaseInitialized(): boolean {
  return typeof window !== 'undefined' && getApps().length > 0;
}
