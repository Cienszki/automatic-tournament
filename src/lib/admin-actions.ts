// src/lib/admin-actions.ts
"use server";

import { adminDb } from './admin'; // Import the correctly initialized adminDb

/**
 * Updates the tournament status in a dedicated document.
 * @param {string} status - The new status to set.
 */
export async function updateTournamentStatus(status: string) {
  try {
    const settingsRef = adminDb.collection('settings').doc('tournament');
    await settingsRef.set({
      status: status,
      updatedAt: new Date(),
    }, { merge: true });
    console.log(`Tournament status updated to: ${status}`);
    return { success: true, message: `Status updated to ${status}` };
  } catch (error) {
    console.error("Error updating tournament status:", error);
    return { success: false, message: "Failed to update status." };
  }
}
