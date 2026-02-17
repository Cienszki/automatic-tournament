// src/app/api/admin/tournament-admins/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '@/server/lib/admin';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify admin status
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 });
    }

    // Get all tournament admins
    const adminDocs = await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('admins')
      .get();

    const admins = [];
    for (const doc of adminDocs.docs) {
      try {
        const userRecord = await getAdminAuth().getUser(doc.id);
        admins.push({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || null,
          photoURL: userRecord.photoURL || null,
          addedAt: doc.data().addedAt || null,
        });
      } catch (error) {
        console.error(`Failed to get user ${doc.id}:`, error);
      }
    }

    return NextResponse.json({ success: true, admins });

  } catch (error) {
    console.error('Error fetching tournament admins:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Błąd podczas pobierania listy administratorów' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify admin status (must be super admin to add tournament admins)
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized - Super admin access required' }, { status: 403 });
    }

    const { tournamentId, userId } = await request.json();

    if (!tournamentId || !userId) {
      return NextResponse.json({ error: 'Tournament ID and User ID are required' }, { status: 400 });
    }

    // Add user as tournament admin
    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('admins')
      .doc(userId)
      .set({
        addedAt: new Date().toISOString(),
        addedBy: decodedToken.uid,
      });

    return NextResponse.json({ 
      success: true, 
      message: 'Administrator został dodany pomyślnie' 
    });

  } catch (error) {
    console.error('Error adding tournament admin:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Błąd podczas dodawania administratora' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify admin status
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized - Super admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const userId = searchParams.get('userId');

    if (!tournamentId || !userId) {
      return NextResponse.json({ error: 'Tournament ID and User ID are required' }, { status: 400 });
    }

    // Remove user from tournament admins
    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('admins')
      .doc(userId)
      .delete();

    return NextResponse.json({ 
      success: true, 
      message: 'Administrator został usunięty pomyślnie' 
    });

  } catch (error) {
    console.error('Error removing tournament admin:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Błąd podczas usuwania administratora' 
    }, { status: 500 });
  }
}
