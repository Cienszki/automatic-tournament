// src/app/api/admin/bot/orchestrate/route.ts
// Match-sync endpoint — called periodically (Vercel Cron) or manually by an admin.
//
// SCOPE AFTER THE MEEPOW-STYLE REBUILD (see bot-worker/REBUILD_PLAN.md):
// Scheduling, bot assignment, the live lobby lifecycle (events/ready/enforcement/
// late-arrival), session timeouts, and bot health are now ALL owned by the always-on
// Conductor + per-session Runners on Railway. This route does ONLY the one piece that
// can't move out of Next.js: the post-match OpenDota import + standings sync. The Runner
// enqueues a `botSyncTasks` doc on game-end; this endpoint drains those tasks.
//
// IMPORTANT: do NOT re-introduce scheduleUpcomingMatches / assignBotsToSessions /
// driveActiveSessions / processUnhandledBotEvents / processLateArrival / health checks
// here — running them alongside the Conductor double-schedules and double-assigns.

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';
import { forceImportGameAdmin } from '@/lib/pdl-admin-actions';
import type { LobbySession } from '@/types/lobby-bot';

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

/**
 * Executes pending match sync tasks that have passed their scheduled time.
 * Returns the number of sync tasks executed.
 *
 * Tasks are written by the Lobby Runner on game-end (bot-worker/dist/runner.js
 * scheduleMatchSync). Each carries the Dota match id + the lobby session it came from,
 * which resolves the Radiant/Dire team ids for the import.
 */
async function executePendingSyncTasks(
  db: FirebaseFirestore.Firestore
): Promise<number> {
  const now = new Date().toISOString();

  const tasksSnapshot = await db
    .collection('botSyncTasks')
    .where('status', '==', 'pending')
    .where('syncAt', '<=', now)
    .limit(10)
    .get();

  let executed = 0;

  for (const taskDoc of tasksSnapshot.docs) {
    const task = taskDoc.data() as {
      tournamentId: string;
      matchId: string;
      sessionId: string;
      dotaMatchId: number;
      status: string;
    };

    try {
      await taskDoc.ref.update({ status: 'processing', startedAt: new Date().toISOString() });

      // Resolve radiant/dire team IDs from the lobby session
      const sessionDoc = await db.collection('botLobbySessions').doc(task.sessionId).get();
      if (!sessionDoc.exists) {
        throw new Error(`Lobby session ${task.sessionId} not found`);
      }
      const session = sessionDoc.data() as LobbySession;
      const radiantTeamId = session.radiantTeam.teamId;
      const direTeamId = session.direTeam.teamId;

      // Attempt the actual OpenDota import via the PDL pipeline
      // (uses tournaments/{id}/matches/ collection — correct for all tournaments)
      const result = await forceImportGameAdmin(
        task.tournamentId,
        task.dotaMatchId,
        task.matchId,
        radiantTeamId,
        direTeamId
      );

      if (!result.success && result.message.includes('not yet parsed')) {
        // OpenDota hasn't finished parsing — retry in 10 minutes
        const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await taskDoc.ref.update({ status: 'pending', syncAt: retryAt, lastRetryAt: now });
        console.log(`[SyncTasks] Game ${task.dotaMatchId} not yet parsed — scheduled retry at ${retryAt}`);
        continue;
      }

      if (!result.success) {
        throw new Error(result.message);
      }

      await taskDoc.ref.update({ status: 'completed', completedAt: new Date().toISOString() });
      console.log(`[SyncTasks] Synced game ${task.dotaMatchId} for match ${task.matchId}: ${result.message}`);
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
