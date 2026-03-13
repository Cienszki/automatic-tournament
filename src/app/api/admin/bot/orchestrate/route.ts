// src/app/api/admin/bot/orchestrate/route.ts
// Orchestrator endpoint - called periodically (via cron or manual trigger)
// Handles: scheduling lobbies for upcoming matches, assigning bots, processing events, executing sync tasks

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';
import { assignBotsToSessions, healthCheckBots } from '@/lib/bot/bot-pool-manager';
import { processUnhandledBotEvents } from '@/lib/bot/bot-agent';
import type { Match } from '@/lib/definitions';
import type { TournamentBotConfig, LobbySession } from '@/types/lobby-bot';

interface OrchestrateResult {
  lobbiesScheduled: number;
  botsAssigned: number;
  eventsProcessed: number;
  syncTasksExecuted: number;
  healthChecks: number;
  timedOutSessions: number;
  errors: string[];
}

/**
 * POST /api/admin/bot/orchestrate
 *
 * Body: { tournamentId?: string }
 * If tournamentId is provided, only orchestrate for that tournament.
 * Otherwise, orchestrate for all tournaments with bot enabled.
 *
 * This should be triggered periodically (every 1-5 minutes) e.g., via:
 * - Vercel Cron
 * - External cron service
 * - Admin manual trigger
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Verify admin auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { tournamentId } = body as { tournamentId?: string };

    const result: OrchestrateResult = {
      lobbiesScheduled: 0,
      botsAssigned: 0,
      eventsProcessed: 0,
      syncTasksExecuted: 0,
      healthChecks: 0,
      timedOutSessions: 0,
      errors: [],
    };

    const db = getAdminDb();

    // Step 1: Health check all bots
    try {
      const staleIds = await healthCheckBots();
      result.healthChecks = staleIds.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Health check failed';
      result.errors.push(`Health check: ${msg}`);
    }

    // Step 2: Find tournaments with bot enabled
    const tournamentIds: string[] = [];
    if (tournamentId) {
      tournamentIds.push(tournamentId);
    } else {
      // Scan all tournaments for bot configs
      const tournamentsSnapshot = await db.collection('tournaments').get();
      for (const doc of tournamentsSnapshot.docs) {
        const botConfigDoc = await db
          .collection('tournaments')
          .doc(doc.id)
          .collection('config')
          .doc('bot')
          .get();

        if (botConfigDoc.exists) {
          const botConfig = botConfigDoc.data() as TournamentBotConfig;
          if (botConfig.enabled) {
            tournamentIds.push(doc.id);
          }
        }
      }
    }

    // Step 3: For each tournament, schedule lobbies for upcoming matches
    for (const tId of tournamentIds) {
      try {
        const scheduled = await scheduleUpcomingMatches(db, tId);
        result.lobbiesScheduled += scheduled;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Schedule matches (${tId}): ${msg}`);
      }
    }

    // Step 4: Assign bots to pending sessions
    try {
      const assignments = await assignBotsToSessions();
      result.botsAssigned = assignments.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Assign bots: ${msg}`);
    }

    // Step 5: Process unhandled bot events
    try {
      const processed = await processUnhandledBotEvents();
      result.eventsProcessed = processed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Process events: ${msg}`);
    }

    // Step 6: Enforce lobby timeouts — cancel sessions that have been open too long
    try {
      const timedOut = await enforceSessionTimeouts(db);
      result.timedOutSessions = timedOut;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Session timeouts: ${msg}`);
    }

    // Step 7: Execute pending sync tasks
    try {
      const synced = await executePendingSyncTasks(db);
      result.syncTasksExecuted = synced;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Sync tasks: ${msg}`);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot orchestrate error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Schedules lobby sessions for matches happening within the lead time window.
 * Returns the number of new sessions scheduled.
 */
