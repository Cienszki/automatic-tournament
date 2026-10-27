/**
 * Admin API: re-check every player's match history for the match-prep tool.
 *
 * POST { tournamentId } — asks OpenDota to re-download the history of every account in the
 *   tournament (roster players, their smurfs, standins who played), then empties our cache of
 *   histories on every server instance. OpenDota works through its queue: older games appear
 *   minutes to hours later; for two hours our cache re-reads them every 15 minutes.
 * GET ?tournamentId= — when that was last done.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { bumpHistoryVersion, historyCacheState, requestOpenDotaRefresh, tournamentAccounts } from '@/lib/draft-prep/server';

export const maxDuration = 60;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(req: NextRequest) {
  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId || !ID.test(tournamentId)) return NextResponse.json({ success: false, error: 'tournamentId required' }, { status: 400 });
  const caller = await requireAdmin(req, tournamentId);
  if (caller instanceof NextResponse) return caller;
  const { refreshedAt } = await historyCacheState();
  return NextResponse.json({ success: true, refreshedAt });
}

export async function POST(req: NextRequest) {
  try {
    const { tournamentId } = await req.json();
    if (!tournamentId || !ID.test(tournamentId)) return NextResponse.json({ success: false, error: 'tournamentId required' }, { status: 400 });
    const caller = await requireAdmin(req, tournamentId);
    if (caller instanceof NextResponse) return caller;

    const accounts = await tournamentAccounts(tournamentId === 'letnia' ? null : tournamentId);
    const { queued, failed } = await requestOpenDotaRefresh(accounts);
    const refreshedAt = await bumpHistoryVersion(caller.uid);
    return NextResponse.json({ success: true, accounts: accounts.length, queued, failed, refreshedAt });
  } catch (err: any) {
    console.error('[manage/draft-prep-histories] failed:', err);
    return NextResponse.json({ success: false, error: err?.message || 'failed' }, { status: 502 });
  }
}
