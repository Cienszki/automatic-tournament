"use server";

/**
 * standin-actions.ts
 *
 * Server actions that handle every standin request state transition.
 * Each action does two things atomically:
 *   1. Updates the standinRequest document's status.
 *   2. Writes or removes the matching entry in the match document's
 *      `approvedStandins` map — the single source of truth for who
 *      actually played in a match.
 *
 * `approvedStandins` shape (keyed by standinRequest ID):
 * {
 *   [requestId]: {
 *     steamId32: string;
 *     nickname: string;
 *     replacedPlayerId: string;
 *     replacedPlayerNickname: string;
 *     teamId: string;
 *     approvedAt: string;
 *   }
 * }
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import { extractSteamIdFromUrl } from './steam-id-utils';
import { upsertGlobalPlayerProfile } from './player-profiles';

export interface ApprovedStandinEntry {
  steamId32: string;
  nickname: string;
  replacedPlayerId: string;
  replacedPlayerNickname: string;
  teamId: string;
  approvedAt: string;
  /**
   * The standin's own Firestore player doc ID, if they are a registered player
   * in any tournament team (possibly a different team from the match teams).
   * Used to index the player lookup map so performances with a cross-team doc
   * ID still resolve to the correct nickname.
   */
  playerDocId?: string;
  /** Standin's MMR — copied from the standin request at approval time. */
  standinMmr?: number;
  /**
   * Which games of the series this standin plays (1-indexed). Omitted/empty = the whole
   * series (backward compatible). Consumed by the lobby bot's per-game roster build and
   * the results UI.
   */
  gameNumbers?: number[];
}

/**
 * True if two game-scopes overlap. An empty/undefined scope means the whole series, so it
 * overlaps everything.
 */
function gamesOverlap(a?: number[], b?: number[]): boolean {
  const aAll = !a || a.length === 0;
  const bAll = !b || b.length === 0;
  if (aAll || bAll) return true;
  return a!.some((g) => b!.includes(g));
}

/** Every Steam32 id registered on either team of the match (both players[] and roster{}). */
async function collectMatchRosterSteamIds(
  tournamentId: string,
  match: any,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const db = getAdminDb();
  const teamIds = [match?.teamA?.id, match?.teamB?.id].filter(Boolean);
  for (const tid of teamIds) {
    const tdoc = await db.collection('tournaments').doc(tournamentId).collection('teams').doc(tid).get();
    if (!tdoc.exists) continue;
    const t = tdoc.data() as any;
    if (Array.isArray(t.players)) {
      for (const p of t.players) if (p?.steamId32) ids.add(String(p.steamId32));
    }
    if (t.roster && typeof t.roster === 'object') {
      for (const r of Object.values(t.roster) as any[]) if (r?.steamId32) ids.add(String(r.steamId32));
    }
  }
  return ids;
}

/**
 * Returns a human-readable error if adding the standin described by `req` (steamId32 +
 * replacedPlayerId + gameNumbers) would break the "10 distinct players per GAME" rule, or
 * null if it's fine. Pass `requestId` to ignore that request (re-approval); '' to ignore none.
 * Blocked situations (all scoped to OVERLAPPING games):
 *   1. the standin is already a registered roster player of either team in this match,
 *   2. the same replaced player already has a standin (the slot is taken), and
 *   3. the same person (steamId32) is already a standin for ANY slot on EITHER team.
 */
