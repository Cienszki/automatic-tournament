import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { heroMatchups } from '@/lib/draft-prep/server';

export const dynamic = 'force-dynamic';
const cached = (hero: number) => unstable_cache(() => heroMatchups(hero), ['draft-prep-matchups-v1', String(hero)], { revalidate: 86400 })();

export async function GET(request: Request) {
  const hero = Number(new URL(request.url).searchParams.get('hero'));
  if (!Number.isInteger(hero) || hero < 1 || hero > 300) return NextResponse.json({ error: 'bad hero' }, { status: 400 });
  try {
    const res = NextResponse.json(await cached(hero));
    res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 502 });
  }
}
