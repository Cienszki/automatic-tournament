import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { loadHeroData } from '@/lib/draft-prep/server';

export const dynamic = 'force-dynamic';
// tag revalidated by /api/manage/draft-prep-heroes when a refresh completes
const cached = unstable_cache(() => loadHeroData(), ['draft-prep-heroes-v1'], { revalidate: 86400, tags: ['draft-prep-heroes'] });

/** STRATZ hero positions and matchups (stored by an admin refresh), or `updatedAt: null` when never fetched */
export async function GET() {
  try {
    const res = NextResponse.json(await cached());
    res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 502 });
  }
}
