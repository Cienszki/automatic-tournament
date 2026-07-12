// src/app/api/admin/bot/config/route.ts
// API route for getting and saving bot configuration per tournament

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';
import type { TournamentBotConfig } from '@/types/lobby-bot';
import { DEFAULT_TOURNAMENT_BOT_CONFIG } from '@/types/lobby-bot';

/**
 * GET /api/admin/bot/config?tournamentId=xxx
 * Returns the bot configuration for a tournament
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
    }

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

    const db = getAdminDb();
    const doc = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('config')
      .doc('bot')
      .get();

    const config = doc.exists
      ? (doc.data() as TournamentBotConfig)
      : DEFAULT_TOURNAMENT_BOT_CONFIG;

    return NextResponse.json({ config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot config GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/bot/config
 * Save/update bot configuration for a tournament
 *
 * Body: { tournamentId: string, config: TournamentBotConfig }
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Verify admin auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { tournamentId, config } = body as {
      tournamentId: string;
      config: TournamentBotConfig;
    };

    if (!tournamentId || !config) {
      return NextResponse.json(
        { error: 'tournamentId and config are required' },
        { status: 400 }
      );
    }

    // Validate config structure
    if (typeof config.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'config.enabled must be a boolean' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Verify the user is an admin for this tournament
    const [superAdminDoc, tournamentAdminDoc] = await Promise.all([
      db.collection('admins').doc(uid).get(),
      db.collection('tournaments').doc(tournamentId).collection('admins').doc(uid).get(),
    ]);

    if (!superAdminDoc.exists && !tournamentAdminDoc.exists) {
      return NextResponse.json({ error: 'Not an admin for this tournament' }, { status: 403 });
    }

    // Save config
    const updatedConfig: TournamentBotConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    };

    // The whitelist is managed exclusively by /api/admin/bot/whitelist (add/remove). The client's
    // `config` snapshot is loaded once and is NOT updated when an admin adds/removes a whitelist
    // entry, so writing it here would re-add entries the admin just deleted. Strip it — with
    // merge:true the stored whitelist field is left untouched.
    delete (updatedConfig as { whitelist?: unknown }).whitelist;

    await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('config')
      .doc('bot')
      .set(updatedConfig, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot config POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
