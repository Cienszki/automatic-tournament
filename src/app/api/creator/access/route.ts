// src/app/api/creator/access/route.ts
//
// Who may create a tournament through the wizard.
//
// Two ways in: a platform super admin (`admins/{uid}`), or a user a super admin
// has added to the `tournamentCreators/{uid}` allowlist. The allowlist is kept
// separate from `admins` so that "can create a tournament" does not also grant
// platform-wide administration.
//
// Mirrors firestore.rules — the rules are the real enforcement; this route
// exists so the UI can show a clear message instead of letting a write fail with
// a generic permission error.

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../../server/lib/admin';
import { headers } from 'next/headers';

export async function GET() {
  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { canCreate: false, isSuperAdmin: false, reason: 'unauthenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json(
        { canCreate: false, isSuperAdmin: false, reason: 'unauthenticated' },
        { status: 401 }
      );
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();

    const [superAdminDoc, creatorDoc] = await Promise.all([
      db.collection('admins').doc(decoded.uid).get(),
      db.collection('tournamentCreators').doc(decoded.uid).get(),
    ]);

    const isSuperAdmin = superAdminDoc.exists;
    const isAllowlisted = creatorDoc.exists;

    return NextResponse.json({
      canCreate: isSuperAdmin || isAllowlisted,
      isSuperAdmin,
      isAllowlisted,
      uid: decoded.uid,
      reason: isSuperAdmin || isAllowlisted ? null : 'not-allowlisted',
    });
  } catch (error) {
    console.error('[creator/access] check failed:', error);
    return NextResponse.json(
      { canCreate: false, isSuperAdmin: false, reason: 'error' },
      { status: 403 }
    );
  }
}
