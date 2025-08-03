import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../../server/lib/admin';
import { headers } from 'next/headers';
import { adminDeleteGameAndHandleScore } from '@/lib/admin-match-actions-server';
import type { Match } from '@/lib/definitions';

export async function DELETE(request: Request) {
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
    const { match, gameId } = body;

    if (!match || !gameId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: match and gameId' 
      }, { status: 400 });
    }

    // Call the admin function
    const result = await adminDeleteGameAndHandleScore(match as Match, gameId);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error deleting game:", error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
