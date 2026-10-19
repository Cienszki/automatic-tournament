import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { buildMeta } from '@/lib/draft-prep/server';

export const dynamic = 'force-dynamic';
const cached = unstable_cache(() => buildMeta(), ['draft-prep-meta-v1'], { revalidate: 43200 });

export async function GET() {
  try {
    const res = NextResponse.json(await cached());
    res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=43200');
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 502 });
  }
}
