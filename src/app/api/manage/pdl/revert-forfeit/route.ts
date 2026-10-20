// src/app/api/manage/pdl/revert-forfeit/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { revertPDLForfeitAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/manage/pdl/revert-forfeit
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
        const body = await req.json().catch(() => ({}));
        const { tournamentId, matchId } = body;

        if (!tournamentId || !matchId) {
            return NextResponse.json(
                { success: false, error: 'tournamentId and matchId are required' },
                { status: 400 },
            );
        }

        const caller = await requireAdmin(req, tournamentId);
        if (caller instanceof NextResponse) return caller;

        const result = await revertPDLForfeitAdmin(tournamentId, matchId);

        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Revert forfeit failed';
        console.error('[API] revert-forfeit error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
