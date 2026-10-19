import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { buildStatsDataset } from '@/lib/stats-lab/build-dataset';

export const dynamic = 'force-dynamic';

// One full read of a tournament's games/performances per 10 minutes, shared by every visitor
const cachedDataset = (tournamentId: string) =>
  unstable_cache(
    () => buildStatsDataset(tournamentId === 'letnia' ? null : tournamentId),
    ['stats-dataset-v5', tournamentId],
    { revalidate: 600, tags: [`stats-dataset-${tournamentId}`] },
  )();

export async function GET(request: Request) {
  const tournamentId = new URL(request.url).searchParams.get('tournamentId');
  if (!tournamentId || !/^[A-Za-z0-9_-]{1,64}$/.test(tournamentId)) {
    return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });
  }
  try {
    const data = await cachedDataset(tournamentId);
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res;
  } catch (err: any) {
    console.error('[stats/dataset] failed:', err);
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 500 });
  }
}
