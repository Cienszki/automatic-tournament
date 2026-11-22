/**
 * Asking to cast a tournament (the account page).
 *   POST { t } → { state: 'pending' }; the tournament's admins get it in their inbox
 * The current state comes with the account (/api/account?t= → casterRequest).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { sendRequest } from '@/server/casters/requests';

export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => null);
  if (!ID.test(b?.t ?? '')) return bad('Złe zapytanie');
  try {
    const r = await sendRequest(b.t, user.uid);
    return 'error' in r ? bad(r.error, 409) : NextResponse.json(r);
  } catch (e) { console.error('[caster-requests] post failed:', e); return bad('Nie udało się wysłać zgłoszenia', 500); }
}
