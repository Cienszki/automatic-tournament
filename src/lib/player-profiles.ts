/**
 * Global Player Profiles Service
 *
 * Players are stored in a top-level `/players/{steamId64}` collection
 * keyed by their 64-bit Steam ID. This keeps player identity stable
 * across tournaments — even when a player is transferred out of a team,
 * their profile persists and can be referenced by match history.
 *
 * Team roster entries (under /tournaments/{id}/teams/{id}/players/{docId})
 * store a `steamId` pointer to this global collection plus tournament-
 * specific data (role, mmr).
 */

import type { PlayerRole } from './definitions';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Global player profile stored at `/players/{steamId64}`.
 * Contains only identity & display data — no tournament-specific fields.
 */
export interface GlobalPlayerProfile {
  /** 64-bit Steam ID (also the document ID) */
  steamId: string;
  /** 32-bit Steam ID (= OpenDota account_id) */
  steamId32: string;
  /** Current display nickname */
  nickname: string;
  /** Steam community profile URL */
  steamProfileUrl: string;
  /** Small avatar */
  avatar: string;
  /** Medium avatar (184px) */
  avatarmedium: string;
  /** Full avatar (184px+) */
  avatarfull: string;
  /** ISO timestamp of when the profile was first created */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /**
   * The team this player is currently registered for in an active tournament.
   * Set when registered / transferred in. Cleared (null) when transferred out.
   */
  currentTeam?: {
    tournamentId: string;
    teamId: string;
    teamName: string;
    teamTag?: string;
    role: PlayerRole;
  } | null;
}

/**
 * Pointer stored in a team's player subcollection.
 * Only identity data lives here — full profile is in `/players/{steamId}`.
 */
export interface TeamPlayerRef {
  /** Firestore document ID = steamId64 */
  steamId: string;
  /** 32-bit Steam ID for match resolution */
  steamId32: string;
  /** Player role within this team */
  role: PlayerRole;
}

/**
 * Input data for creating/updating a global player profile.
 */
export interface UpsertPlayerInput {
  steamId: string;
  steamId32: string;
  nickname: string;
  steamProfileUrl: string;
  /** If omitted the function will fetch these from the Steam API automatically */
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  /**
   * When provided, updates the currentTeam pointer.
   * Pass `null` explicitly to clear it (player transferred out).
   */
  currentTeam?: {
    tournamentId: string;
    teamId: string;
    teamName: string;
    teamTag?: string;
    role: PlayerRole;
  } | null;
}

// ============================================================================
// SERVER-SIDE FUNCTIONS (firebase-admin)
// ============================================================================

/**
 * Fetch fresh avatar URLs from the Steam Web API.
 * Returns undefined if the fetch fails (caller falls back to cached values).
 */
async function fetchSteamAvatars(steamId: string): Promise<{
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
} | undefined> {
  try {
    const { fetchSteamProfile } = await import('./steam-id-utils');
    const profile = await fetchSteamProfile(steamId);
    return {
      avatar: profile.avatar || '',
      avatarmedium: profile.avatarmedium || '',
      avatarfull: profile.avatarfull || '',
    };
  } catch {
    return undefined;
  }
}

/**
 * Upsert a global player profile.
 * Creates the document if it doesn't exist, or updates avatar/nickname
 * if it does. The document ID is the steamId64.
 */
