// src/app/api/admin-import-manual-matches/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../server/lib/admin';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    ensureAdminInitialized();
    
    // Check authentication
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
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { matchIds } = body;

    // Validate input
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid match IDs provided. Expected non-empty array.' 
      }, { status: 400 });
    }

    // Convert to numbers and validate
    const numericMatchIds = matchIds.map(id => {
      const num = Number(id);
      if (isNaN(num) || num <= 0) {
        throw new Error(`Invalid match ID: ${id}`);
      }
      return num;
    });

    // Import the manual import function
    const { importManualMatchesAdmin } = await import('@/lib/admin-actions');
    const result = await importManualMatchesAdmin(numericMatchIds);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API manual import error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Manual import failed.' 
    }, { status: 500 });
  }
}
