"use server";

/**
 * Server actions for upserting global player profiles.
 *
 * Called from client-side code (e.g. handleSaveRoster in my-team page)
 * after a transfer or roster change to ensure every player has a
 * record in the global `/players/{steamId64}` collection.
 */

import {
  batchUpsertGlobalPlayerProfiles,
  setPlayerCurrentTeam,
  clearPlayerCurrentTeam,
  type UpsertPlayerInput,
  type GlobalPlayerProfile,
} from './player-profiles';

export interface UpsertPlayersPayload {
  players: Array<{
    steamId: string;
    steamId32: string;
    nickname: string;
    steamProfileUrl: string;
    avatar?: string;
    avatarmedium?: string;
    avatarfull?: string;
    currentTeam?: UpsertPlayerInput['currentTeam'];
  }>;
}

/**
 * Upsert global player profiles after a roster change (transfer, add, etc.)
 * Returns the count of players successfully upserted.
 */
export async function upsertGlobalPlayerProfilesAction(
  payload: UpsertPlayersPayload
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const validPlayers: UpsertPlayerInput[] = payload.players
      .filter(p => p.steamId && p.steamId.length > 10)
      .map(p => ({
        steamId: p.steamId,
        steamId32: p.steamId32,
        nickname: p.nickname,
        steamProfileUrl: p.steamProfileUrl,
        avatar: p.avatar,
        avatarmedium: p.avatarmedium,
        avatarfull: p.avatarfull,
        ...(p.currentTeam !== undefined ? { currentTeam: p.currentTeam } : {}),
      }));

    if (validPlayers.length === 0) {
      return { success: true, count: 0 };
    }

    await batchUpsertGlobalPlayerProfiles(validPlayers);

    console.log(`[player-profile-actions] Upserted ${validPlayers.length} global player profiles`);
    return { success: true, count: validPlayers.length };
  } catch (error) {
    console.error('[player-profile-actions] Error upserting global player profiles:', error);
    return { success: false, count: 0, error: (error as Error).message };
  }
}

/**
 * Set the currentTeam pointer for a single player global profile.
 * Call when a player is transferred INTO a team.
 */
export async function setPlayerCurrentTeamAction(
  steamId: string,
  currentTeam: GlobalPlayerProfile['currentTeam']
): Promise<{ success: boolean; error?: string }> {
  try {
    await setPlayerCurrentTeam(steamId, currentTeam);
    return { success: true };
  } catch (error) {
    console.error('[player-profile-actions] Error setting currentTeam:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Clear the currentTeam pointer for one or more players.
 * Call when players are transferred OUT of a team.
 */
export async function clearPlayerCurrentTeamsAction(
  steamIds: string[]
): Promise<{ success: boolean; cleared: number; error?: string }> {
  try {
    await Promise.allSettled(steamIds.map(id => clearPlayerCurrentTeam(id)));
    return { success: true, cleared: steamIds.length };
  } catch (error) {
    console.error('[player-profile-actions] Error clearing currentTeam:', error);
    return { success: false, cleared: 0, error: (error as Error).message };
  }
}
