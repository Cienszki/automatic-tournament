// src/app/api/admin/pdl/revert-forfeit/route.ts
import { NextResponse } from 'next/server';
import { revertPDLForfeitAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/revert-forfeit
 *
 * Reverts a previously recorded forfeit/walkover for a PDL match.
 *
 * Full-series walkovers: scores reset to 0-0, status back to 'scheduled'.
 * Game-level forfeits:   synthetic forfeit_game* documents deleted, series
 *                        score recalculated from real games.
 *
 * Body: { tournamentId: string, matchId: string }
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { tournamentId, matchId } = body;

        if (!tournamentId || !matchId) {
            return NextResponse.json(
                { success: false, error: 'tournamentId and matchId are required' },
                { status: 400 },
            );
        }

        const result = await revertPDLForfeitAdmin(tournamentId, matchId);

        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Revert forfeit failed';
        console.error('[API] revert-forfeit error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
