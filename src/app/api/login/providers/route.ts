/** Which sign-in options are switched on (Discord needs its app credentials in the environment) */

import { NextResponse } from 'next/server';
import { discordConfigured } from '@/server/accounts/identity';

export const dynamic = 'force-dynamic';

/** A bot token starts with the bot's ID (= its application ID) in base64, so the ID need not be set separately */
function botIdFromToken(token?: string): string | null {
  const head = token?.split('.')[0];
  if (!head) return null;
  try { const id = Buffer.from(head.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); return /^\d{15,22}$/.test(id) ? id : null; } catch { return null; }
}

export function GET() {
  const bot = process.env.DISCORD_BOT_CLIENT_ID || botIdFromToken(process.env.DISCORD_BOT_TOKEN);
  // View channels + send messages + embed links (for notifications); membership checks need no permission
  const botInvite = bot ? `https://discord.com/oauth2/authorize?client_id=${bot}&scope=bot&permissions=19456` : null;
  return NextResponse.json({ discord: discordConfigured(), google: true, botInvite });
}