async function findConflictingApprovedStandin(
  tournamentId: string,
  matchId: string,
  requestId: string,
  req: any,
  standinSteamId32: string,
): Promise<string | null> {
  const snap = await (await resolveMatchRef(tournamentId, matchId)).get();
  if (!snap.exists) return null;
  const match = snap.data() as any;

  // 1. A standin can't be someone already playing the match as a registered player.
  if (standinSteamId32) {
    const rosterIds = await collectMatchRosterSteamIds(tournamentId, match);
    if (rosterIds.has(standinSteamId32)) {
      return 'Ten gracz jest już zawodnikiem jednej z drużyn w tym meczu — nie może być standinem.';
    }
  }

  const approved = match?.approvedStandins || {};
  for (const [key, value] of Object.entries(approved)) {
    if (key === requestId) continue; // ignore this same request (re-approval)
    const e = value as any;
    if (!gamesOverlap(e.gameNumbers, req.gameNumbers)) continue;
    // 3. Same person already standing in for some slot (either team) in an overlapping game.
    if (standinSteamId32 && e.steamId32 === standinSteamId32) {
      return `Ten standin jest już zatwierdzony za innego gracza (${e.replacedPlayerNickname || '—'}) w nakładających się grach.`;
    }
    // 2. The slot (same team + same replaced player) already has a standin.
    if (e.teamId === req.teamId && e.replacedPlayerId === req.replacedPlayerId) {
      return `Już zatwierdzono standina (${e.nickname || 'inny'}) za tego gracza w nakładających się grach.`;
    }
  }
  return null;
}

/** Build the denormalized approvedStandins entry from a request doc + resolved ids. */
function buildApprovedStandinEntry(
  req: any,
  steamId32: string,
  playerDocId: string,
  approvedAt: string,
): ApprovedStandinEntry {
  return {
    steamId32,
    nickname: req.standinNickname,
    replacedPlayerId: req.replacedPlayerId,
    replacedPlayerNickname: req.replacedPlayerNickname,
    teamId: req.teamId,
    approvedAt,
    ...(playerDocId ? { playerDocId } : {}),
    ...(req.standinMmr != null ? { standinMmr: req.standinMmr } : {}),
    ...(Array.isArray(req.gameNumbers) && req.gameNumbers.length ? { gameNumbers: req.gameNumbers } : {}),
  };
}

export interface StandinActionResult {
  success: boolean;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function standinReqRef(tournamentId: string, requestId: string) {
  ensureAdminInitialized();
  return getAdminDb()
    .collection('tournaments')
    .doc(tournamentId)
    .collection('standinRequests')
    .doc(requestId);
}

function matchRef(tournamentId: string, matchId: string) {
  return getAdminDb()
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')
    .doc(matchId);
}

/**
 * Resolves a match document reference across both the regular `matches` collection and the
 * `playoff_matches` collection (playoff bracket matches live in a separate collection). Prefers
 * `matches`; falls back to `playoff_matches` when the id only exists there. Returns the `matches`
 * ref as a default when neither exists so callers still get a usable (possibly missing) ref.
 */
async function resolveMatchRef(tournamentId: string, matchId: string) {
  const primary = matchRef(tournamentId, matchId);
  const primarySnap = await primary.get();
  if (primarySnap.exists) return primary;

  const playoff = getAdminDb()
    .collection('tournaments')
    .doc(tournamentId)
    .collection('playoff_matches')
    .doc(matchId);
  const playoffSnap = await playoff.get();
  if (playoffSnap.exists) return playoff;

  return primary;
}

/** Silently resolves steamId32 and steamId64 from a profile URL. Returns empty strings on failure. */
async function resolveSteamIds(profileUrl: string): Promise<{ steamId32: string; steamId64: string }> {
  if (!profileUrl) return { steamId32: '', steamId64: '' };
  try {
    const { steamId32, steamId64 } = await extractSteamIdFromUrl(profileUrl);
    return { steamId32, steamId64 };
  } catch {
    return { steamId32: '', steamId64: '' };
  }
}

/**
 * Finds the Firestore player doc ID for a given steamId32 by searching all
 * teams in the tournament. Returns '' if the player is not registered.
 * This is called once at approval time so it is stored in approvedStandins,
 * avoiding repeated cross-team scans later.
 */
async function findPlayerDocIdBySteamId32(
  tournamentId: string,
  steamId32: string,
): Promise<string> {
  if (!steamId32) return '';
  try {
    const db = getAdminDb();
    const teamsSnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .get();
    for (const teamDoc of teamsSnap.docs) {
      const playersSnap = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .doc(teamDoc.id)
        .collection('players')
        .where('steamId32', '==', steamId32)
        .limit(1)
        .get();
      if (!playersSnap.empty) return playersSnap.docs[0].id;
    }
  } catch (e) {
    console.error('[standin-actions] findPlayerDocIdBySteamId32 error', e);
  }
  return '';
}

// ─── Captain actions ─────────────────────────────────────────────────────────

/**
 * Pre-flight validation run when a captain proposes a standin (before the request is
 * created), so they get immediate feedback instead of only discovering a clash at approval.
 * Resolves the standin's Steam id and applies the same "10 distinct players per game" rules
 * used at approval. Returns success:true when allowed — or when the Steam profile can't be
 * resolved (the approval step re-checks, so we don't block registration on a transient miss).
 */
export async function precheckStandinRequest(
  tournamentId: string,
  matchId: string,
  data: { teamId: string; replacedPlayerId: string; gameNumbers?: number[]; standinSteamProfileUrl: string },
): Promise<StandinActionResult> {
  try {
    const { steamId32 } = await resolveSteamIds(data.standinSteamProfileUrl);
    if (!steamId32) return { success: true }; // can't resolve → defer to approval-time check
    const conflict = await findConflictingApprovedStandin(
      tournamentId,
      matchId,
      '',
      { teamId: data.teamId, replacedPlayerId: data.replacedPlayerId, gameNumbers: data.gameNumbers },
      steamId32,
    );
    if (conflict) return { success: false, error: conflict };
    return { success: true };
  } catch (e) {
    // Never block registration on an unexpected validation error; approval still guards.
    console.warn('[standin-actions] precheckStandinRequest error', e);
    return { success: true };
  }
}

/**
 * Opponent captain approves a standin request.
 */
export async function approveStandinRequest(
  tournamentId: string,
  requestId: string,
): Promise<StandinActionResult> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return { success: false, error: 'Request not found' };
    const req = reqSnap.data()!;

