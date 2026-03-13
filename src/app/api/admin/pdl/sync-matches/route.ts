// src/app/api/admin/pdl/sync-matches/route.ts
import { NextResponse } from 'next/server';
import { syncPDLMatchesAdmin } from '@/lib/pdl-admin-actions';
import { getAdminAuth, getAdminDb, ensureAdminInitialized } from '../../../../../../server/lib/admin';

/**
 * POST /api/admin/pdl/sync-matches
 * 
 * Sync all new matches from Steam/OpenDota APIs for PDL tournament.
 * Requires a valid Firebase ID token from a super admin or tournament admin.
 * 
 * Request body:
 * {
 *   "tournamentId": "pdl-s1" // Optional, defaults to "pdl-s1"
 * }
 */
export async function POST(req: Request) {
    try {
        // --- Verify admin authorization via Firebase Admin SDK ---
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized — missing Bearer token' },
                { status: 401 }
            );
        }

        const idToken = authHeader.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized — empty token' },
                { status: 401 }
            );
        }

        ensureAdminInitialized();
        const decodedToken = await getAdminAuth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Parse request body (needs to happen before admin check so we have tournamentId)
        const body = await req.json().catch(() => ({}));
        const tournamentId: string = body.tournamentId || 'pdl-s1';

        // Check super admin
        const superAdminDoc = await getAdminDb().collection('admins').doc(uid).get();
        const isSuperAdmin = superAdminDoc.exists;

        // Check tournament-specific admin
        let isTournamentAdmin = false;
        if (!isSuperAdmin) {
            const tournamentAdminDoc = await getAdminDb()
                .collection('tournaments')
                .doc(tournamentId)
                .collection('admins')
                .doc(uid)
                .get();
            isTournamentAdmin = tournamentAdminDoc.exists;
        }

        if (!isSuperAdmin && !isTournamentAdmin) {
            return NextResponse.json(
                { success: false, error: 'Forbidden — admin access required' },
                { status: 403 }
            );
        }

        console.log(`[API] PDL sync triggered by admin ${uid} for tournament: ${tournamentId}`);

        // Execute sync
        const result = await syncPDLMatchesAdmin(tournamentId);

        return NextResponse.json(result, {
            status: result.success ? 200 : 500
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Sync failed';
        console.error('[API] PDL sync error:', error);
        return NextResponse.json(
            {
                success: false,
                error: message,
                importedCount: 0
            },
            { status: 500 }
        );
    }
}
