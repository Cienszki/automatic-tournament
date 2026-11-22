/**
 * The caster corner's tournament data (casters and admins of the tournament only).
 *   GET ?t=<tournamentId> → { matches, rosters, careers, type, name, me } — see cornerData()
 * Game stats come from the public /api/stats/dataset; pub form from /api/draft-prep/history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { isCaster } from '@/server/casters/casters';
import { cornerData } from '@/server/casters/corner';

export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const t = req.nextUrl.searchParams.get('t') ?? '';
  if (!ID.test(t)) return bad('Złe zapytanie');
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    const [caster, superAdmin, tAdmin] = await Promise.all([
      isCaster(t, user.uid), db.collection('admins').doc(user.uid).get(), db.collection('tournaments').doc(t).collection('admins').doc(user.uid).get(),
    ]);
    if (!caster && !superAdmin.exists && !tAdmin.exists) return bad('Kącik castera jest dla casterów turnieju.', 403);
    return NextResponse.json(await cornerData(t, user.uid));
  } catch (e) { console.error('[caster-corner] get failed:', e); return bad('Nie udało się wczytać danych', 500); }
}
