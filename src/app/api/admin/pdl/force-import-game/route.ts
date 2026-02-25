// src/app/api/admin/pdl/force-import-game/route.ts
import { NextResponse } from 'next/server';
import { forceImportGameAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/force-import-game
 *
 * Force-import an OpenDota game into a specific tournament match,
 * bypassing lobby name matching. Used when a captain used the wrong team name.
 *
 * Body:
 * {
 *   tournamentId: string,
 *   openDotaGameId: number,
 *   tournamentMatchId: string,
 *   radiantTeamId: string,
 *   direTeamId: string
 * }
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { tournamentId, openDotaGameId, tournamentMatchId, radiantTeamId, direTeamId } = body;

        if (!tournamentId || !openDotaGameId || !tournamentMatchId || !radiantTeamId || !direTeamId) {
            return NextResponse.json(
                { success: false, error: 'tournamentId, openDotaGameId, tournamentMatchId, radiantTeamId and direTeamId are all required' },
                { status: 400 }
            );
        }

        const result = await forceImportGameAdmin(
            tournamentId,
            Number(openDotaGameId),
            tournamentMatchId,
            radiantTeamId,
            direTeamId
        );

        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: any) {
        console.error('[API] force-import-game error:', error);
        return NextResponse.json({ success: false, error: error?.message || 'Force import failed' }, { status: 500 });
    }
}
