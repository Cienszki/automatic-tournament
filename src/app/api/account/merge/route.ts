/**
 * Merging an account made by "Zaloguj przez Discord" into the signed-in one (src/server/accounts/merge.ts).
 *   GET  ?id=<ticket>                         → what would move
 *   POST { id, keep: { [tournament]: 'mine' | 'other' } } → merges; `keep` answers every tournament where both have cards
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { mergeAccounts, mergePreview, type Keep } from '@/server/accounts/merge';
import { refreshCaster } from '@/server/casters/casters';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try {
    const r = await mergePreview(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    return 'error' in r ? bad(r.error, 409) : NextResponse.json(r);
  } catch (e) { console.error('[account/merge] preview failed:', e); return bad('Nie udało się wczytać tamtego konta', 500); }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => null);
  const keep: Record<string, Keep> = {};
  for (const [k, v] of Object.entries((b?.keep ?? {}) as Record<string, unknown>)) {
    if (/^[A-Za-z0-9_-]{1,64}$/.test(k) && (v === 'mine' || v === 'other')) keep[k] = v;
  }
  try {
    const r = await mergeAccounts(user.uid, String(b?.id ?? ''), keep);
    if ('error' in r) return bad(r.error, 409);
    // A caster's card shows the Discord and Steam at once
    await refreshCaster(user.uid).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) { console.error('[account/merge] failed:', e); return bad('Nie udało się połączyć kont', 500); }
}
