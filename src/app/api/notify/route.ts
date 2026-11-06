/**
 * Event hints from pages that write to Firestore themselves: POST { t, event, … } → the server
 * reads what actually happened and tells whoever should know. Nothing in the body is used as
 * message text, and each event reaches each person once, so a repeated or forged hint changes
 * nothing.
 *   { event: 'reschedule' | 'standin', id }        captains (any signed-in user may hint)
 *   { event: 'announcement', id }                  everyone in the tournament (its admins only)
 *   { event: 'match_time', ids, fresh }            times an admin set: captains + casters (admins only;
 *                                                  `fresh` = new matches, also offered to all casters)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { requireAdmin } from '@/server/lib/require-admin';
import { announcementEvent, matchTimeEvent, rescheduleEvent, standinEvent } from '@/server/notify/events';

export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!ID.test(b?.t ?? '')) return bad('Złe zapytanie');
  const ids: string[] | null = b?.event === 'match_time'
    ? (Array.isArray(b.ids) && b.ids.length && b.ids.length <= 200 && b.ids.every((x: unknown) => typeof x === 'string' && ID.test(x)) ? b.ids : null)
    : (ID.test(b?.id ?? '') ? [b.id] : null);
  if (!ids) return bad('Złe zapytanie');

  const adminOnly = b.event === 'announcement' || b.event === 'match_time';
  const caller = adminOnly ? await requireAdmin(req, b.t) : await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  try {
    const sent = b.event === 'reschedule' ? await rescheduleEvent(b.t, ids[0])
      : b.event === 'standin' ? await standinEvent(b.t, ids[0])
      : b.event === 'announcement' ? await announcementEvent(b.t, ids[0])
      : b.event === 'match_time' ? await matchTimeEvent(b.t, ids, b.fresh === true)
      : null;
    if (sent === null) return bad('Nieznane zdarzenie');
    return NextResponse.json({ sent });
  } catch (e) {
    console.error('[notify] event failed:', e);
    return bad('Nie udało się wysłać powiadomień', 500);
  }
}
