/**
 * Utility for loading team player data for display purposes.
 *
 * Architecture note:
 * - New teams (post-march 2026) store a `roster` map on the team document:
 *     { [steamId64]: { nickname, role, steamId32, avatar? } }
 *   This avoids an extra subcollection read on every page load.
 * - Legacy/fallback: read from the `/players` subcollection on the team doc.
 *   Pointer-only subcollection docs have { steamId, steamId32, role } only —
 *   NO nickname or avatar.
 *
 * Always call `loadTeamPlayersForDisplay` (or `loadTeamPlayersFromDocData`)
 * instead of querying the `players` subcollection directly when you
 * need fields like `nickname` and `avatar` for UI rendering.
 */

import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PlayerRole } from '@/lib/definitions';

export interface DisplayPlayer {
  id: string;
  nickname: string;
  role: string;
  steamId: string;
  steamId32: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  steamProfileUrl: string;
  mmr?: number;
  profileScreenshotUrl?: string;
  smurfAccounts?: { steamProfileUrl: string }[];
}

type RosterMap = Record<string, { nickname: string; role: string; steamId32: string; avatar?: string; mmr?: number; profileScreenshotUrl?: string; smurfAccounts?: { steamProfileUrl: string }[] }>;

/**
 * Build DisplayPlayer array directly from a team doc's data object.
 * Prefers the `roster` map. Returns null if the team doc has no roster
 * (caller should fall back to subcollection read).
 */
export function buildPlayersFromRosterMap(teamDocData: Record<string, unknown>): DisplayPlayer[] | null {
  const rosterMap = teamDocData.roster as RosterMap | undefined;
  if (!rosterMap || Object.keys(rosterMap).length === 0) return null;

  return Object.entries(rosterMap).map(([steamId64, info]) => ({
    id: steamId64,
    steamId: steamId64,
    steamId32: info.steamId32 || '',
    nickname: info.nickname || '',
    role: info.role || '',
    avatar: info.avatar || '',
    avatarmedium: '',
    avatarfull: '',
    steamProfileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
    mmr: info.mmr,
    profileScreenshotUrl: info.profileScreenshotUrl,
    smurfAccounts: info.smurfAccounts,
  }));
}

/**
 * Load team players for display, preferring the roster map embedded in the
 * team document. Fetches the team doc if not already provided.
 *
 * @param teamId         Firestore team document ID
 * @param tournamentId   Tournament ID (for scoped path)
 * @param teamDocData    Optional: already-fetched team doc data (avoids extra read)
 */
export async function loadTeamPlayersForDisplay(
  teamId: string,
  tournamentId: string,
  teamDocData?: Record<string, unknown>,
): Promise<DisplayPlayer[]> {
  // If we weren't given the team doc data, fetch it now to access the roster map.
  let docData = teamDocData;
  if (!docData) {
    const teamSnap = await getDoc(doc(db, 'tournaments', tournamentId, 'teams', teamId));
    docData = teamSnap.exists() ? (teamSnap.data() as Record<string, unknown>) : {};
  }

  // Prefer roster map (new architecture — has nickname + avatar + role)
  const fromRoster = buildPlayersFromRosterMap(docData);
  if (fromRoster) {
    // If any player is missing smurfAccounts in the roster map, read the player
    // subcollection to recover them (e.g. teams whose roster was saved before
    // smurfAccounts were included in the roster map write path).
    const missingSmurfs = fromRoster.some(p => !p.smurfAccounts?.length);
    if (missingSmurfs) {
      try {
        const playersRef = collection(db, 'tournaments', tournamentId, 'teams', teamId, 'players');
        const subSnap = await getDocs(playersRef);
        const smurfMap: Record<string, { steamProfileUrl: string }[]> = {};
        for (const d of subSnap.docs) {
          const data = d.data() as Record<string, unknown>;
          const smurfs = data.smurfAccounts as { steamProfileUrl: string }[] | undefined;
          if (smurfs?.length) smurfMap[d.id] = smurfs;
        }
        if (Object.keys(smurfMap).length > 0) {
          return fromRoster.map(p =>
            !p.smurfAccounts?.length && smurfMap[p.steamId]
              ? { ...p, smurfAccounts: smurfMap[p.steamId] }
              : p
          );
        }
      } catch {
        // Non-fatal: return the roster as-is without smurfs
      }
    }
    return fromRoster;
  }

  // Legacy fallback: read from the player subcollection
  const playersRef = collection(db, 'tournaments', tournamentId, 'teams', teamId, 'players');
  const snap = await getDocs(playersRef);
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      steamId: (data.steamId as string) || (data.steamId64 as string) || '',
      steamId32: (data.steamId32 as string) || '',
      nickname: (data.nickname as string) || '',
      role: (data.role as string) || '',
      avatar: (data.avatar as string) || '',
      avatarmedium: (data.avatarmedium as string) || '',
      avatarfull: (data.avatarfull as string) || '',
      steamProfileUrl: (data.steamProfileUrl as string) || '',
      mmr: (data.mmr as number) || 0,
      profileScreenshotUrl: (data.profileScreenshotUrl as string) || undefined,
      smurfAccounts: (data.smurfAccounts as { steamProfileUrl: string }[]) || undefined,
    };
  });
}

/**
 * Load players for a list of teams in parallel.
 * Avoids extra team doc reads when teamDocData is already available.
 */
export async function loadAllTeamsPlayersForDisplay(
  teams: Array<{ id: string; docData: Record<string, unknown> }>,
  tournamentId: string,
): Promise<Map<string, DisplayPlayer[]>> {
  const results = await Promise.all(
    teams.map(async t => ({
      teamId: t.id,
      players: await loadTeamPlayersForDisplay(t.id, tournamentId, t.docData),
    }))
  );
  return new Map(results.map(r => [r.teamId, r.players]));
}
