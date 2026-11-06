/**
 * Packs found on the site (see server/card-lab/finds.ts).
 *   POST { action: 'beat', t }   → { find: { id, expiresAt } | null } — one active minute on tournament t's pages
 *   POST { action: 'claim', id } → { packs } — the click on the found pack
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { validKey } from '@/server/card-lab/collection';
import { beat, claim } from '@/server/card-lab/finds';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (b?.action !== 'beat' && b?.action !== 'claim') return bad('Złe zapytanie');
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try {
    if (b.action === 'beat') {
      if (!validKey(b.t)) return bad('Złe zapytanie');
      return NextResponse.json({ find: await beat(user.uid, b.t) });
    }
    if (typeof b.id !== 'string' || !/^[0-9a-f]{24}$/.test(b.id)) return bad('Złe zapytanie');
    const r = await claim(user.uid, b.id);
    return 'error' in r ? bad(r.error, 410) : NextResponse.json({ packs: r.packs });
  } catch (e) { console.error('[cards/find] failed:', e); return bad('Nie udało się', 500); }
}
