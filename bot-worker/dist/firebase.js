"use strict";
// bot-worker/src/firebase.ts
// Firebase Admin SDK initialization for the bot worker process
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFirebase = initFirebase;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let app;
function initFirebase() {
    if (app)
        return (0, firestore_1.getFirestore)(app);
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!base64) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
    }
    const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    const existing = (0, app_1.getApps)().find((a) => a.name === 'bot-worker');
    app =
        existing ||
            (0, app_1.initializeApp)({ credential: (0, app_1.cert)(serviceAccount) }, 'bot-worker');
    return (0, firestore_1.getFirestore)(app);
}
