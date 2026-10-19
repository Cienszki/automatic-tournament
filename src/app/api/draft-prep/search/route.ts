import { NextRequest, NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/draft-prep/server';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Player name search (OpenDota) for adding a standin the opponents have not registered yet */
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, 'draft-prep-search', { limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2 || q.length > 40) return NextResponse.json([]);
  try { return NextResponse.json(await searchPlayers(q)); }
  catch (err: any) { return NextResponse.json({ error: err?.message || 'failed' }, { status: 502 }); }
}
