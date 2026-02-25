// src/app/api/admin/pdl/preview-game/route.ts
import { NextResponse } from 'next/server';
import { previewOpenDotaGameAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/preview-game
 *
 * Fetches an OpenDota game by ID and returns lobby names + basic data
 * so the admin can decide which tournament teams to assign before force-importing.
 *
 * Body: { tournamentId: string, openDotaGameId: number }
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { tournamentId, openDotaGameId } = body;

        if (!tournamentId || !openDotaGameId) {
            return NextResponse.json({ success: false, error: 'tournamentId and openDotaGameId are required' }, { status: 400 });
        }

        const result = await previewOpenDotaGameAdmin(tournamentId, Number(openDotaGameId));
        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: any) {
        console.error('[API] preview-game error:', error);
        return NextResponse.json({ success: false, error: error?.message || 'Preview failed' }, { status: 500 });
    }
}
