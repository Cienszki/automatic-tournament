import { db } from "./firebase";
import { doc, deleteDoc, setDoc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { updateStandingsAfterGame } from "./group-actions";
import type { Match } from "./definitions";

// Delete a game, block it from sync, and update match/game_ids and standings
export async function adminDeleteGameAndHandleScore(match: Match, gameId: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Delete the game from the games subcollection
    const gameRef = doc(db, "matches", match.id, "games", gameId);
    await deleteDoc(gameRef);

    // 2. Mark this game as blocked for sync
    const blockedRef = doc(db, "blockedGames", `${match.id}_${gameId}`);
    await setDoc(blockedRef, { matchId: match.id, gameId, blockedAt: new Date().toISOString() });

    // 3. Remove the gameId from the match's game_ids array
    const matchRef = doc(db, "matches", match.id);
    await updateDoc(matchRef, { game_ids: arrayRemove(Number(gameId)) });

    // 4. Optionally, update the match score if needed (e.g., recalculate from remaining games)
    // For now, set both team scores to 0 (or recalculate if you want)
    await updateDoc(matchRef, { "teamA.score": 0, "teamB.score": 0 });

    // 5. Optionally, update group standings
    await updateStandingsAfterGame({ ...match, teamA: { ...match.teamA, score: 0 }, teamB: { ...match.teamB, score: 0 } });

    return { success: true, message: "Game deleted, blocked from sync, and scores/standings updated." };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
