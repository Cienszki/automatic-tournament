/**
 * Casters of a tournament, managed by its admins.
 *   GET    ?tournamentId=…            → { casters }
 *   GET    ?tournamentId=…&q=<text>   → { found }: accounts whose nick or Discord name matches
 *   POST   { tournamentId, uid }      → gives the role (and lobby access through the whitelist)
 *   DELETE { tournamentId, uid }      → takes it away
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { addCaster, listCasters, removeCaster } from '@/server/casters/casters';

export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('tournamentId') ?? '';
  if (!ID.test(t)) return bad('Złe zapytanie');
  const caller = await requireAdmin(req, t); if (caller instanceof NextResponse) return caller;
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
    if (!q) return NextResponse.json({ casters: await listCasters(t) });
    if (q.length < 2) return NextResponse.json({ found: [] });
    // Few enough accounts to filter here; Firestore has no "contains"
    ensureAdminInitialized();
    const all = await getAdminDb().collection('accounts').select('nickname', 'discord').get();
    const found = all.docs
      .map(d => ({ uid: d.id, name: (d.data().nickname ?? d.data().discord?.name ?? '') as string, discord: (d.data().discord?.username ?? null) as string | null, avatar: (d.data().discord?.avatar ?? null) as string | null }))
      .filter(a => a.name.toLowerCase().includes(q) || a.discord?.toLowerCase().includes(q))
      .slice(0, 8);
    return NextResponse.json({ found });
  } catch (e) { console.error('[manage/casters] get failed:', e); return bad('Nie udało się wczytać', 500); }
}

async function body(req: NextRequest) {
  const b = await req.json().catch(() => null);
  return ID.test(b?.tournamentId ?? '') && ID.test(b?.uid ?? '') ? b as { tournamentId: string; uid: string } : null;
}

export async function POST(req: NextRequest) {
  const b = await body(req); if (!b) return bad('Złe zapytanie');
  const caller = await requireAdmin(req, b.tournamentId); if (caller instanceof NextResponse) return caller;
  try {
    const exists = (await getAdminDb().collection('accounts').doc(b.uid).get()).exists;
    if (!exists) return bad('Nie ma takiego konta.', 404);
    await addCaster(b.tournamentId, b.uid, caller.uid);
    return NextResponse.json({ casters: await listCasters(b.tournamentId) });
  } catch (e) { console.error('[manage/casters] post failed:', e); return bad('Nie udało się dodać castera', 500); }
}

export async function DELETE(req: NextRequest) {
  const b = await body(req); if (!b) return bad('Złe zapytanie');
  const caller = await requireAdmin(req, b.tournamentId); if (caller instanceof NextResponse) return caller;
  try {
    await removeCaster(b.tournamentId, b.uid);
    return NextResponse.json({ casters: await listCasters(b.tournamentId) });
  } catch (e) { console.error('[manage/casters] delete failed:', e); return bad('Nie udało się usunąć castera', 500); }
}
