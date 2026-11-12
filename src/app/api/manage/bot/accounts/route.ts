// src/app/api/manage/bot/accounts/route.ts
// API routes for managing bot accounts (super admin level)

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { getAllBotAccounts, registerBotAccount } from '@/lib/bot/bot-config-actions';
import type { BotAccount } from '@/types/lobby-bot';

/** Safe bot account — never exposes encryptedPassword to the client */
export type SafeBotAccount = Omit<BotAccount, 'encryptedPassword'>;

function toSafe(account: BotAccount): SafeBotAccount {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedPassword, ...safe } = account;
  return safe;
}

/**
 * GET /api/manage/bot/accounts
 * Returns all registered bot accounts (passwords stripped).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    // Super admins only: these routes hand out and change the Steam accounts every lobby runs on.
    const caller = await requireAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const accounts = await getAllBotAccounts();
    return NextResponse.json({ accounts: accounts.map(toSafe) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot accounts GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/manage/bot/accounts
 * Register a new bot account.
 * Body: { username: string, password: string, displayName: string, notes?: string }
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Super admins only: these routes hand out and change the Steam accounts every lobby runs on.
    const caller = await requireAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const body = await req.json() as {
      username: string;
      password: string;
      displayName: string;
      notes?: string;
    };

    if (!body.username?.trim() || !body.password?.trim() || !body.displayName?.trim()) {
      return NextResponse.json(
        { error: 'username, password and displayName are required' },
        { status: 400 }
      );
    }

    // Encode password as base64 (matches what bot-worker expects)
    const encryptedPassword = Buffer.from(body.password, 'utf-8').toString('base64');

    const accountData: Parameters<typeof registerBotAccount>[0] = {
      username: body.username.trim(),
      encryptedPassword,
      steamId: '',
      steamId32: '',
      displayName: body.displayName.trim(),
      enabled: true,
    };
    if (body.notes?.trim()) {
      accountData.notes = body.notes.trim();
    }

    const result = await registerBotAccount(accountData);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot accounts POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
