// src/app/api/admin/pdl/delete-game/route.ts
import { NextResponse } from 'next/server';
import { deleteGameFromPDLMatchAdmin } from '@/lib/pdl-admin-actions';

/**
 * DELETE /api/admin/pdl/delete-game
 *
 * Removes a single game from a PDL match and clears it from processedGames,
 * allowing it to be force-imported again with correct team assignments.
 *
 * Body: { tournamentId, matchId, gameId }
 */
export async function DELETE(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { tournamentId, matchId, gameId } = body;

        if (!tournamentId || !matchId || !gameId) {
            return NextResponse.json(
                { success: false, error: 'tournamentId, matchId and gameId are required' },
                { status: 400 },
            );
        }

        const result = await deleteGameFromPDLMatchAdmin(
            tournamentId,
            matchId,
            String(gameId),
        );

        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Delete game failed';
        console.error('[API] delete-game error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
