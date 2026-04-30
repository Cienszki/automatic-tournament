import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '@/lib/admin';
import { recalculateMatchScoresAdmin } from '@/lib/admin-match-actions-server';
import { checkRateLimit, LIMIT_MATCH_IMPORT } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'recalculate-match', LIMIT_MATCH_IMPORT);
  if (rateLimitRes) return rateLimitRes;

  // Require admin authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    ensureAdminInitialized();
    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    if (!adminDoc.exists) {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  try {
    const { matchId } = await request.json();
    
    if (!matchId) {
      return NextResponse.json({ 
        success: false, 
        error: 'matchId is required' 
      }, { status: 400 });
    }

    // Recalculate match scores and update standings
    await recalculateMatchScoresAdmin(matchId);
    
    return NextResponse.json({ 
      success: true, 
      message: `Match ${matchId} scores and standings recalculated successfully` 
    });
  } catch (error) {
    console.error('Error recalculating match:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
