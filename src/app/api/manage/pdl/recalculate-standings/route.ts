// src/app/api/manage/pdl/recalculate-standings/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { recalculateAllPDLDivisionStandingsAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/manage/pdl/recalculate-standings
 *
 * Recalculates division standings for all divisions in a tournament by
 * replaying every completed match from scratch. Idempotent and safe to run
 * multiple times.
 *
 * Body: { tournamentId: string }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { tournamentId } = body;

        if (!tournamentId) {
            return NextResponse.json(
                { success: false, error: 'tournamentId is required' },
                { status: 400 },
            );
        }

        const caller = await requireAdmin(req, tournamentId);
        if (caller instanceof NextResponse) return caller;

        const result = await recalculateAllPDLDivisionStandingsAdmin(tournamentId);

        return NextResponse.json(result, { status: result.success ? 200 : 500 });
    } catch (error: any) {
        console.error('[API] recalculate-standings error:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Recalculation failed' },
            { status: 500 },
        );
    }
}
