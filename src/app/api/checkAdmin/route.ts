
// src/app/api/checkAdmin/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../server/lib/admin';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    ensureAdminInitialized(); // Ensure initialized at the start of the request
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ isAdmin: false, error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ isAdmin: false, error: 'No token provided' }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    
    // Check if user is a super admin (global admin)
    const superAdminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    const isSuperAdmin = superAdminDoc.exists;
    
    // If checking for a specific tournament, also check tournament-specific admin
    const { tournamentId } = await request.json().catch(() => ({}));
    let isTournamentAdmin = false;
    
    if (tournamentId) {
      const tournamentAdminDoc = await getAdminDb()
        .collection('tournaments')
        .doc(tournamentId)
        .collection('admins')
        .doc(decodedToken.uid)
        .get();
      
      isTournamentAdmin = tournamentAdminDoc.exists;
    }
    
    const isAdmin = isSuperAdmin || isTournamentAdmin;
    
    return NextResponse.json({ 
      isAdmin,
      isSuperAdmin,
      isTournamentAdmin 
    });

  } catch (error) {
    console.error("Error checking admin status:", error);
    // Return false for any error (e.g., invalid token, user not found)
    return NextResponse.json({ isAdmin: false, error: (error as Error).message }, { status: 403 });
  }
}
