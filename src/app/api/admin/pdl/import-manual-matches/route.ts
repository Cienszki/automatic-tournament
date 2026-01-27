// src/app/api/admin/pdl/import-manual-matches/route.ts
import { NextResponse } from 'next/server';
import { importPDLManualMatchesAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/import-manual-matches
 * 
 * Manually import specific match IDs for PDL tournament
 * 
 * Request body:
 * {
 *   "matchIds": [8431678099, 8431558092],
 *   "tournamentId": "pdl-s1" // Optional, defaults to "pdl-s1"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Manual import complete. Imported: 2, Skipped: 0, Failed: 0",
 *   "importedCount": 2,
 *   "skippedCount": 0,
 *   "failedCount": 0
 * }
 */
export async function POST(req: Request) {
    try {
        // Parse request body
        const body = await req.json();
        const { matchIds, tournamentId = 'pdl-s1' } = body;

        // Validate input
        if (!matchIds || !Array.isArray(matchIds) || matchIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'matchIds array is required' },
                { status: 400 }
            );
        }

        // Validate all match IDs are numbers
        const numericMatchIds = matchIds.map(id => {
            const num = Number(id);
            if (isNaN(num) || num <= 0) {
                throw new Error(`Invalid match ID: ${id}`);
            }
            return num;
        });

        console.log(`[API] PDL manual import triggered: ${numericMatchIds.length} matches for ${tournamentId}`);

        // Verify admin authorization
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Execute manual import
        const result = await importPDLManualMatchesAdmin(tournamentId, numericMatchIds);

        return NextResponse.json(result, {
            status: result.success ? 200 : 500
        });

    } catch (error: any) {
        console.error('[API] PDL manual import error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Manual import failed',
                importedCount: 0
            },
            { status: 500 }
        );
    }
}
