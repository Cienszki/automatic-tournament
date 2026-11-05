// Discord at team registration: the captain's Discord name comes from their linked account (no more
// typos to fix by hand), and an organizer may require captains to be on the tournament's server.

import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { discordMember } from './identity';
import { getAccount } from './store';

export async function captainDiscord(uid: string, tournamentId: string): Promise<{ username?: string } | { error: string }> {
  ensureAdminInitialized();
  const [acc, t] = await Promise.all([getAccount(uid), getAdminDb().collection('tournaments').doc(tournamentId).get()]);
  const server = t.data()?.discordServer as { guildId?: string; requireMember?: boolean } | undefined;
  const invite = t.data()?.discordUrl as string | undefined;
  if (server?.requireMember && server.guildId) {
    if (!acc.discord) return { error: 'Ten turniej wymaga połączenia konta z Discordem. Połącz je na stronie Konto i spróbuj ponownie.' };
    const member = await discordMember(server.guildId, acc.discord.id);
    if (member === false) return { error: `Dołącz do serwera Discord turnieju${invite ? ` (${invite})` : ''} i spróbuj ponownie.` };
    if (member === null) console.warn(`[register] cannot check Discord membership for ${tournamentId} (bot not on the server or no DISCORD_BOT_TOKEN)`);
  }
  return acc.discord ? { username: acc.discord.username } : {};
}
