// src/app/api/admin/pdl/sync-matches/route.ts
import { NextResponse } from 'next/server';
import { syncPDLMatchesAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/sync-matches
 * 
 * Sync all new matches from Steam/OpenDota APIs for PDL tournament
 * 
 * Request body:
 * {
 *   "tournamentId": "pdl-s1" // Optional, defaults to "pdl-s1"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Sync complete. Imported: 5, Skipped: 2, Unparsed: 1, Failed: 0",
 *   "importedCount": 5,
 *   "skippedCount": 2,
 *   "unparsedCount": 1,
 *   "failedCount": 0
 * }
 */
export async function POST(req: Request) {
    try {
        // Parse request body
        const body = await req.json().catch(() => ({}));
        const tournamentId = body.tournamentId || 'pdl-s1';

        console.log(`[API] PDL sync triggered for tournament: ${tournamentId}`);

        // Verify admin authorization (simplified for now)
        // TODO: Add proper admin token verification
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Execute sync
        const result = await syncPDLMatchesAdmin(tournamentId);

        return NextResponse.json(result, {
            status: result.success ? 200 : 500
        });

    } catch (error: any) {
        console.error('[API] PDL sync error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Sync failed',
                importedCount: 0
            },
            { status: 500 }
        );
    }
}
