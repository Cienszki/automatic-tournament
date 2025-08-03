import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';

// Admin version: Save a processed external match/game ID
export async function markGameAsProcessedAdmin(externalMatchId: string) {
  ensureAdminInitialized();
  const db = getAdminDb();
  const ref = db.collection("processedGames").doc(externalMatchId);
  await ref.set({ processedAt: new Date().toISOString() });
}

// Admin version: Check if a match/game has already been processed
export async function isGameProcessedAdmin(externalMatchId: string): Promise<boolean> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const ref = db.collection("processedGames").doc(externalMatchId);
  const snap = await ref.get();
  return snap.exists;
}

// Admin version: Get all processed match/game IDs
export async function getAllProcessedGameIdsAdmin(): Promise<string[]> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const col = db.collection("processedGames");
  const snap = await col.get();
  return snap.docs.map(doc => doc.id);
}

// Admin version: Clear all processed games
export async function clearAllProcessedGamesAdmin(): Promise<void> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const col = db.collection("processedGames");
  const snap = await col.get();
  
  // Delete all documents in batches
  const batch = db.batch();
  snap.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}