async function scheduleUpcomingMatches(
  db: FirebaseFirestore.Firestore,
  tournamentId: string
): Promise<number> {
  // Get bot config for lead time
  const botConfigDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('config')
    .doc('bot')
    .get();

  if (!botConfigDoc.exists) return 0;

  const botConfig = botConfigDoc.data() as TournamentBotConfig;
  if (!botConfig.enabled) return 0;

  const leadTimeMs = (botConfig.lobbyCreationLeadMinutes || 15) * 60 * 1000;
  const now = Date.now();
  const windowEnd = now + leadTimeMs;

  // Find matches that should be starting soon
  const matchesSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')
    .where('status', 'in', ['scheduled', 'upcoming'])
    .get();

  let scheduled = 0;

  for (const matchDoc of matchesSnapshot.docs) {
    const match = matchDoc.data() as Match;
    const matchTime = match.scheduledFor
      ? new Date(match.scheduledFor).getTime()
      : null;

    if (!matchTime || matchTime > windowEnd || matchTime < now - 30 * 60 * 1000) {
      // Skip: no scheduled time, too far in the future, or more than 30 min in the past
      continue;
    }

    // Determine which games need lobbies
    const seriesLength = match.series_format === 'bo3' ? 3 : match.series_format === 'bo5' ? 5 : match.series_format === 'bo1' ? 1 : 2;
    const existingGames = match.game_ids?.length || 0;
    const nextGameNumber = existingGames + 1;

    if (nextGameNumber > seriesLength) continue; // Series already complete

    // Skip if the match already has a winner or is completed (series decided early)
    if (match.winnerId !== undefined || match.status === 'completed') continue;

    // Check if a lobby session already exists for this match + game number
    const existingSessionSnapshot = await db
      .collection('botLobbySessions')
      .where('matchId', '==', matchDoc.id)
      .where('currentGameNumber', '==', nextGameNumber)
      .where('state', 'not-in', ['completed', 'cancelled', 'error'])
      .limit(1)
      .get();

    if (!existingSessionSnapshot.empty) continue; // Already scheduled

    // Schedule a new lobby session
    const { scheduleLobbyForMatch } = await import('@/lib/bot/bot-config-actions');
    const matchName = `${match.teamA?.name || 'TBA'} vs ${match.teamB?.name || 'TBA'}`;
    const seriesFormat = match.series_format || 'bo2';
    await scheduleLobbyForMatch(tournamentId, matchDoc.id, matchName, seriesFormat);
    scheduled++;
  }

  return scheduled;
}

/**
 * Executes pending match sync tasks that have passed their scheduled time.
 * Returns the number of sync tasks executed.
 */
