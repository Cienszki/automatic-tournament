/**
 * Discord sends the browser back here. Login: the account linked to this Discord user (or a new one)
 * gets a one-time Firebase sign-in token, handed to the page in the URL fragment (never sent to a
 * server) together with the browser's nonce. Link: the Discord user joins the signed-in account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminAuth } from '@/server/lib/admin';
import { discordIdentity, readState } from '@/server/accounts/identity';
import { accountForDiscord, linkDiscord } from '@/server/accounts/store';

export const dynamic = 'force-dynamic';

const back = (origin: string, next: string, query: Record<string, string>, hash?: string) => {
  const u = new URL(next, origin);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return NextResponse.redirect(`${u.toString()}${hash ? `#${hash}` : ''}`);
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const st = readState(q.get('state'));
  if (!st || st.p !== 'discord') return NextResponse.json({ error: 'Link logowania wygasł. Spróbuj jeszcze raz.' }, { status: 400 });
  const code = q.get('code');
  if (!code) return back(st.origin, st.next, { konto: 'anulowano' });
  try {
    const d = await discordIdentity(code, st.origin);
    if (st.mode === 'link') {
      const r = await linkDiscord(st.uid!, d);
      if ('error' in r) return back(st.origin, st.next, { konto: 'blad', powod: r.error });
      return back(st.origin, st.next, { konto: 'discord', ...(r.steamConflicts.length ? { steam: 'zajety' } : {}) });
    }
    const uid = await accountForDiscord(d);
    ensureAdminInitialized();
    const token = await getAdminAuth().createCustomToken(uid);
    return back(st.origin, st.next, {}, new URLSearchParams({ 'discord-login': token, n: st.nonce ?? '' }).toString());
  } catch (e) {
    console.error('[login/discord] failed:', e);
    return back(st.origin, st.next, { konto: 'blad', powod: 'Discord nie odpowiedział. Spróbuj jeszcze raz.' });
  }
}
