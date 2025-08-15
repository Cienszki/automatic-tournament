// src/app/api/dev/makeAdmin/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../../server/lib/admin';
import { headers } from 'next/headers';

// THIS IS A DEVELOPMENT-ONLY ENDPOINT
// Remove this in production or add proper security

export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'This endpoint is disabled in production' }, { status: 403 });
  }

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

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    
    // Add user to admins collection
    await getAdminDb().collection('admins').doc(decodedToken.uid).set({
      uid: decodedToken.uid,
      email: decodedToken.email,
      addedAt: new Date().toISOString(),
      addedBy: 'dev-endpoint'
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `User ${decodedToken.email} added as admin`,
      uid: decodedToken.uid
    });

  } catch (error) {
    console.error("Error adding admin:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