async function executePendingSyncTasks(
  db: FirebaseFirestore.Firestore
): Promise<number> {
  const now = new Date().toISOString();

  const tasksSnapshot = await db
    .collection('botSyncTasks')
    .where('status', '==', 'pending')
    .where('scheduledAt', '<=', now)
    .limit(10)
    .get();

  let executed = 0;

  for (const taskDoc of tasksSnapshot.docs) {
    const task = taskDoc.data() as {
      tournamentId: string;
      matchId: string;
      lobbySessionId: string;
      status: string;
    };

    try {
      // Mark as processing
      await taskDoc.ref.update({ status: 'processing', startedAt: new Date().toISOString() });

      // Trigger match sync - call the existing sync API internally
      // For PDL, we use the match import/sync mechanism
      const tournamentDoc = await db.collection('tournaments').doc(task.tournamentId).get();
      const tournamentData = tournamentDoc.data();

      if (tournamentData?.leagueId) {
        // For league tournaments, trigger OpenDota sync
        const matchDoc = await db
          .collection('tournaments')
          .doc(task.tournamentId)
          .collection('matches')
          .doc(task.matchId)
          .get();

        if (matchDoc.exists) {
          // Mark the lobby session as syncing
          const sessionRef = db.collection('botLobbySessions').doc(task.lobbySessionId);
          await sessionRef.update({ state: 'syncing', updatedAt: new Date().toISOString() });

          // The actual sync is handled by the existing match import infrastructure
          // We just flag the match for sync processing
          await db
            .collection('tournaments')
            .doc(task.tournamentId)
            .collection('matches')
            .doc(task.matchId)
            .update({ pendingSync: true, lastSyncRequest: new Date().toISOString() });

          // Mark session completed
          await sessionRef.update({ state: 'completed', updatedAt: new Date().toISOString() });
        }
      }

      // Mark task as completed
      await taskDoc.ref.update({
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      executed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await taskDoc.ref.update({
        status: 'failed',
        error: msg,
        failedAt: new Date().toISOString(),
      });
    }
  }

  return executed;
}

/**
 * Enforces timeout rules for all active lobby sessions.
 *
 * There are four distinct timeout phases, each with their own threshold:
 *
 *  1. PENDING STUCK       — session never got a bot assigned
 *     Threshold: pendingSessionTimeoutMinutes (default 20 min from createdAt)
 *     Action: cancel with "no bot available"
 *
 *  2. BOT STUCK           — bot_assigned or lobby_creating never progressed
 *     Threshold: botAssignedTimeoutMinutes (default 5 min from createdAt)
 *     Action: cancel with "bot failed to create lobby"
 *
 *  3. LOBBY OPEN (two-phase) — waiting for players after lobby was created
 *     Clock starts from lobbyCreatedAt (not createdAt), so lead time is excluded.
 *     - Warning phase: lobbyOpenWarningMinutes (default 15) → send chat countdown warning
 *     - Close phase:   lobbyOpenTimeoutMinutes (default 30) → cancel as no-show
 *
 *  4. READY CHECK STUCK   — both teams said !ready but game never launched
 *     Threshold: readyCheckTimeoutMinutes (default 10 min from ready_check state entry)
 *     Action: cancel with "match failed to start after ready check"
 *
 * Returns the number of sessions that were cancelled.
 */
async function enforceSessionTimeouts(
  db: FirebaseFirestore.Firestore
): Promise<number> {
  const watchedStates = [
    'pending',
    'bot_assigned',
    'lobby_creating',
    'lobby_open',
    'ready_check',
  ];

  const snapshot = await db
    .collection('botLobbySessions')
    .where('state', 'in', watchedStates)
    .get();

  if (snapshot.empty) return 0;

  const now = Date.now();
  let timedOut = 0;

  // Cache bot configs per tournament to avoid repeated Firestore reads
  const configCache = new Map<string, TournamentBotConfig | null>();
  async function getBotConfig(tournamentId: string): Promise<TournamentBotConfig | null> {
    if (configCache.has(tournamentId)) return configCache.get(tournamentId)!;
    try {
      const doc = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('config')
        .doc('bot')
        .get();
      const cfg = doc.exists ? (doc.data() as TournamentBotConfig) : null;
      configCache.set(tournamentId, cfg);
      return cfg;
    } catch {
      configCache.set(tournamentId, null);
      return null;
    }
  }

  for (const sessionDoc of snapshot.docs) {
    const session = sessionDoc.data() as LobbySession;
    const cfg = await getBotConfig(session.tournamentId);

    // ── Helper: send chat + leave, then cancel ──────────────────────────────
    async function cancelSession(reason: string, chatMsg: string): Promise<void> {
      if (session.botAccountId) {
        const queueRef = db
          .collection('botCommands')
          .doc(session.botAccountId)
          .collection('queue');
        try {
          await queueRef.add({
            botAccountId: session.botAccountId,
            command: { type: 'send_chat', sessionId: sessionDoc.id, message: chatMsg },
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
          await queueRef.add({
            botAccountId: session.botAccountId,
            command: { type: 'leave_lobby', sessionId: sessionDoc.id },
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
          await db.collection('botAccounts').doc(session.botAccountId).update({
            status: 'idle',
            currentSessionId: null,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error(`[Orchestrate] Failed to release bot for session ${sessionDoc.id}:`, err);
        }
      }
      await sessionDoc.ref.update({
        state: 'cancelled',
        updatedAt: new Date().toISOString(),
        cancelReason: reason,
        completedAt: new Date().toISOString(),
      });
      timedOut++;
      console.warn(`[Orchestrate] Cancelled session ${sessionDoc.id}: ${reason}`);
    }

    // ── 1. PENDING STUCK ────────────────────────────────────────────────────
    if (session.state === 'pending') {
      const pendingTimeoutMin = cfg?.pendingSessionTimeoutMinutes ?? 20;
      const elapsedMin = (now - new Date(session.createdAt).getTime()) / 60000;
      if (elapsedMin >= pendingTimeoutMin) {
        await cancelSession(
          `No bot was available for ${Math.round(elapsedMin)} minutes`,
          '[BOT] This lobby could not be opened — no bot account was available. Please contact an admin.'
        );
      }
      continue;
    }

    // ── 2. BOT STUCK (bot_assigned / lobby_creating) ────────────────────────
    if (session.state === 'bot_assigned' || session.state === 'lobby_creating') {
      const stuckTimeoutMin = cfg?.botAssignedTimeoutMinutes ?? 5;
      const elapsedMin = (now - new Date(session.createdAt).getTime()) / 60000;
      if (elapsedMin >= stuckTimeoutMin) {
        await cancelSession(
          `Bot was assigned but failed to create the lobby after ${Math.round(elapsedMin)} minutes`,
          '[BOT] Failed to create the lobby. Please contact an admin to reschedule.'
        );
      }
      continue;
    }

    // ── 3. LOBBY OPEN — two-phase timeout (clock from lobbyCreatedAt) ────────
    if (session.state === 'lobby_open') {
      // If lobbyCreatedAt is missing fall back to createdAt
      const lobbyOpenAt = session.lobbyCreatedAt
        ? new Date(session.lobbyCreatedAt).getTime()
        : new Date(session.createdAt).getTime();

      const elapsedMin = (now - lobbyOpenAt) / 60000;

      // Compat: honour lobbyTimeoutMinutes if set (old configs)
      const closeMin = cfg?.lobbyOpenTimeoutMinutes ?? cfg?.lobbyTimeoutMinutes ?? 30;
      const warnMin = cfg?.lobbyOpenWarningMinutes ?? 15;

      // Phase 2 — close (hard timeout)
      if (elapsedMin >= closeMin) {
        await cancelSession(
          `Lobby no-show: players did not fill within ${Math.round(elapsedMin)} minutes`,
          `[BOT] Lobby closed — the required players did not join within ${Math.round(closeMin)} minutes. Admin has been notified.`
        );
        continue;
      }

      // Phase 1 — warning (only once; skip if warning already sent)
      if (
        warnMin > 0 &&
        elapsedMin >= warnMin &&
        !session.timeoutWarningSentAt
      ) {
        const remainingMin = Math.round(closeMin - elapsedMin);
        if (session.botAccountId) {
          try {
            await db
              .collection('botCommands')
              .doc(session.botAccountId)
              .collection('queue')
              .add({
                botAccountId: session.botAccountId,
                command: {
                  type: 'send_chat',
                  sessionId: sessionDoc.id,
                  message: `[BOT] Warning: not all players have joined. The lobby will close in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''} if the roster is not full.`,
                },
                status: 'pending',
                createdAt: new Date().toISOString(),
              });
          } catch (err) {
            console.error(`[Orchestrate] Failed to send warning for session ${sessionDoc.id}:`, err);
          }
        }
        await sessionDoc.ref.update({
          timeoutWarningSentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(`[Orchestrate] Sent timeout warning for session ${sessionDoc.id} (${Math.round(elapsedMin)}min elapsed, closes at ${closeMin}min)`);
      }
      continue;
    }

    // ── 4. READY CHECK STUCK ─────────────────────────────────────────────────
    if (session.state === 'ready_check') {
      // Clock from when the session last updated into ready_check — approximate
      // with `createdAt` since we don't store readyCheckStartedAt yet
      const readyCheckTimeoutMin = cfg?.readyCheckTimeoutMinutes ?? 10;
      const elapsedMin = (now - new Date(session.createdAt).getTime()) / 60000;
      if (elapsedMin >= readyCheckTimeoutMin) {
        await cancelSession(
          `Stuck in ready_check for ${Math.round(elapsedMin)} minutes without the game launching`,
          '[BOT] The match did not start after the ready check. Lobby closed. Please contact an admin.'
        );
      }
      continue;
    }
  }

  return timedOut;
}
