"use server";

import { getAdminDb } from '@/server/lib/admin';
import { extractSteamIdFromUrl } from './steam-id-utils';
import { getGlobalPlayerProfiles, type GlobalPlayerProfile } from './player-profiles';

export type PlayerMatchRole = 'registered' | 'standin' | 'unknown';

export interface MatchPlayerData {
    steamId32: string;
    nickname: string;
    role: PlayerMatchRole;
    teamId: string;
    /** Populated for standins only — who they replaced */
    replacedPlayerId?: string;
    replacedPlayerNickname?: string;
}

/**
 * Build a lookup of player metadata for a match.
 *
 * Keys supported in the returned map:
 * - steamId32 (string)
 * - unknown_{steamId32}
 * - firestore doc id (auto-generated)
 * - explicit data.id field if present
 */
export async function getMatchPlayersData(
    matchId: string,
    teamAId: string,
    teamBId: string,
    tournamentId?: string
): Promise<Record<string, MatchPlayerData>> {
    const result: Record<string, MatchPlayerData> = {};
    const adminDb = getAdminDb();

    // Helper: prefer tournament-scoped teams, fall back to root teams
    const getPlayersSnap = async (teamId: string) => {
        if (tournamentId) {
            const snap = await adminDb
                .collection('tournaments')
                .doc(tournamentId)
                .collection('teams')
                .doc(teamId)
                .collection('players')
                .get();
            if (!snap.empty) return snap;
        }
        return adminDb.collection('teams').doc(teamId).collection('players').get();
    };

    const indexPlayersSnap = (snap: any, teamId: string) => {
        snap.docs.forEach((doc: any) => {
            const data = doc.data() || {};
            const nickname = data.nickname || 'Unknown';

            // Normalize steamId32: prefer explicit field, then compute from 64-bit fields,
            // then fall back to openDota account id.
            let normalizedSteam32 = '';
            // Also track the value computed from steamId64/steamId so we can index it
            // as an additional key even when an explicit steamId32 exists.
            // This guards against stale explicit steamId32 values (e.g. left over from a
            // previous player who occupied the same roster slot before a transfer).
            let computedSteam32 = '';
            try {
                if (data.steamId32) normalizedSteam32 = String(data.steamId32);

                // Compute from 64-bit fields regardless — used as extra index below.
                if (data.steamId64 && String(data.steamId64).length > 10) {
                    computedSteam32 = String(BigInt(String(data.steamId64)) - 76561197960265728n);
                } else if (data.steamId && String(data.steamId).length > 10) {
                    computedSteam32 = String(BigInt(String(data.steamId)) - 76561197960265728n);
                }

                if (!normalizedSteam32) {
                    normalizedSteam32 = computedSteam32 || (data.openDotaAccountId ? String(data.openDotaAccountId) : '');
                }
            } catch (e) {
                // ignore conversion errors
            }

            const playerEntry: MatchPlayerData = {
                steamId32: normalizedSteam32,
                nickname,
                role: 'registered',
                teamId,
            };

            if (normalizedSteam32) {
                result[normalizedSteam32] = playerEntry;
                result['unknown_' + normalizedSteam32] = playerEntry;
            }
            // Also index by the computed value when it differs from the explicit one,
            // so a stale steamId32 field doesn't prevent the player from being found.
            if (computedSteam32 && computedSteam32 !== normalizedSteam32) {
                result[computedSteam32] = playerEntry;
                result['unknown_' + computedSteam32] = playerEntry;
            }

            // Index by steamId64 as well — performance docs use steamId64 as playerId.
            if (data.steamId64 && String(data.steamId64).length > 10) {
                result[String(data.steamId64)] = playerEntry;
            }
            if (data.steamId && String(data.steamId).length > 10) {
                result[String(data.steamId)] = playerEntry;
            }
            // Compute steamId64 from steamId32 as a fallback when neither field exists
            if (normalizedSteam32 && !data.steamId64 && !data.steamId) {
                try {
                    const derivedSteam64 = String(BigInt(normalizedSteam32) + 76561197960265728n);
                    result[derivedSteam64] = playerEntry;
                } catch { /* ignore */ }
            }

            // Firestore doc id
            result[doc.id] = playerEntry;
            // explicit id field
            if (data.id && data.id !== doc.id) result[data.id] = playerEntry;
        });
    };

    try {
        const teamAPlayersSnap = await getPlayersSnap(teamAId);
        indexPlayersSnap(teamAPlayersSnap, teamAId);

        const teamBPlayersSnap = await getPlayersSnap(teamBId);
        indexPlayersSnap(teamBPlayersSnap, teamBId);

        // match document may be tournament-scoped (PDL) or root (legacy)
        const matchRef = tournamentId
            ? adminDb.collection('tournaments').doc(tournamentId).collection('matches').doc(matchId)
            : adminDb.collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();
        // Lift matchData to outer scope so the approvedStandins block below can access it.
        const matchData = matchSnap.exists ? matchSnap.data() as any : null;
        // Letnia-style standinInfo uses standin IDs referencing `standins` collection
        if (matchData?.standinInfo) {
            for (const [tId, info] of Object.entries(matchData.standinInfo)) {
                const typedInfo = info as { standins?: string[] };
                for (const standinId of typedInfo.standins || []) {
                    try {
                        const standinSnap = await adminDb.collection('standins').doc(standinId).get();
                        if (!standinSnap.exists) continue;
                        const sd = standinSnap.data() as any;
                        if (sd?.steamId32) {
                            const entry: MatchPlayerData = {
                                steamId32: String(sd.steamId32),
                                nickname: sd.nickname || 'Standin',
                                role: 'standin',
                                teamId: tId,
                            };
                            result[String(sd.steamId32)] = entry;
                            result['unknown_' + sd.steamId32] = entry;
                            // Also index by steamId64 — performance docs use steamId64 as playerId
                            try {
                                const steam64 = String(BigInt(String(sd.steamId32)) + 76561197960265728n);
                                result[steam64] = entry;
                            } catch { /* ignore */ }
                        }
                    } catch (e) {
                        console.error('Failed to fetch standin', standinId, e);
                    }
                }
            }
        }

        // ── Primary source: approvedStandins map written directly to match doc ──
        // All new approvals write here via standin-actions.ts server actions.
        // `playerDocId` is the standin's own Firestore player doc ID (may be from a
        // different team than the match teams if they are a registered cross-team standin).
        if (matchData?.approvedStandins && typeof matchData.approvedStandins === 'object') {
            for (const [, entry] of Object.entries(matchData.approvedStandins)) {
                const e = entry as {
                    steamId32?: string;
                    nickname?: string;
                    teamId?: string;
                    replacedPlayerId?: string;
                    replacedPlayerNickname?: string;
                    playerDocId?: string;
                };
                if (e.steamId32 && e.nickname && e.teamId) {
                    const standinEntry: MatchPlayerData = {
                        steamId32: e.steamId32,
                        nickname: e.nickname,
                        role: 'standin',
                        teamId: e.teamId,
                        replacedPlayerId: e.replacedPlayerId,
                        replacedPlayerNickname: e.replacedPlayerNickname,
                    };
                    result[e.steamId32] = standinEntry;
                    result['unknown_' + e.steamId32] = standinEntry;
                    // Also index by steamId64 — performance docs use steamId64 as playerId
                    try {
                        const steam64 = String(BigInt(e.steamId32) + 76561197960265728n);
                        result[steam64] = standinEntry;
                    } catch { /* ignore */ }
                    // Also index by the standin's registered player doc ID so that
                    // performances imported with the cross-team doc ID resolve correctly.
                    if (e.playerDocId) {
                        result[e.playerDocId] = standinEntry;
                    }
                }
            }
        }

        // ── Fallback source: standinRequests subcollection ──
        // Kept for backward compatibility with matches approved before the
        // approvedStandins map was introduced.
        // PDL standin requests: approved ones contain a steam profile URL.
        // PDL stores these in tournaments/{tournamentId}/standinRequests (tournament-scoped).
        // Legacy tournaments may use the root standinRequests collection.
        // We query both so neither format is missed.
        const standinRequestCollections = [
            adminDb.collection('standinRequests').where('matchId', '==', matchId).get(),
        ];
        if (tournamentId) {
            standinRequestCollections.push(
                adminDb
                    .collection('tournaments')
                    .doc(tournamentId)
                    .collection('standinRequests')
                    .where('matchId', '==', matchId)
                    .get()
            );
        }
        const standinRequestSnaps = await Promise.all(standinRequestCollections);
        const allStandinRequestDocs = standinRequestSnaps.flatMap(snap => snap.docs);
        for (const doc of allStandinRequestDocs) {
            const req = doc.data() as any;
            if (!['approved', 'appeal_approved'].includes(req.status)) continue;
            if (req.standinSteamProfileUrl && req.standinNickname && req.teamId) {
                try {
                    const { steamId32 } = await extractSteamIdFromUrl(req.standinSteamProfileUrl);
                    if (steamId32) {
                        const entry: MatchPlayerData = {
                            steamId32,
                            nickname: req.standinNickname,
                            role: 'standin',
                            teamId: req.teamId,
                            replacedPlayerId: req.replacedPlayerId,
                            replacedPlayerNickname: req.replacedPlayerNickname,
                        };
                        result[steamId32] = entry;
                        result['unknown_' + steamId32] = entry;
                        // Also index by steamId64 — performance docs use steamId64 as playerId
                        try {
                            const steam64 = String(BigInt(steamId32) + 76561197960265728n);
                            result[steam64] = entry;
                        } catch { /* ignore */ }
                    }
                } catch (e) {
                    console.error('Failed to resolve standin steam id from url', req.standinSteamProfileUrl, e);
                }
            }
        }

        // ── Global player profile fallback ──
        // For transferred players whose old Firestore doc ID no longer maps to
        // anyone in the current roster, check the global /players collection.
        // This builds a steamId32→GlobalPlayerProfile index that callers can query.
        try {
            // Collect all steamId64s we already resolved (from team player docs)
            const allSteamId64s: string[] = [];
            const indexPlayerSnap2 = async (teamId: string) => {
                const snap = tournamentId
                    ? await adminDb.collection('tournaments').doc(tournamentId).collection('teams').doc(teamId).collection('players').get()
                    : await adminDb.collection('teams').doc(teamId).collection('players').get();
                snap.docs.forEach((d: any) => {
                    const data = d.data() || {};
                    const sid = data.steamId || data.steamId64 || '';
                    if (sid && sid.length > 10) allSteamId64s.push(sid);
                });
            };
            await Promise.all([indexPlayerSnap2(teamAId), indexPlayerSnap2(teamBId)]);

            if (allSteamId64s.length > 0) {
                const globalProfiles = await getGlobalPlayerProfiles(allSteamId64s);
                // For each global profile:
                // - Always UPDATE the nickname if the current entry has the fallback 'Unknown'
                //   (happens for pointer-only subcollection docs that have no nickname field).
                // - ADD the entry if the key doesn't exist yet (e.g. transferred-out players).
                for (const [steamId64, profile] of globalProfiles) {
                    if (profile.steamId32) {
                        const existingSteam32 = result[profile.steamId32];
                        if (!existingSteam32 || existingSteam32.nickname === 'Unknown') {
                            // Preserve role/teamId from the already-resolved entry when available
                            const mergedEntry: MatchPlayerData = {
                                steamId32: profile.steamId32,
                                nickname: profile.nickname,
                                role: existingSteam32?.role || 'registered',
                                teamId: existingSteam32?.teamId || '',
                                ...(existingSteam32?.replacedPlayerId ? { replacedPlayerId: existingSteam32.replacedPlayerId } : {}),
                                ...(existingSteam32?.replacedPlayerNickname ? { replacedPlayerNickname: existingSteam32.replacedPlayerNickname } : {}),
                            };
                            result[profile.steamId32] = mergedEntry;
                            result['unknown_' + profile.steamId32] = mergedEntry;
                        }
                    }
                    // Also index by steamId64 for cases where doc IDs are steamId64.
                    // Always write this key because it won't have been set by indexPlayersSnap
                    // (which keys by steamId32, doc id, and explicit data.id).
                    const existingSteam64 = result[steamId64];
                    if (!existingSteam64 || existingSteam64.nickname === 'Unknown') {
                        result[steamId64] = {
                            steamId32: profile.steamId32,
                            nickname: profile.nickname,
                            role: existingSteam64?.role || 'registered',
                            teamId: existingSteam64?.teamId || '',
                        };
                    }
                }
            }
        } catch (globalErr) {
            // Non-fatal: fall back to existing resolution
            console.warn('[getMatchPlayersData] Global profile fallback failed:', globalErr);
        }
    } catch (error) {
        console.error('Error fetching match players data:', error);
    }

    return result;
}
