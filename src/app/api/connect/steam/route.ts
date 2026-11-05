/**
 * Optional Steam connection for a signed-in account, on Steam's own page (steamcommunity.com).
 * POST { origin, next } (Bearer) → { url }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { allowedOrigin, safeNext, signState, steamLoginUrl } from '@/server/accounts/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || !allowedOrigin(b.origin)) return NextResponse.json({ error: 'Złe zapytanie' }, { status: 400 });
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const state = signState({ p: 'steam', mode: 'link', origin: b.origin, next: safeNext(b.next), uid: user.uid });
  return NextResponse.json({ url: steamLoginUrl(b.origin, state) });
}
