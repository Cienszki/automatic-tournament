// src/app/api/admin/ban-team/route.ts
import { NextResponse } from 'next/server';
import { banTeamAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/ban-team
 *
 * Permanently bans a team from a tournament:
 * - Sets team status to 'banned'
 * - Converts all past matches to full-series forfeits (deletes game data so
 *   player stats are not affected, adds game IDs to skippedGames)
 * - Converts all future scheduled matches to full-series forfeits
 * - Marks affected matches with isBanForfeit: true so the schedule hides them
 * - Recalculates standings for all affected divisions
 *
 * Body: { tournamentId, teamId, reason?, adminUserId? }
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const {
            tournamentId,
            teamId,
            reason = 'Cheating',
            adminUserId = 'admin',
        } = body;

        if (!tournamentId || !teamId) {
            return NextResponse.json(
                { success: false, error: 'tournamentId and teamId are required' },
                { status: 400 },
            );
        }

        const result = await banTeamAdmin(tournamentId, teamId, reason, adminUserId);

        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Ban failed';
        console.error('[API] ban-team error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