export async function upsertGlobalPlayerProfile(
  input: UpsertPlayerInput
): Promise<void> {
  const { getAdminDb, ensureAdminInitialized } = await import('@/server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const docRef = db.collection('players').doc(input.steamId);
  const snap = await docRef.get();
  const now = new Date().toISOString();

  // Always try to fetch fresh avatars from Steam API.
  // Fall back to the values passed in (or existing stored values) if the call fails.
  const freshAvatars = await fetchSteamAvatars(input.steamId);
  const avatar     = freshAvatars?.avatar     ?? input.avatar     ?? '';
  const avatarmedium = freshAvatars?.avatarmedium ?? input.avatarmedium ?? '';
  const avatarfull  = freshAvatars?.avatarfull  ?? input.avatarfull  ?? '';

  if (snap.exists) {
    const existing = snap.data() as GlobalPlayerProfile;
    const updatePayload: Record<string, unknown> = {
      nickname: input.nickname,
      steamProfileUrl: input.steamProfileUrl || existing.steamProfileUrl,
      avatar:        avatar       || existing.avatar       || '',
      avatarmedium:  avatarmedium || existing.avatarmedium || '',
      avatarfull:    avatarfull   || existing.avatarfull   || '',
      updatedAt: now,
    };
    // Only touch currentTeam when the caller explicitly passes it
    if ('currentTeam' in input) {
      updatePayload.currentTeam = input.currentTeam ?? null;
    }
    await docRef.update(updatePayload);
  } else {
    // Create new profile
    const profile: GlobalPlayerProfile = {
      steamId: input.steamId,
      steamId32: input.steamId32,
      nickname: input.nickname,
      steamProfileUrl: input.steamProfileUrl,
      avatar,
      avatarmedium,
      avatarfull,
      createdAt: now,
      updatedAt: now,
    };
    if ('currentTeam' in input) {
      profile.currentTeam = input.currentTeam ?? null;
    }
    await docRef.set(profile);
  }
}

/**
 * Set (or clear) the `currentTeam` pointer in a global player profile.
 * Pass `null` as `currentTeam` to clear it (i.e. player transferred out).
 */
export async function setPlayerCurrentTeam(
  steamId: string,
  currentTeam: GlobalPlayerProfile['currentTeam']
): Promise<void> {
  const { getAdminDb, ensureAdminInitialized } = await import('@/server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();
  await db.collection('players').doc(steamId).update({
    currentTeam: currentTeam ?? null,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Convenience wrapper — removes the currentTeam pointer for a player
 * who has been transferred out of their team.
 */
export async function clearPlayerCurrentTeam(steamId: string): Promise<void> {
  return setPlayerCurrentTeam(steamId, null);
}

/**
 * Batch upsert multiple global player profiles.
 * Each player document is keyed by steamId64.
 */
export async function batchUpsertGlobalPlayerProfiles(
  players: UpsertPlayerInput[]
): Promise<void> {
  if (players.length === 0) return;

  const { getAdminDb, ensureAdminInitialized } = await import('@/server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const now = new Date().toISOString();

  // Fetch fresh avatars from Steam in parallel for all players.
  // Use allSettled so one failure doesn't abort the whole batch.
  const avatarResults = await Promise.allSettled(
    players.map(p => fetchSteamAvatars(p.steamId))
  );

  const batch = db.batch();

  for (let i = 0; i < players.length; i++) {
    const input = players[i];
    if (!input.steamId) continue;

    const result = avatarResults[i];
    const freshAvatars =
      result.status === 'fulfilled' ? result.value : undefined;

    const avatar      = freshAvatars?.avatar      ?? input.avatar      ?? '';
    const avatarmedium = freshAvatars?.avatarmedium ?? input.avatarmedium ?? '';
    const avatarfull   = freshAvatars?.avatarfull   ?? input.avatarfull   ?? '';

    const docRef = db.collection('players').doc(input.steamId);
    const payload: Record<string, unknown> = {
      steamId: input.steamId,
      steamId32: input.steamId32,
      nickname: input.nickname,
      steamProfileUrl: input.steamProfileUrl,
      avatar,
      avatarmedium,
      avatarfull,
      updatedAt: now,
    };

    // Only write currentTeam when the caller explicitly includes it
    if ('currentTeam' in input) {
      payload.currentTeam = input.currentTeam ?? null;
    }

    // set with merge: creates the doc if new, merges if existing.
    // createdAt is handled in a second pass so we never overwrite it.
    batch.set(docRef, payload, { merge: true });
  }

  await batch.commit();

  // Second pass: set createdAt only for docs that don't have it yet.
  const batch2 = db.batch();
  let needsBatch2 = false;

  for (const input of players) {
    if (!input.steamId) continue;
    const docRef = db.collection('players').doc(input.steamId);
    const snap = await docRef.get();
    if (snap.exists && !snap.data()?.createdAt) {
      batch2.update(docRef, { createdAt: now });
      needsBatch2 = true;
    }
  }

  if (needsBatch2) {
    await batch2.commit();
  }
}

/**
 * Get a global player profile by steamId64.
 */
export async function getGlobalPlayerProfile(
  steamId: string
): Promise<GlobalPlayerProfile | null> {
  const { getAdminDb, ensureAdminInitialized } = await import('@/server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const snap = await db.collection('players').doc(steamId).get();
  if (!snap.exists) return null;
  return snap.data() as GlobalPlayerProfile;
}

/**
 * Get multiple global player profiles by steamId64 array.
 */
export async function getGlobalPlayerProfiles(
  steamIds: string[]
): Promise<Map<string, GlobalPlayerProfile>> {
  const { getAdminDb, ensureAdminInitialized } = await import('@/server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const result = new Map<string, GlobalPlayerProfile>();
  if (steamIds.length === 0) return result;

  // Firestore getAll supports up to 100 docs at a time
  const chunks: string[][] = [];
  for (let i = 0; i < steamIds.length; i += 100) {
    chunks.push(steamIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const refs = chunk.map(id => db.collection('players').doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) {
        result.set(snap.id, snap.data() as GlobalPlayerProfile);
      }
    }
  }

  return result;
}
