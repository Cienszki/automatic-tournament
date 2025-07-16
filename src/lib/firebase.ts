
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app); 
const auth = getAuth(app);
const storage = getStorage(app);

/**
 * Uploads a screenshot file to Firebase Storage.
 * 
 * @param file The file to upload.
 * @param teamName The name of the team, used for organizing files.
 * @param playerNickname The nickname of the player, for file naming.
 * @returns A promise that resolves to the public URL of the uploaded file.
 */
export async function uploadScreenshot(file: File, teamName: string, playerNickname: string): Promise<string> {
    if (!file) {
        throw new Error("No file provided for upload.");
    }

    const fileExtension = file.name.split('.').pop();
    // Create a unique, sanitized filename
    const fileName = `${playerNickname.replace(/[^a-zA-Z0-9]/g, '_')}-${uuidv4()}`;
    
    // Create a storage reference with a structured path
    const storageRef = ref(storage, `screenshots/${teamName.replace(/[^a-zA-Z0-9]/g, '_')}/${fileName}`);
    
    // Upload the file
    await uploadBytes(storageRef, file);
    
    // Get the public download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
}

export { app, db, auth, storage };
