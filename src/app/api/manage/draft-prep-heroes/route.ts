/**
 * Admin API: refresh the hero data the match-prep tool uses (STRATZ positions and matchups).
 * Runs in steps so no request is long: the client calls step 0, 1, … until `done`.
 *
 * POST body: { tournamentId: string, step: number, force?: boolean }
 *   Without `force`, step 0 does nothing when the data is under 7 days old (`fresh: true`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/server/lib/require-admin';
import { heroDataUpdatedAt, refreshHeroData } from '@/lib/draft-prep/server';

export const maxDuration = 60;
const FRESH_MS = 7 * 86400 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { tournamentId, step, force } = await req.json();
    if (!tournamentId || !Number.isInteger(step) || step < 0 || step > 20) {
      return NextResponse.json({ success: false, error: 'tournamentId and step are required' }, { status: 400 });
    }
    const caller = await requireAdmin(req, tournamentId);
    if (caller instanceof NextResponse) return caller;

    if (step === 0 && !force) {
      const at = await heroDataUpdatedAt();
      if (at && Date.now() - Date.parse(at) < FRESH_MS) return NextResponse.json({ success: true, fresh: true, done: true, updatedAt: at });
    }
    const r = await refreshHeroData(step);
    if (r.done) revalidateTag('draft-prep-heroes');
    return NextResponse.json({ success: true, ...r });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'failed' }, { status: 502 });
  }
}
