/** Which sign-in options are switched on (Discord needs its app credentials in the environment) */

import { NextResponse } from 'next/server';
import { discordConfigured } from '@/server/accounts/identity';

export const dynamic = 'force-dynamic';

export function GET() {
  const bot = process.env.DISCORD_BOT_CLIENT_ID;
  // View channels + send messages + embed links (for notifications); membership checks need no permission
  const botInvite = bot ? `https://discord.com/oauth2/authorize?client_id=${bot}&scope=bot&permissions=19456` : null;
  return NextResponse.json({ discord: discordConfigured(), google: true, botInvite });
}
