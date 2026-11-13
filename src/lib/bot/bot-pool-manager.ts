// src/lib/bot/bot-pool-manager.ts
// Bot pool status for the admin bot tab (api/manage/bot/pool-status).

import type { BotAccount } from '@/types/lobby-bot';

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
