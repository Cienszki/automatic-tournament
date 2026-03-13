// src/app/api/admin/bot/pool-status/route.ts
// API route for fetching bot pool status overview

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/server/lib/admin';
import { getBotPoolStatus } from '@/lib/bot/bot-pool-manager';

/**
 * GET /api/admin/bot/pool-status
 * Returns overall bot pool status (total, idle, active, offline, error counts)
 */
export async function GET(req: Request): Promise<Response> {
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

    const status = await getBotPoolStatus();

    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot pool status GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
