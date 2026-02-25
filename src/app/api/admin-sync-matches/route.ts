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
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('API sync error:', error);
    return NextResponse.json({ success: false, error: (error as Error)?.message || 'Sync failed.' }, { status: 500 });
  }
}
