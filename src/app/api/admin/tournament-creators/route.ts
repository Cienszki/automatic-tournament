// src/app/api/admin/tournament-creators/route.ts
//
// Manage the `tournamentCreators` allowlist — who may create tournaments through
// the wizard. Super admins only, in every direction.
//
// Without this route the allowlist would only be editable from the Firebase
// console, which makes the whole permission model unusable in practice.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '@/server/lib/admin';
import { headers } from 'next/headers';

/** Verify the caller is a super admin. Returns their uid, or a response to bail with. */
async function requireSuperAdmin(): Promise<{ uid: string } | { error: NextResponse }> {
  const headersList = await headers();
  const authHeader = headersList.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'No Authorization header' }, { status: 401 }) };
  }
  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return { error: NextResponse.json({ error: 'No token provided' }, { status: 401 }) };
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const adminDoc = await getAdminDb().collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - super admin access required' },
        { status: 403 }
      ),
    };
  }
  return { uid: decoded.uid };
}

export async function GET() {
  try {
    ensureAdminInitialized();
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const snap = await getAdminDb().collection('tournamentCreators').get();

    const creators = [];
    for (const d of snap.docs) {
      try {
        const userRecord = await getAdminAuth().getUser(d.id);
        creators.push({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || null,
          photoURL: userRecord.photoURL || null,
          addedAt: d.data().addedAt || null,
        });
      } catch {
        // The Firebase Auth user is gone but the allowlist entry remains —
        // surface it so a super admin can clean it up rather than hiding it.
        creators.push({
          uid: d.id,
          email: null,
          displayName: '(konto usunięte)',
          photoURL: null,
          addedAt: d.data().addedAt || null,
        });
      }
    }

    return NextResponse.json({ success: true, creators });
  } catch (error) {
    console.error('Error fetching tournament creators:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas pobierania listy organizatorów' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const { uid } = await request.json().catch(() => ({}));
    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    // Confirm the target account actually exists before granting anything.
    await getAdminAuth().getUser(uid);

    await getAdminDb().collection('tournamentCreators').doc(uid).set({
      addedAt: new Date().toISOString(),
      addedBy: auth.uid,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding tournament creator:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się dodać organizatora' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    await getAdminDb().collection('tournamentCreators').doc(uid).delete();

    // Note: revoking creator rights deliberately does NOT touch tournaments the
    // user already created, or their admin access to them. Those are separate
    // grants and removing them here would be a surprising side effect.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tournament creator:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się usunąć organizatora' },
      { status: 500 }
    );
  }
}
