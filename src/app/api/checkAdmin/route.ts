// src/app/api/checkAdmin/route.ts
import { NextResponse } from 'next/server';
import { adminDb, ensureAdminInitialized } from '@/lib/admin';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    ensureAdminInitialized();
    const authHeader = headers().get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ isAdmin: false, error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ isAdmin: false, error: 'No token provided' }, { status: 401 });
    }

    const decodedToken = await getAuth(adminDb.app).verifyIdToken(token);
    const adminDoc = await adminDb.collection('admins').doc(decodedToken.uid).get();
    
    return NextResponse.json({ isAdmin: adminDoc.exists });

  } catch (error) {
    console.error("Error checking admin status:", error);
    // Return false for any error (e.g., invalid token, user not found)
    return NextResponse.json({ isAdmin: false, error: (error as Error).message }, { status: 403 });
  }
}
