// src/lib/team.ts
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "./firebase";
import type { Team } from "./definitions";

/**
 * Checks if a user is a captain of any team and returns that team's ID.
 * @param userId The ID of the user.
 * @returns The ID of the team the user is captain of, or null if they are not a captain.
 */
export async function getUserTeam(userId: string): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const teamsRef = collection(db, "teams");
  const q = query(teamsRef, where("captainId", "==", userId), limit(1));

  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      // Return the ID of the first team found
      return querySnapshot.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error getting user team:", error);
    return null;
  }
}