    const { steamId32, steamId64 } = await resolveSteamIds(req.standinSteamProfileUrl);

    const conflict = await findConflictingApprovedStandin(tournamentId, req.matchId, requestId, req, steamId32);
    if (conflict) {
      return { success: false, error: conflict };
    }

    const playerDocId = await findPlayerDocIdBySteamId32(tournamentId, steamId32);
    const now = new Date().toISOString();

    const entry: ApprovedStandinEntry = buildApprovedStandinEntry(req, steamId32, playerDocId, now);

    const mRef = await resolveMatchRef(tournamentId, req.matchId);
    await Promise.all([
      // Also write steamId32 to the standinRequest doc so Source 3 of the standinLookup
      // can resolve nicknames without parsing the profile URL.
      reqRef.update({ status: 'approved', respondedAt: now, updatedAt: now, standinSteamId32: steamId32 }),
      mRef.update({
        [`approvedStandins.${requestId}`]: entry,
      }),
    ]);

    // Upsert global player profile for the standin
    if (steamId64) {
      try {
        await upsertGlobalPlayerProfile({
          steamId: steamId64,
          steamId32,
          nickname: req.standinNickname,
          steamProfileUrl: req.standinSteamProfileUrl || '',
        });
      } catch (profileErr) {
        console.warn('[standin-actions] Failed to upsert global profile for standin:', profileErr);
      }
    }

    // Sync active lobby sessions so the bot knows about the new standin
    try {
      const { syncLobbySessionStandins } = await import('./bot/bot-config-actions');
      const synced = await syncLobbySessionStandins(tournamentId, req.matchId);
      if (synced > 0) {
        console.log(`[standin-actions] Updated ${synced} active lobby session(s) with new standin`);
      }
    } catch (syncErr) {
      // Non-fatal: the lobby session update is best-effort
      console.warn('[standin-actions] Failed to sync lobby sessions after standin approval:', syncErr);
    }

