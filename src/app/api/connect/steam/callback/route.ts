/** Steam sends the browser back here; Steam itself confirms the answer before anything is linked */

import { NextRequest, NextResponse } from 'next/server';
import { readState, steamReturn, steamVerify } from '@/server/accounts/identity';
import { linkSteam } from '@/server/accounts/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const raw = q.get('state');
  const st = readState(raw);
  if (!st || st.p !== 'steam' || !st.uid) return NextResponse.json({ error: 'Link wygasł. Spróbuj jeszcze raz.' }, { status: 400 });
  const go = (k: string, v: string) => { const u = new URL(st.next, st.origin); u.searchParams.set(k, v); return NextResponse.redirect(u.toString()); };
  try {
    const id = await steamVerify(q, steamReturn(st.origin, raw!));
    if (!id) return go('konto', 'anulowano');
    const conflicts = await linkSteam(st.uid, id);
    return conflicts.length ? go('steam', 'zajety') : go('konto', 'steam');
  } catch (e) {
    console.error('[connect/steam] failed:', e);
    return go('konto', 'blad');
  }
}
