// src/app/api/admin/search-user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '@/server/lib/admin';
import { headers } from 'next/headers';

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

    // Verify admin status (must be admin to search for users)
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Search for user by email in Firebase Auth
    try {
      const userRecord = await getAdminAuth().getUserByEmail(email);
      
      return NextResponse.json({
        success: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || null,
          photoURL: userRecord.photoURL || null,
        }
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json({ 
          success: false, 
          error: 'Nie znaleziono użytkownika z tym adresem email' 
        }, { status: 404 });
      }
      throw error;
    }

  } catch (error) {
    console.error('Error searching for user:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Błąd podczas wyszukiwania użytkownika' 
    }, { status: 500 });
  }
}
