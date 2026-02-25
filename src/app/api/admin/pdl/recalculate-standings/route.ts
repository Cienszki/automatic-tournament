// src/app/api/admin/pdl/recalculate-standings/route.ts
import { NextResponse } from 'next/server';
import { recalculateAllPDLDivisionStandingsAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/recalculate-standings
 *
 * Recalculates division standings for all divisions in a tournament by
 * replaying every completed match from scratch. Idempotent and safe to run
 * multiple times.
 *
 * Body: { tournamentId: string }
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { tournamentId } = body;

        if (!tournamentId) {
            return NextResponse.json(
                { success: false, error: 'tournamentId is required' },
                { status: 400 },
            );
        }

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
