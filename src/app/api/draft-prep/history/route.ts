import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { accountHistory, mergeHistories, playerAccounts } from '@/lib/draft-prep/server';
import { checkRateLimit } from '@/lib/rate-limit';
import type { DpMatchRow } from '@/lib/draft-prep/types';

export const dynamic = 'force-dynamic';

// One OpenDota pull per account every 6 hours, shared by every visitor
const cachedAccount = (account: string) =>
  unstable_cache(() => accountHistory(account), ['draft-prep-account-v2', account], { revalidate: 21600 })();
const cachedAccounts = (tournamentId: string, sid64: string) =>
  unstable_cache(() => playerAccounts(tournamentId === 'letnia' ? null : tournamentId, sid64), ['draft-prep-accounts-v1', tournamentId, sid64], { revalidate: 3600 })();

/**
 * ?tournamentId=&sid64= → a roster player's main account merged with their registered smurfs
 * ?account=<steamId32>   → any single account (manually added standins)
 */
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, 'draft-prep-history', { limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  const q = new URL(req.url).searchParams;
  const tournamentId = q.get('tournamentId'); const sid64 = q.get('sid64'); const account = q.get('account');
  try {
    let accounts: string[];
    if (account) {
      if (!/^\d{1,12}$/.test(account)) return NextResponse.json({ error: 'bad account' }, { status: 400 });
      accounts = [account];
    } else {
      if (!tournamentId || !/^[A-Za-z0-9_-]{1,64}$/.test(tournamentId) || !sid64 || !/^\d{17}$/.test(sid64)) return NextResponse.json({ error: 'bad params' }, { status: 400 });
      accounts = await cachedAccounts(tournamentId, sid64);
    }
    const parts = await Promise.all(accounts.map(async a => ({ account: a, data: await cachedAccount(a).catch(() => ({ rows: [] as DpMatchRow[] })) })));
    const res = NextResponse.json(mergeHistories(parts));
    res.headers.set('Cache-Control', 'private, max-age=600');
    return res;
  } catch (err: any) {
    console.error('[draft-prep/history] failed:', err);
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 502 });
  }
}
