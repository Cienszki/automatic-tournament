import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { HISTORY_FRESH_WINDOW_MS, accountHistory, historyCacheState, mergeHistories, playerAccounts } from '@/lib/draft-prep/server';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// One OpenDota pull per account every 6 hours, shared by every visitor. The key carries the
// version an admin bumps with "Odśwież historie graczy" (and, for two hours after that, a
// 15-minute slot, so games OpenDota fills in later still arrive). A failed pull throws and is
// not cached.
const cachedAccount = (account: string, key: string) =>
  unstable_cache(() => accountHistory(account), ['draft-prep-account-v3', account, key], { revalidate: 21600 })();
const cachedAccounts = (tournamentId: string, sid64: string, key: string) =>
  unstable_cache(() => playerAccounts(tournamentId === 'letnia' ? null : tournamentId, sid64), ['draft-prep-accounts-v2', tournamentId, sid64, key], { revalidate: 3600 })();

async function cacheKey(): Promise<string> {
  const { version, refreshedAt } = await historyCacheState();
  const since = refreshedAt ? Date.now() - Date.parse(refreshedAt) : Infinity;
  return since < HISTORY_FRESH_WINDOW_MS ? `${version}:${Math.floor(Date.now() / 900_000)}` : String(version);
}

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
    const key = await cacheKey();
    let accounts: string[];
    if (account) {
      if (!/^\d{1,12}$/.test(account)) return NextResponse.json({ error: 'bad account' }, { status: 400 });
      accounts = [account];
    } else {
      if (!tournamentId || !/^[A-Za-z0-9_-]{1,64}$/.test(tournamentId) || !sid64 || !/^\d{17}$/.test(sid64)) return NextResponse.json({ error: 'bad params' }, { status: 400 });
      accounts = await cachedAccounts(tournamentId, sid64, key);
    }
    const parts = await Promise.all(accounts.map(async a => ({ account: a, data: await cachedAccount(a, key).catch(() => null) })));
    const ok = parts.filter((p): p is { account: string; data: NonNullable<typeof p.data> } => p.data != null);
    // Nothing could be read: say so (the page shows "OpenDota / STRATZ nie odpowiada" and retries later)
    if (!ok.length) return NextResponse.json({ error: 'OpenDota nie odpowiada' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    const res = NextResponse.json(mergeHistories(ok));
    // A partial answer (a smurf failed) isn't kept by the browser
    res.headers.set('Cache-Control', ok.length === parts.length ? 'private, max-age=600' : 'no-store');
    return res;
  } catch (err: any) {
    console.error('[draft-prep/history] failed:', err);
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 502 });
  }
}
