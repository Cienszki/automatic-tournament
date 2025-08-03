import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../../server/lib/admin';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'No token provided' }, { status: 401 });
    }

    // Verify admin status
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { matchId, seriesFormat } = body;

    if (!matchId || !seriesFormat) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: matchId and seriesFormat' 
      }, { status: 400 });
    }

    // Validate series format
    const validFormats = ['bo1', 'bo2', 'bo3', 'bo5'];
    if (!validFormats.includes(seriesFormat)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid series format. Must be one of: bo1, bo2, bo3, bo5' 
      }, { status: 400 });
    }

    // Update the match document
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);
    
    // Check if match exists
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Match not found' 
      }, { status: 404 });
    }

    // Update the series format
    await matchRef.update({
      series_format: seriesFormat,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      message: `Match format updated to ${seriesFormat.toUpperCase()}` 
    });

  } catch (error) {
    console.error("Error updating match format:", error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
