// src/app/api/admin/bot/orchestrate/route.ts
// Post-match endpoint — POSTed every 5min by the Railway Conductor (CRON_SECRET) or manually
// by an admin.
//
// SCOPE AFTER THE MEEPOW-STYLE REBUILD (see bot-worker/REBUILD_PLAN.md):
// Scheduling, bot assignment, the live lobby lifecycle (events/ready/enforcement/
// late-arrival), session timeouts, and bot health are now ALL owned by the always-on
// Conductor + per-session Runners on Railway. This route does ONLY the pieces that must run
// in Next.js because they reuse the admin server actions: the post-match result sync and
// per-game forfeits. The Runner enqueues `botSyncTasks` docs ('sync' | 'forfeit') — the bot
// never writes match scores itself; this endpoint replays the SAME admin actions instead.
//
// IMPORTANT: do NOT re-introduce scheduleUpcomingMatches / assignBotsToSessions /
// driveActiveSessions / processUnhandledBotEvents / processLateArrival / health checks
// here — running them alongside the Conductor double-schedules and double-assigns.

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';
import { syncPDLMatchesAdmin, forfeitPDLMatchAdmin } from '@/lib/pdl-admin-actions';
import { recalculateAllStats } from '@/lib/stats-service-simple';

interface OrchestrateResult {
  syncTasksExecuted: number;
  errors: string[];
}

/**
 * POST /api/admin/bot/orchestrate
 * Drains pending botSyncTasks (post-match OpenDota import → standings).
 * Auth: a Firebase admin ID token, or the CRON_SECRET sent as a Bearer token by the
 * scheduled cron job (Google Cloud Scheduler) that hits this endpoint.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const cronSecret = process.env.CRON_SECRET;

    let authorized = false;
    if (cronSecret && token === cronSecret) {
      authorized = true;
    } else {
      try {
        await getAdminAuth().verifyIdToken(token);
        authorized = true;
      } catch {
        // Not a valid Firebase token
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const result: OrchestrateResult = { syncTasksExecuted: 0, errors: [] };
    const db = getAdminDb();

    try {
      result.syncTasksExecuted = await executePendingSyncTasks(db);
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
 * GET /api/admin/bot/orchestrate
 * Provided for schedulers that issue GET requests. Delegates to POST logic.
 */
export async function GET(req: Request): Promise<Response> {
  // The scheduled cron job (Google Cloud Scheduler) sends Authorization: Bearer {CRON_SECRET}
  return POST(req);
}

interface BotSyncTask {
  type?: 'sync' | 'forfeit';
  tournamentId: string;
  matchId: string;
  sessionId: string;
  // sync tasks
  dotaMatchId?: number;
  // forfeit tasks
  forfeitingTeamId?: string;
  forfeitedGameNumbers?: number[];
  reason?: string;
  status: string;
}

/**
 * Drains pending botSyncTasks written by the Lobby Runner and runs the EXACT SAME admin
 * actions a human operator would — the bot never writes match scores itself:
 *
 *  - type 'forfeit' → forfeitPDLMatchAdmin(matchId, teamA|teamB, [gameNumbers]) — per-game
 *    walkover, identical to the admin's manual game-level forfeit.
 *  - type 'sync' (default) → after each game, run the "Synchronizuj mecze" flow once per
 *    tournament: syncPDLMatchesAdmin (imports new games from the league + recalcs standings)
 *    then recalculateAllStats. A game still unparsed by OpenDota leaves its task pending for a
 *    +10min retry, so the final game of a series is eventually imported with no further trigger.
 *
 * Returns the number of tasks completed this run.
 */
