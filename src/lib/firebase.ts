
import { initializeApp, getApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Debug: log missing environment variables
if (typeof window !== 'undefined') {
  const missingVars = Object.entries(firebaseConfig)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missingVars.length > 0) {
    console.error('Missing Firebase environment variables:', missingVars);
  }
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

try {
    // Only initialize if we're in the browser and have the required config
    if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        auth.tenantId = null; 
        db = getFirestore(app);
        storage = getStorage(app);
        functions = getFunctions(app);
        console.log("Firebase initialized successfully");
    } else {
        // Create placeholder objects for server-side rendering
        console.warn("Firebase not initialized - running in server environment or missing config");
        app = {} as FirebaseApp;
        auth = {} as Auth;
        db = {} as Firestore;
        storage = {} as FirebaseStorage;
        functions = {} as Functions;
    }
} catch (e) {
    console.error("Firebase initialization error:", e);
    // Create placeholder objects
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
    functions = {} as Functions;
}

export { app, auth, db, storage, functions };

// Helper function to check if Firebase is properly initialized
export function isFirebaseInitialized(): boolean {
  return (
    typeof window !== 'undefined' && 
    db && 
    typeof db === 'object' && 
    '_delegate' in db
  );
}
