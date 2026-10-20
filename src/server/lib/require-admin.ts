// Access check for the admin API (/api/manage/*): a verified Firebase ID token from a super
// admin (admins/{uid}) or, when the action concerns one tournament, an admin of that tournament
// (tournaments/{tournamentId}/admins/{uid}). The token is checked, never just its presence.

import { NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminAuth, getAdminDb } from './admin';

export interface AdminCaller {
  uid: string;
  isSuperAdmin: boolean;
}

const deny = (status: 401 | 403, error: string) => NextResponse.json({ success: false, error }, { status });

/**
 * The caller, or the response to send back (401 no/invalid token, 403 not an admin).
 * Without a tournamentId only super admins pass.
 *
 * Usage: `const caller = await requireAdmin(req, tournamentId); if (caller instanceof NextResponse) return caller;`
 */
export async function requireAdmin(req: Request, tournamentId?: string | null): Promise<AdminCaller | NextResponse> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return deny(401, 'Unauthorized — missing Bearer token');

  ensureAdminInitialized();
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(token)).uid;
  } catch {
    return deny(401, 'Unauthorized — invalid or expired token');
  }

  const db = getAdminDb();
  const [superDoc, tournamentDoc] = await Promise.all([
    db.collection('admins').doc(uid).get(),
    tournamentId ? db.collection('tournaments').doc(tournamentId).collection('admins').doc(uid).get() : null,
  ]);
  if (superDoc.exists) return { uid, isSuperAdmin: true };
  if (tournamentDoc?.exists) return { uid, isSuperAdmin: false };
  return deny(403, tournamentId ? 'Forbidden — not an admin of this tournament' : 'Forbidden — super admins only');
}
