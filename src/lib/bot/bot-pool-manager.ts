// src/lib/bot/bot-pool-manager.ts
// Bot Pool Manager — assigns bot accounts to lobby sessions
// Handles the constraint that each Dota 2 client can only manage one lobby at a time.
// When scaling, multiple bot accounts run as separate processes/containers.

import {
  getAvailableBotAccounts,
  updateBotAccountStatus,
  getPendingLobbySessions,
  updateLobbySession,
  getTournamentBotConfig,
} from './bot-config-actions';
import type { BotAccount, LobbySession } from '@/types/lobby-bot';

/**
 * Result of an assignment attempt
 */
export interface AssignmentResult {
  sessionId: string;
  botAccountId: string | null;
  success: boolean;
  reason?: string;
}

/**
 * Attempt to assign available bot accounts to pending lobby sessions.
 * This is the core scheduling function called periodically by the orchestrator.
 *
 * Algorithm:
 * 1. Get all pending sessions (ordered by creation time)
 * 2. Get all available (idle) bot accounts
 * 3. For each pending session, assign the first available bot
 * 4. Mark bot as 'starting', mark session as 'bot_assigned'
 *
 * A single bot account can only handle ONE lobby at a time due to Dota 2 limitations.
 */
export async function assignBotsToSessions(): Promise<AssignmentResult[]> {
  const results: AssignmentResult[] = [];

  const [pendingSessions, availableBots] = await Promise.all([
    getPendingLobbySessions(),
    getAvailableBotAccounts(),
  ]);

  if (pendingSessions.length === 0) {
    return results;
  }

  if (availableBots.length === 0) {
    console.warn(
      `[BotPool] ${pendingSessions.length} pending sessions but no available bots`
    );
    for (const session of pendingSessions) {
      results.push({
        sessionId: session.id,
        botAccountId: null,
        success: false,
        reason: 'No available bot accounts',
      });
    }
    return results;
  }

  // Assign bots to sessions (first-come, first-served)
  const botsToAssign = [...availableBots];

  for (const session of pendingSessions) {
    if (botsToAssign.length === 0) {
      results.push({
        sessionId: session.id,
        botAccountId: null,
        success: false,
        reason: 'No more available bot accounts',
      });
      continue;
    }

    // Check if bot system is enabled for this tournament
    const botConfig = await getTournamentBotConfig(session.tournamentId);
    if (!botConfig?.enabled) {
      results.push({
        sessionId: session.id,
        botAccountId: null,
        success: false,
        reason: 'Bot system disabled for tournament',
      });
      continue;
    }

    const bot = botsToAssign.shift()!;

    try {
      // Claim the bot for this session
      await Promise.all([
        updateBotAccountStatus(
          bot.id,
          'starting',
          session.matchId,
          session.tournamentId
        ),
        updateLobbySession(session.id, {
          state: 'bot_assigned',
          botAccountId: bot.id,
        }),
      ]);

      results.push({
        sessionId: session.id,
        botAccountId: bot.id,
        success: true,
      });

      console.log(
        `[BotPool] Assigned bot ${bot.displayName} (${bot.id}) to session ${session.id} (match: ${session.matchId})`
      );
    } catch (error) {
      console.error(
        `[BotPool] Failed to assign bot ${bot.id} to session ${session.id}:`,
        error
      );
      // Put bot back in the available pool for this round
      botsToAssign.push(bot);
      results.push({
        sessionId: session.id,
        botAccountId: bot.id,
        success: false,
        reason: error instanceof Error ? error.message : 'Assignment failed',
      });
    }
  }

  return results;
}

/**
 * Release a bot account after its session is done.
 * Called when a session reaches 'completed', 'cancelled', or 'error' state.
 */
export async function releaseBot(botAccountId: string): Promise<void> {
  await updateBotAccountStatus(botAccountId, 'idle', null, null);
  console.log(`[BotPool] Released bot ${botAccountId} back to idle pool`);
}

/**
 * Health check — find bot accounts that have been in a non-idle state
 * for too long without a heartbeat. Mark them as offline and release.
 */
export async function healthCheckBots(
  staleThresholdMinutes: number = 30
): Promise<string[]> {
  const { getAdminDb } = await import('@/server/lib/admin');
  const db = getAdminDb();

  const staleThreshold = new Date(
    Date.now() - staleThresholdMinutes * 60 * 1000
  ).toISOString();

  // Find bots that aren't idle but have an old heartbeat
  const snapshot = await db
    .collection('botAccounts')
    .where('enabled', '==', true)
    .where('status', '!=', 'idle')
    .get();

  const staleBotIds: string[] = [];

  for (const doc of snapshot.docs) {
    const bot = doc.data() as BotAccount;
    if (
      bot.status !== 'offline' &&
      bot.lastHeartbeat &&
      bot.lastHeartbeat < staleThreshold
    ) {
      console.warn(
        `[BotPool] Bot ${doc.id} (${bot.displayName}) is stale. Last heartbeat: ${bot.lastHeartbeat}`
      );
      await updateBotAccountStatus(doc.id, 'offline', null, null);
      staleBotIds.push(doc.id);

      // If it was assigned to a session, mark that session as error
      if (bot.currentMatchId) {
        const sessions = await import('./bot-config-actions').then((m) =>
          m.getLobbySessionsForMatch(bot.currentMatchId!)
        );
        for (const session of sessions) {
          if (
            session.botAccountId === doc.id &&
            !['completed', 'cancelled', 'error'].includes(session.state)
          ) {
            await updateLobbySession(session.id, {
              state: 'error',
              error: {
                message: `Bot account became unresponsive (no heartbeat for ${staleThresholdMinutes} minutes)`,
                code: 'BOT_STALE',
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }
    }
  }

  return staleBotIds;
}

/**
 * Get a summary of the bot pool status
 */
export async function getBotPoolStatus(): Promise<{
  total: number;
  idle: number;
  active: number;
  offline: number;
  error: number;
  pendingSessions: number;
  activeSessions: number;
}> {
  const { getAdminDb } = await import('@/server/lib/admin');
  const { getActiveLobbySessions, getPendingLobbySessions: getPending } =
    await import('./bot-config-actions');
  const db = getAdminDb();

  const [botsSnapshot, activeSessions, pendingSessions] = await Promise.all([
    db.collection('botAccounts').get(),
    getActiveLobbySessions(),
    getPending(),
  ]);

  const bots = botsSnapshot.docs.map((d) => d.data() as BotAccount);

  return {
    total: bots.length,
    idle: bots.filter((b) => b.status === 'idle' && b.enabled).length,
    active: bots.filter(
      (b) => !['idle', 'offline', 'error'].includes(b.status) && b.enabled
    ).length,
    offline: bots.filter((b) => b.status === 'offline' || !b.enabled).length,
    error: bots.filter((b) => b.status === 'error').length,
    pendingSessions: pendingSessions.length,
    activeSessions: activeSessions.length,
  };
}
