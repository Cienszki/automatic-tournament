
// src/app/api/auth/session/route.ts
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/admin';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body.idToken;
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    const adminAuth = getAdminAuth();
    const decodedIdToken = await adminAuth.verifyIdToken(idToken);
    
    // Check if the user is an admin and set a custom claim.
    const userRecord = await adminAuth.getUser(decodedIdToken.uid);
    const isAdmin = userRecord.customClaims?.admin === true;

    if (isAdmin) {
      await adminAuth.setCustomUserClaims(decodedIdToken.uid, { admin: true });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set('session', sessionCookie, { maxAge: expiresIn, httpOnly: true, secure: true, path: '/' });
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Session login error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    cookies().delete('session');
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Session logout error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
