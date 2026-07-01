// src/app/api/admin/captain-change-code/route.ts
// Admin endpoint: generate a one-time code an admin hands to a new captain.
// The new captain redeems it on /[tournamentSlug]/newcaptain to take over the team.

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';

// Unambiguous alphabet (no O/0/I/1) so codes are easy to read off a screen and re-type.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return code;
}

/**
 * POST /api/admin/captain-change-code
 * Body: { tournamentId: string, teamId: string }
 * Returns: { success: true, code: string }
 *
 * Auth: a global admin (admins/{uid}) or a tournament admin
 * (tournaments/{tournamentId}/admins/{uid}).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { tournamentId, teamId } = body as { tournamentId?: string; teamId?: string };
    if (!tournamentId || !teamId) {
      return NextResponse.json(
        { error: 'tournamentId and teamId are required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Verify the caller is an admin for this tournament.
    const [superAdminDoc, tournamentAdminDoc] = await Promise.all([
      db.collection('admins').doc(uid).get(),
      db.collection('tournaments').doc(tournamentId).collection('admins').doc(uid).get(),
    ]);
    if (!superAdminDoc.exists && !tournamentAdminDoc.exists) {
      return NextResponse.json({ error: 'Not an admin for this tournament' }, { status: 403 });
    }

    // Confirm the team exists and capture its current captain (for audit + display).
    const teamRef = db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    const team = teamSnap.data() as { name?: string; captainId?: string };

    // A team should have at most one live code. Drop any prior unused ones so an old
    // code can never be redeemed after the admin issues a fresh one.
    const existing = await db
      .collection('captainChangeCodes')
      .where('tournamentId', '==', tournamentId)
      .where('teamId', '==', teamId)
      .get();
    if (!existing.empty) {
      const batch = db.batch();
      existing.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Generate a code that isn't already taken (collisions are astronomically unlikely,
    // but the doc-id lookup makes the check free).
    let code = generateCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await db.collection('captainChangeCodes').doc(code).get();
      if (!taken.exists) break;
      code = generateCode();
    }

    await db.collection('captainChangeCodes').doc(code).set({
      code,
      tournamentId,
      teamId,
      teamName: team.name ?? '',
      previousCaptainId: team.captainId ?? '',
      createdBy: uid,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, code });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] captain-change-code error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
