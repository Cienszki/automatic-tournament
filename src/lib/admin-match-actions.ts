import { db } from "./firebase";
import { doc, deleteDoc, setDoc, getDoc } from "firebase/firestore";

// Mark a game as deleted and prevent future sync attempts
export async function deleteGameAndBlockSync(matchId: string, gameId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Delete the game from the games subcollection
    const gameRef = doc(db, "matches", matchId, "games", gameId);
    await deleteDoc(gameRef);

    // Mark this game as blocked for sync in a separate collection
    const blockedRef = doc(db, "blockedGames", `${matchId}_${gameId}`);
    await setDoc(blockedRef, { matchId, gameId, blockedAt: new Date().toISOString() });

    // Optionally, update the match document to remove the gameId from game_ids array
    // (not implemented here, but can be added if needed)

    return { success: true, message: "Game deleted and blocked from future sync." };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

// Check if a game is blocked from sync
export async function isGameBlocked(matchId: string, gameId: string): Promise<boolean> {
  const blockedRef = doc(db, "blockedGames", `${matchId}_${gameId}`);
  const snap = await getDoc(blockedRef);
  return snap.exists();
}
