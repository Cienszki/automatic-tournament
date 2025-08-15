// src/app/api/dev/authStatus/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../../server/lib/admin';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'This endpoint is disabled in production' }, { status: 403 });
  }

  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ 
        authenticated: false, 
        error: 'No Authorization header',
        details: 'No auth header found in request'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'No token provided',
        details: 'Authorization header found but no Bearer token'
      });
    }

    try {
      const decodedToken = await getAdminAuth().verifyIdToken(token);
      const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
      
      return NextResponse.json({ 
        authenticated: true,
        isAdmin: adminDoc.exists,
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified
        },
        adminDoc: adminDoc.exists ? adminDoc.data() : null
      });
    } catch (tokenError) {
      return NextResponse.json({
        authenticated: false,
        error: 'Invalid token',
        details: (tokenError as Error).message
      });
    }

  } catch (error) {
    console.error("Error checking auth status:", error);
    return NextResponse.json({ 
      error: 'Server error',
      details: (error as Error).message 
    }, { status: 500 });
  }
}