    return { success: true };
  } catch (e) {
    console.error('[standin-actions] approveStandinRequest error', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Opponent captain rejects a standin request.
 * Removes entry from match doc in case it was previously approved then re-requested.
 */
export async function rejectStandinRequest(
  tournamentId: string,
  requestId: string,
  reason?: string,
): Promise<StandinActionResult> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return { success: false, error: 'Request not found' };
    const req = reqSnap.data()!;

    const now = new Date().toISOString();

    const mRef = await resolveMatchRef(tournamentId, req.matchId);
    await Promise.all([
      reqRef.update({
        status: 'rejected',
        rejectionReason: reason || '',
        respondedAt: now,
        updatedAt: now,
      }),
      mRef.update({
        [`approvedStandins.${requestId}`]: FieldValue.delete(),
      }).catch(() => { /* match may not have the field yet */ }),
    ]);

    return { success: true };
  } catch (e) {
    console.error('[standin-actions] rejectStandinRequest error', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Requesting captain cancels a still-pending standin request.
 * Deletes the request document and removes from match doc.
 */
export async function cancelStandinRequest(
  tournamentId: string,
  requestId: string,
): Promise<StandinActionResult> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return { success: false, error: 'Request not found' };
    const req = reqSnap.data()!;

    const mRef = await resolveMatchRef(tournamentId, req.matchId);
    await Promise.all([
      reqRef.delete(),
      mRef.update({
        [`approvedStandins.${requestId}`]: FieldValue.delete(),
      }).catch(() => { /* match may not have the field yet */ }),
    ]);

    // If the standin was active, sync the lobby session to remove them and restore the original player
    if (req.status === 'approved' || req.status === 'appeal_approved') {
      try {
        const { syncLobbySessionStandins } = await import('./bot/bot-config-actions');
        const synced = await syncLobbySessionStandins(tournamentId, req.matchId);
        if (synced > 0) {
          console.log(`[standin-actions] Removed standin from ${synced} active lobby session(s) after cancel`);
        }
      } catch (syncErr) {
        console.warn('[standin-actions] Failed to sync lobby sessions after standin cancel:', syncErr);
      }
    }

    return { success: true };
  } catch (e) {
    console.error('[standin-actions] cancelStandinRequest error', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Requesting captain changes which games an existing standin covers — e.g. the standin gets injured
 * mid-series, so the captain narrows them to the games already played and then files a fresh request
 * for the remaining games. Editing sends the request BACK to 'pending' (the opponent captain must
 * re-approve) and removes the now-stale approvedStandins entry (re-added on re-approval), so the bot
 * drops the standin from upcoming games until the opponent agrees again.
 */
export async function editStandinRequestGames(
  tournamentId: string,
  requestId: string,
  gameNumbers: number[],
): Promise<StandinActionResult> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return { success: false, error: 'Request not found' };
    const req = reqSnap.data()!;

    const now = new Date().toISOString();
    const cleanGames = Array.isArray(gameNumbers)
      ? [...new Set(gameNumbers.map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b)
      : [];

    await reqRef.update({
      gameNumbers: cleanGames,
      status: 'pending',
      respondedAt: FieldValue.delete(),
      rejectionReason: FieldValue.delete(),
      updatedAt: now,
    });

    // Drop the stale approved entry — it is re-created (with the new games) on re-approval.
    await (await resolveMatchRef(tournamentId, req.matchId)).update({
      [`approvedStandins.${requestId}`]: FieldValue.delete(),
    }).catch(() => { /* field may not exist yet */ });

    // Remove the standin from any active lobby session until the opponent re-approves.
    try {
      const { syncLobbySessionStandins } = await import('./bot/bot-config-actions');
      await syncLobbySessionStandins(tournamentId, req.matchId);
    } catch (syncErr) {
      console.warn('[standin-actions] Failed to sync lobby sessions after standin edit:', syncErr);
    }

    return { success: true };
  } catch (e) {
    console.error('[standin-actions] editStandinRequestGames error', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Requesting captain escalates a rejected request to admin appeal.
 */
export async function appealStandinRequest(
  tournamentId: string,
  requestId: string,
): Promise<StandinActionResult> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const now = new Date().toISOString();
    await reqRef.update({ status: 'appeal_pending', appealedAt: now, updatedAt: now });
    return { success: true };
  } catch (e) {
    console.error('[standin-actions] appealStandinRequest error', e);
    return { success: false, error: (e as Error).message };
  }
}

// ─── Admin actions ────────────────────────────────────────────────────────────

/**
 * Admin approves a standin appeal.
 */
export async function approveStandinAppeal(
  tournamentId: string,
  requestId: string,
  adminUid: string,
  adminNote?: string,
): Promise<StandinActionResult> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return { success: false, error: 'Request not found' };
    const req = reqSnap.data()!;

    const { steamId32, steamId64 } = await resolveSteamIds(req.standinSteamProfileUrl);

    const conflict = await findConflictingApprovedStandin(tournamentId, req.matchId, requestId, req, steamId32);
    if (conflict) {
      return { success: false, error: conflict };
    }

    const playerDocId = await findPlayerDocIdBySteamId32(tournamentId, steamId32);
    const now = new Date().toISOString();

    const entry: ApprovedStandinEntry = buildApprovedStandinEntry(req, steamId32, playerDocId, now);

    const mRef = await resolveMatchRef(tournamentId, req.matchId);
    await Promise.all([
      reqRef.update({
        status: 'appeal_approved',
        appealResolvedBy: adminUid,
        appealResolvedAt: now,
        appealAdminNote: adminNote || null,
        updatedAt: now,
      }),
      mRef.update({
        [`approvedStandins.${requestId}`]: entry,
      }),
    ]);

    // Upsert global player profile for the standin
    if (steamId64) {
      try {
        await upsertGlobalPlayerProfile({
          steamId: steamId64,
          steamId32,
          nickname: req.standinNickname,
          steamProfileUrl: req.standinSteamProfileUrl || '',
        });
      } catch (profileErr) {
        console.warn('[standin-actions] Failed to upsert global profile for standin:', profileErr);
      }
    }

    // Sync active lobby sessions so the bot knows about the new standin
    try {
      const { syncLobbySessionStandins } = await import('./bot/bot-config-actions');
      const synced = await syncLobbySessionStandins(tournamentId, req.matchId);
      if (synced > 0) {
        console.log(`[standin-actions] Updated ${synced} active lobby session(s) with appeal-approved standin`);
      }
    } catch (syncErr) {
      console.warn('[standin-actions] Failed to sync lobby sessions after appeal approval:', syncErr);
    }

    return { success: true };
  } catch (e) {
    console.error('[standin-actions] approveStandinAppeal error', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Admin rejects a standin appeal (opponent captain's decision is final).
 */
export async function rejectStandinAppeal(
  tournamentId: string,
  requestId: string,
  adminUid: string,
  adminNote?: string,
): Promise<StandinActionResult> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return { success: false, error: 'Request not found' };
    const req = reqSnap.data()!;

    const now = new Date().toISOString();

    const mRef = await resolveMatchRef(tournamentId, req.matchId);
    await Promise.all([
      reqRef.update({
        status: 'appeal_rejected',
        appealResolvedBy: adminUid,
        appealResolvedAt: now,
        appealAdminNote: adminNote || null,
        updatedAt: now,
      }),
      mRef.update({
        [`approvedStandins.${requestId}`]: FieldValue.delete(),
      }).catch(() => { /* match may not have the field yet */ }),
    ]);

    return { success: true };
  } catch (e) {
    console.error('[standin-actions] rejectStandinAppeal error', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Admin undoes an appeal resolution (sends it back to appeal_pending).
 * Returns the previousNote so the admin UI can restore it to the text field.
 */
export async function undoStandinAppealResolution(
  tournamentId: string,
  requestId: string,
): Promise<StandinActionResult & { previousNote?: string }> {
  try {
    const reqRef = standinReqRef(tournamentId, requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return { success: false, error: 'Request not found' };
    const currentData = reqSnap.data()!;

    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      status: 'appeal_pending',
      appealResolvedBy: FieldValue.delete(),
      appealResolvedAt: FieldValue.delete(),
      updatedAt: now,
    };

    await reqRef.update(updates);

    // If the appeal was previously approved, remove from match doc
    if (currentData.status === 'appeal_approved') {
      const mRef = await resolveMatchRef(tournamentId, currentData.matchId);
      await mRef.update({
        [`approvedStandins.${requestId}`]: FieldValue.delete(),
      }).catch(() => {});
    }

    return { success: true, previousNote: currentData.appealAdminNote };
  } catch (e) {
    console.error('[standin-actions] undoStandinAppealResolution error', e);
    return { success: false, error: (e as Error).message };
  }
}
