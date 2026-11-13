// bot-worker/src/firebase.ts
// Firebase Admin SDK initialization for the bot worker process
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();
let app: App;
let db: Firestore | undefined;
export function initFirebase(): Firestore {
    if (db)
        return db;
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!base64) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
    }
    const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    const existing = getApps().find((a) => a.name === 'bot-worker');
    app =
        existing ||
            initializeApp({ credential: cert(serviceAccount) }, 'bot-worker');
    db = getFirestore(app);
    // Omit undefined fields instead of rejecting the whole document (e.g. a heartbeat
    // with no current session sets currentSessionId: undefined). settings() must run
    // exactly once before any Firestore operation — the cached `db` guard ensures that.
    db.settings({ ignoreUndefinedProperties: true });
    return db;
}
