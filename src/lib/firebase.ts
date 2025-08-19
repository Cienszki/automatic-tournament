
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
  } else {
    console.log('All Firebase environment variables are present');
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
        console.log('Initializing Firebase...');
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        auth.tenantId = null; 
        db = getFirestore(app);
        storage = getStorage(app);
        functions = getFunctions(app);
        console.log("Firebase initialized successfully");
        console.log('Firebase apps:', getApps().length);
    } else {
        // Create placeholder objects for server-side rendering
        console.warn("Firebase not initialized - running in server environment or missing config");
        console.warn('Window available:', typeof window !== 'undefined');
        console.warn('API Key available:', !!firebaseConfig.apiKey);
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
  try {
    const windowAvailable = typeof window !== 'undefined';
    const appExists = !!app && typeof app === 'object';
    const dbExists = !!db && typeof db === 'object';
    const configValid = !!firebaseConfig.apiKey;
    const appsLength = getApps().length > 0;
    
    const result = windowAvailable && appExists && dbExists && configValid && appsLength;
    
    if (!result) {
      console.debug('Firebase initialization check failed:', {
        windowAvailable,
        appExists,
        dbExists,
        configValid,
        appsLength
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error checking Firebase initialization:', error);
    return false;
  }
}
