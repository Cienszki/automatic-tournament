// src/app/api/manage/pdl/preview-game/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { previewOpenDotaGameAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/manage/pdl/preview-game
 *
 * Fetches an OpenDota game by ID and returns lobby names + basic data
 * so the admin can decide which tournament teams to assign before force-importing.
 *
 * Body: { tournamentId: string, openDotaGameId: number }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { tournamentId, openDotaGameId } = body;

        if (!tournamentId || !openDotaGameId) {
            return NextResponse.json({ success: false, error: 'tournamentId and openDotaGameId are required' }, { status: 400 });
        }

        const caller = await requireAdmin(req, tournamentId);
        if (caller instanceof NextResponse) return caller;

        const result = await previewOpenDotaGameAdmin(tournamentId, Number(openDotaGameId));
        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: any) {
        console.error('[API] preview-game error:', error);
        return NextResponse.json({ success: false, error: error?.message || 'Preview failed' }, { status: 500 });
    }
}