async function executePendingSyncTasks(
  db: FirebaseFirestore.Firestore
): Promise<number> {
  const now = new Date().toISOString();

  const tasksSnapshot = await db
    .collection('botSyncTasks')
    .where('status', '==', 'pending')
    .where('syncAt', '<=', now)
    .limit(25)
    .get();

  if (tasksSnapshot.empty) return 0;

  let executed = 0;
  const syncTasks: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  // ── Pass 1: forfeits (per game, via the same admin action) ──────────────────
  for (const taskDoc of tasksSnapshot.docs) {
    const task = taskDoc.data() as BotSyncTask;
    if (task.type !== 'forfeit') { syncTasks.push(taskDoc); continue; }

    try {
      await taskDoc.ref.update({ status: 'processing', startedAt: new Date().toISOString() });

      const forfeitingTeam = await resolveForfeitingTeamSlot(db, task);
      const result = await forfeitPDLMatchAdmin(
        task.tournamentId,
        task.matchId,
        forfeitingTeam,
        (task.forfeitedGameNumbers ?? []).map(Number).filter((n) => !isNaN(n)),
        task.reason || 'Bot-recorded forfeit (late-arrival vote)',
        'bot',
      );
      if (!result.success) throw new Error(result.message);

      await taskDoc.ref.update({ status: 'completed', completedAt: new Date().toISOString() });
      console.log(`[SyncTasks] Forfeit recorded for match ${task.matchId}: ${result.message}`);
      executed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await taskDoc.ref.update({ status: 'failed', error: msg, failedAt: new Date().toISOString() });
    }
  }

  // ── Pass 2: result sync — run the button flow ONCE per distinct tournament ───
  const tournamentIds = [...new Set(syncTasks.map((d) => (d.data() as BotSyncTask).tournamentId))];
  const syncOutcome = new Map<string, boolean>(); // tournamentId → sync succeeded
  for (const tournamentId of tournamentIds) {
    try {
      const result = await syncPDLMatchesAdmin(tournamentId);
      // syncPDLMatchesAdmin recalculates standings internally; finish with the stats recalc
      // so the result mirrors the admin's "Synchronizuj mecze" + post-sync recalculation.
      await recalculateAllStats(tournamentId);
      syncOutcome.set(tournamentId, result.success);
      console.log(`[SyncTasks] Synced tournament ${tournamentId}: ${result.message}`);
    } catch (err: unknown) {
      syncOutcome.set(tournamentId, false);
      console.error(`[SyncTasks] Sync failed for tournament ${tournamentId}:`, err);
    }
  }

  // ── Resolve each sync task: completed if its game is now imported, else retry in 10min ──
  for (const taskDoc of syncTasks) {
    const task = taskDoc.data() as BotSyncTask;
    const ok = syncOutcome.get(task.tournamentId);
    try {
      if (ok && (await isGameImported(db, task))) {
        await taskDoc.ref.update({ status: 'completed', completedAt: new Date().toISOString() });
        executed++;
      } else {
        // Not imported yet (OpenDota still parsing) or the sync errored — retry shortly.
        const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await taskDoc.ref.update({ status: 'pending', syncAt: retryAt, lastRetryAt: now });
        console.log(`[SyncTasks] Game ${task.dotaMatchId} for match ${task.matchId} not imported yet — retry at ${retryAt}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await taskDoc.ref.update({ status: 'failed', error: msg, failedAt: new Date().toISOString() });
    }
  }

  return executed;
}

/** Map a forfeit task's forfeitingTeamId to the match's teamA/teamB slot. */
async function resolveForfeitingTeamSlot(
  db: FirebaseFirestore.Firestore,
  task: BotSyncTask,
): Promise<'teamA' | 'teamB'> {
  const matchDoc = await db.collection('tournaments').doc(task.tournamentId)
    .collection('matches').doc(task.matchId).get();
  if (!matchDoc.exists) throw new Error(`Match ${task.matchId} not found`);
  const m = matchDoc.data()!;
  const teamAId: string = m.teams?.[0] ?? m.teamA?.id;
  const teamBId: string = m.teams?.[1] ?? m.teamB?.id;
  if (task.forfeitingTeamId === teamAId) return 'teamA';
  if (task.forfeitingTeamId === teamBId) return 'teamB';
  throw new Error(`Forfeiting team ${task.forfeitingTeamId} is not in match ${task.matchId} (${teamAId} / ${teamBId})`);
}

/** True once the synced game has been written into its match's games subcollection. */
async function isGameImported(
  db: FirebaseFirestore.Firestore,
  task: BotSyncTask,
): Promise<boolean> {
  if (!task.dotaMatchId) return true; // nothing to verify
  const gameDoc = await db.collection('tournaments').doc(task.tournamentId)
    .collection('matches').doc(task.matchId)
    .collection('games').doc(String(task.dotaMatchId)).get();
  return gameDoc.exists;
}
