
"use strict";

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize the Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Checks if a user is an administrator.
 *
 * This function is callable from the client-side. It expects an authenticated
 * user context.
 */
export const checkAdminStatus = onCall(
  {region: "us-central1"},
  async (request) => {
    // Ensure the user is authenticated.
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    const uid = request.auth.uid;

    try {
      const adminDocRef = db.collection("admins").doc(uid);
      const adminDocSnap = await adminDocRef.get();

      return {isAdmin: adminDocSnap.exists};
    } catch (error) {
      logger.error("Error checking admin status:", error);
      // It's safer to return false in case of an error.
      return {isAdmin: false};
    }
  },
);
