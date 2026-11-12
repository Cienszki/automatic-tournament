// src/app/api/manage/bot/pool-status/route.ts
// API route for fetching bot pool status overview

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { getBotPoolStatus } from '@/lib/bot/bot-pool-manager';

/**
 * GET /api/manage/bot/pool-status
 * Returns overall bot pool status (total, idle, active, offline, error counts).
 * Counts only, so an admin of the tournament in ?tournamentId= may read it too.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const tournamentId = new URL(req.url).searchParams.get('tournamentId');
    const caller = await requireAdmin(req, tournamentId);
    if (caller instanceof NextResponse) return caller;

    const status = await getBotPoolStatus();

    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot pool status GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
