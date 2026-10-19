import { NextRequest, NextResponse } from 'next/server';
import { resolveAccount } from '@/lib/draft-prep/server';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Steam profile link (including /id/vanity names) → account id, for manually added standins */
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, 'draft-prep-resolve', { limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  const url = (new URL(req.url).searchParams.get('url') || '').trim();
  if (!/steamcommunity\.com\/(id|profiles)\//.test(url) || url.length > 200) return NextResponse.json({ account: null });
  const account = await resolveAccount(url).catch(() => null);
  return NextResponse.json({ account });
}
