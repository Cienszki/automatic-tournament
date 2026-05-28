/**
 * Admin API: Sync Steam avatars for all players in a tournament.
 *
 * Fetches fresh avatar URLs from the Steam Web API and updates:
 *   - The `roster` map on each team document
 *   - Each player's document in the global `/players/{steamId64}` collection
 *
 * POST body: { tournamentId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import { fetchSteamProfile } from '@/lib/steam-id-utils';
import { checkRateLimit, LIMIT_ADMIN_SYNC } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimitRes = checkRateLimit(req, 'sync-steam-avatars', LIMIT_ADMIN_SYNC);
  if (rateLimitRes) return rateLimitRes;

  try {
    const { tournamentId } = await req.json();

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'tournamentId is required' },
        { status: 400 }
      );
    }

    ensureAdminInitialized();
    const db = getAdminDb();

    // Collect all unique players across all teams in the tournament
    const teamsSnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .get();

    if (teamsSnap.empty) {
      return NextResponse.json({ success: true, updated: 0, message: 'No teams found' });
    }

    // Build a map: steamId64 → { avatar data + list of teams containing this player }
    interface PlayerEntry {
      steamId64: string;
      steamId32: string;
      teamIds: string[];
    }

    const playerMap = new Map<string, PlayerEntry>();

    for (const teamDoc of teamsSnap.docs) {
      const roster = teamDoc.data().roster as Record<string, { steamId32?: string }> | undefined;
      if (!roster) continue;

      for (const [steamId64, playerData] of Object.entries(roster)) {
        if (!steamId64 || steamId64.length < 10) continue;
        const existing = playerMap.get(steamId64);
        if (existing) {
          existing.teamIds.push(teamDoc.id);
        } else {
          playerMap.set(steamId64, {
            steamId64,
            steamId32: playerData.steamId32 || '',
            teamIds: [teamDoc.id],
          });
        }
      }
    }

    if (playerMap.size === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'No players with Steam IDs found' });
    }

    // Fetch fresh Steam profiles (sequential with delay to respect Steam rate limits)
    const freshProfiles = new Map<string, { avatar: string; avatarmedium: string; avatarfull: string; personaname: string }>();

    let fetchedCount = 0;
    for (const [steamId64] of playerMap) {
      try {
        const profile = await fetchSteamProfile(steamId64);
        freshProfiles.set(steamId64, {
          avatar: profile.avatar || '',
          avatarmedium: profile.avatarmedium || '',
          avatarfull: profile.avatarfull || '',
          personaname: profile.personaname || '',
        });
        fetchedCount++;
      } catch (err) {
        console.warn(`[sync-steam-avatars] Failed to fetch profile for ${steamId64}:`, err);
      }
      // Respect Steam rate limits
      if (fetchedCount < playerMap.size) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (freshProfiles.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Steam API returned no data. Check that STEAM_API_KEY is valid.' },
        { status: 502 }
      );
    }

    // Update Firestore in batches
    const batch = db.batch();

    // 1. Update roster fields on team documents
    for (const teamDoc of teamsSnap.docs) {
      const roster = teamDoc.data().roster as Record<string, Record<string, unknown>> | undefined;
      if (!roster) continue;

      let teamUpdated = false;
      const rosterUpdate: Record<string, unknown> = {};

      for (const [steamId64, playerData] of Object.entries(roster)) {
        const fresh = freshProfiles.get(steamId64);
        if (!fresh) continue;
        rosterUpdate[`roster.${steamId64}.avatar`] = fresh.avatar;
        rosterUpdate[`roster.${steamId64}.avatarmedium`] = fresh.avatarmedium;
        rosterUpdate[`roster.${steamId64}.avatarfull`] = fresh.avatarfull;
        // Also update personaname if we got one and the player hasn't set a custom nickname override
        // (keep the registered nickname, not Steam persona name — so don't update nickname field)
        teamUpdated = true;
        void playerData; // suppress unused warning
      }

      if (teamUpdated) {
        const teamRef = db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('teams')
          .doc(teamDoc.id);
        batch.update(teamRef, rosterUpdate);
      }
    }

    // 2. Update global player profiles
    const now = new Date().toISOString();
    for (const [steamId64, entry] of playerMap) {
      const fresh = freshProfiles.get(steamId64);
      if (!fresh) continue;

      const playerRef = db.collection('players').doc(steamId64);
      batch.set(
        playerRef,
        {
          avatar: fresh.avatar,
          avatarmedium: fresh.avatarmedium,
          avatarfull: fresh.avatarfull,
          updatedAt: now,
          // Carry forward steamId / steamId32 so the doc stays complete on create
          steamId: steamId64,
          steamId32: entry.steamId32,
        },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      updated: freshProfiles.size,
      total: playerMap.size,
      message: `Updated Steam avatars for ${freshProfiles.size} of ${playerMap.size} players`,
    });
  } catch (error) {
    console.error('[sync-steam-avatars] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
