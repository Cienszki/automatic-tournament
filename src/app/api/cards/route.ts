/**
 * The signed-in player's card collection for one tournament (`t` = the stats key).
 *   GET  ?t=…                      → { packs, cards, slots } (a new account gets its starter packs)
 *   POST { t, action: 'open' }     → { opened, packs } — one pack, drawn and frozen on the server
 *   PUT  { t, slots }              → { ok } — the deck layout, checked against the collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { getCollection, openOnePack, saveSlots, validKey } from '@/server/card-lab/collection';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('t');
  if (!validKey(key)) return bad('Nieznany turniej');
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try { return NextResponse.json(await getCollection(key, user.uid)); }
  catch (e) { console.error('[cards] get failed:', e); return bad('Nie udało się wczytać kolekcji', 500); }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!validKey(body?.t) || body?.action !== 'open') return bad('Złe zapytanie');
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try {
    const r = await openOnePack(body.t, user.uid);
    if ('error' in r) return bad(r.error, 409);
    return NextResponse.json({ opened: r.opened, packs: r.state.packs });
  } catch (e) { console.error('[cards] open failed:', e); return bad('Nie udało się otworzyć paczki', 500); }
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slots = body?.slots;
  if (!validKey(body?.t) || !slots || typeof slots !== 'object' || Array.isArray(slots) || Object.keys(slots).length > 40
    || Object.values(slots).some(v => typeof v !== 'string')) return bad('Złe zapytanie');
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try {
    const r = await saveSlots(body.t, user.uid, slots as Record<string, string>);
    if ('error' in r) return bad(r.error, 409);
    return NextResponse.json(r);
  } catch (e) { console.error('[cards] save failed:', e); return bad('Nie udało się zapisać talii', 500); }
}
