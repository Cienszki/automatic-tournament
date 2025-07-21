
import { initializeApp, getApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize App Check
if (typeof window !== 'undefined') {
  // Add this line to log a debug token to the console.
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;

  const recaptchaKey = process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_KEY;
  console.log("Recaptcha Key:", recaptchaKey ? "Loaded" : "Not Found"); // Log if the key is loaded

  if (recaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    console.warn("Firebase reCAPTCHA key not found. App Check will not be initialized.");
  }
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);

export { app, auth, db, storage, functions };
