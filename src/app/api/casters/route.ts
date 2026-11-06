/**
 * The caster's desk.
 *   GET  ?t=<tournamentId>                       → { matches } (only for the tournament's casters)
 *   GET  ?t=<tournamentId>&check=1               → { caster } (the home page: show the account section?)
 *   POST { t, matchId, action }                  → { casters }; action: 'take' (main caster if the match
 *        has none, else co-caster) | 'drop' | { main: uid } (the main caster hands the lead over)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { casterMatches, isCaster, setCasting, type CastAction } from '@/server/casters/casters';

export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const t = req.nextUrl.searchParams.get('t') ?? '';
  if (!ID.test(t)) return bad('Złe zapytanie');
  try {
    if (req.nextUrl.searchParams.get('check')) return NextResponse.json({ caster: await isCaster(t, user.uid) });
    if (!(await isCaster(t, user.uid))) return bad('Nie masz roli castera w tym turnieju.', 403);
    return NextResponse.json({ matches: await casterMatches(t) });
  } catch (e) { console.error('[casters] get failed:', e); return bad('Nie udało się wczytać meczów', 500); }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => null);
  const action: CastAction | null = b?.action === 'take' || b?.action === 'drop' ? b.action
    : ID.test(b?.action?.main ?? '') ? { main: b.action.main } : null;
  if (!ID.test(b?.t ?? '') || !ID.test(b?.matchId ?? '') || !action) return bad('Złe zapytanie');
  try {
    const r = await setCasting(b.t, user.uid, b.matchId, action);
    return 'error' in r ? bad(r.error, 409) : NextResponse.json(r);
  } catch (e) { console.error('[casters] post failed:', e); return bad('Nie udało się zapisać', 500); }
}
