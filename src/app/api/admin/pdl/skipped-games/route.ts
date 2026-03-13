// src/app/api/admin/pdl/skipped-games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
    getPDLSkippedGamesAdmin,
    markPDLGameAsSkippedAdmin,
    removePDLSkippedGameAdmin,
} from '@/lib/pdl-admin-actions';

/**
 * GET /api/admin/pdl/skipped-games?tournamentId=pdl-s1
 *
 * Returns the list of all skipped games for a tournament, newest first.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
        return NextResponse.json({ success: false, error: 'tournamentId is required' }, { status: 400 });
    }

    try {
        const games = await getPDLSkippedGamesAdmin(tournamentId);
        return NextResponse.json({ success: true, games });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch skipped games';
        console.error('[API] skipped-games GET error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

/**
 * POST /api/admin/pdl/skipped-games
 *
 * Manually mark a game as skipped. Also marks it as processed so the sync
 * won't attempt to import it again.
 *
 * Body: { tournamentId, gameId, reason? }
 */
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { tournamentId, gameId, reason } = body as { tournamentId?: string; gameId?: string; reason?: string };

    if (!tournamentId || !gameId) {
        return NextResponse.json(
            { success: false, error: 'tournamentId and gameId are required' },
            { status: 400 },
        );
    }

    // Accept full OpenDota URLs or raw IDs
    const numericId = String(gameId).replace(/.*\/matches\//, '').replace(/[^0-9]/g, '');
    if (!numericId) {
        return NextResponse.json({ success: false, error: 'Could not parse a numeric game ID' }, { status: 400 });
    }

    try {
        await markPDLGameAsSkippedAdmin(
            tournamentId,
            numericId,
            reason || 'Manually skipped by admin',
            'admin',
        );
        return NextResponse.json({ success: true, gameId: numericId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to skip game';
        console.error('[API] skipped-games POST error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/pdl/skipped-games
 *
 * Remove a game from the skipped list. Also removes it from processedGames
 * so the next auto-sync will re-import it automatically.
 *
 * Body: { tournamentId, gameId }
 */
export async function DELETE(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { tournamentId, gameId } = body as { tournamentId?: string; gameId?: string };

    if (!tournamentId || !gameId) {
        return NextResponse.json(
            { success: false, error: 'tournamentId and gameId are required' },
            { status: 400 },
        );
    }

    try {
        await removePDLSkippedGameAdmin(tournamentId, String(gameId));
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to remove skipped game';
        console.error('[API] skipped-games DELETE error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
