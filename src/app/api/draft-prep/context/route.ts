import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { buildContext } from '@/lib/draft-prep/server';

export const dynamic = 'force-dynamic';

// Rosters, upcoming matches and standins change rarely; two minutes keeps standins fresh enough
const cached = (tournamentId: string) =>
  unstable_cache(() => buildContext(tournamentId === 'letnia' ? null : tournamentId), ['draft-prep-context-v2', tournamentId], { revalidate: 120 })();

export async function GET(request: Request) {
  const tournamentId = new URL(request.url).searchParams.get('tournamentId');
  if (!tournamentId || !/^[A-Za-z0-9_-]{1,64}$/.test(tournamentId)) return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });
  try {
    return NextResponse.json(await cached(tournamentId));
  } catch (err: any) {
    console.error('[draft-prep/context] failed:', err);
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 500 });
  }
}
