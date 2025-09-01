import { getAdminDb, ensureAdminInitialized } from '../server/lib/admin';

export interface UnparsedMatch {
  matchId: string;
  openDotaMatchId: string;
  radiantTeam: string;
  direTeam: string;
  gameNumber: string;
  createdAt: string;
  lastAttemptAt?: string;
  attemptCount: number;
}

// Save an unparsed match for later retry
export async function addUnparsedMatchAdmin(unparsedMatch: Omit<UnparsedMatch, 'createdAt' | 'attemptCount'>): Promise<void> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const ref = db.collection("unparsedMatches").doc(unparsedMatch.openDotaMatchId);
  await ref.set({
    ...unparsedMatch,
    createdAt: new Date().toISOString(),
    attemptCount: 0
  });
}

// Get all unparsed matches that need retry
export async function getAllUnparsedMatchesAdmin(): Promise<UnparsedMatch[]> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const col = db.collection("unparsedMatches");
  const snap = await col.get();
  return snap.docs.map(doc => ({ ...doc.data(), openDotaMatchId: doc.id } as UnparsedMatch));
}

// Remove a match from unparsed list (when it gets successfully parsed)
export async function removeUnparsedMatchAdmin(openDotaMatchId: string): Promise<void> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const ref = db.collection("unparsedMatches").doc(openDotaMatchId);
  await ref.delete();
}

// Update attempt count for an unparsed match
export async function updateUnparsedMatchAttemptAdmin(openDotaMatchId: string): Promise<void> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const ref = db.collection("unparsedMatches").doc(openDotaMatchId);
  await ref.update({
    lastAttemptAt: new Date().toISOString(),
    attemptCount: require('firebase-admin/firestore').FieldValue.increment(1)
  });
}

// Check if a specific match is in the unparsed list
export async function isMatchUnparsedAdmin(openDotaMatchId: string): Promise<boolean> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const ref = db.collection("unparsedMatches").doc(openDotaMatchId);
  const snap = await ref.get();
  return snap.exists;
}