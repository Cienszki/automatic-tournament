// src/app/api/admin-sync-matches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, ensureAdminInitialized } from '@/server/lib/admin';
import { checkRateLimit, LIMIT_ADMIN_SYNC } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimitRes = checkRateLimit(req, 'admin-sync-matches', LIMIT_ADMIN_SYNC);
  if (rateLimitRes) return rateLimitRes;

  // Require admin authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    ensureAdminInitialized();
    await getAdminAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  try {
    // Import the sync function only on server side
    const { syncLeagueMatchesAdmin } = await import('@/lib/admin-actions');
    const result = await syncLeagueMatchesAdmin();

    // After a successful sync that imported new matches, refresh performance rankings.
    // The caller may pass tournamentId in the request body to enable this.
    const body = await req.json().catch(() => ({}));
    const tournamentId = body?.tournamentId as string | undefined;
    if (result.success && result.importedCount > 0 && tournamentId) {
      try {
        const { recalculatePerformanceRankings } = await import('@/lib/performance-rankings-calculator');
        await recalculatePerformanceRankings(tournamentId);
        console.log('[admin-sync-matches] Performance rankings refreshed after sync');
      } catch (rankingsErr) {
        console.error('[admin-sync-matches] Rankings refresh failed (non-fatal):', rankingsErr);
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('API sync error:', error);
    return NextResponse.json({ success: false, error: (error as Error)?.message || 'Sync failed.' }, { status: 500 });
  }
}
