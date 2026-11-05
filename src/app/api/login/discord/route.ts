/**
 * Starts a Discord sign-in or link. POST { mode: 'login' | 'link', origin, next, nonce } → { url }
 * Linking needs the signed-in account (Authorization: Bearer <Firebase ID token>).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { allowedOrigin, discordAuthorizeUrl, discordConfigured, safeNext, signState } from '@/server/accounts/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!discordConfigured()) return NextResponse.json({ error: 'Logowanie przez Discord nie jest jeszcze włączone.' }, { status: 503 });
  const b = await req.json().catch(() => null);
  if (!b || (b.mode !== 'login' && b.mode !== 'link') || !allowedOrigin(b.origin) || typeof b.nonce !== 'string' || b.nonce.length > 64) {
    return NextResponse.json({ error: 'Złe zapytanie' }, { status: 400 });
  }
  let uid: string | undefined;
  if (b.mode === 'link') {
    const user = await requireUser(req); if (user instanceof NextResponse) return user;
    uid = user.uid;
  }
  const state = signState({ p: 'discord', mode: b.mode, origin: b.origin, next: safeNext(b.next), uid, nonce: b.nonce });
  return NextResponse.json({ url: discordAuthorizeUrl(state, b.origin) });
}
