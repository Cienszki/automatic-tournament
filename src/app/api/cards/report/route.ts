/**
 * A player's bug report from the card game.
 *   POST { t, text, url, client, log, context } → { ok }
 * Stored in cardReports (server only) with the duel's full state when the reporter plays in it;
 * the tournament's admins and the super admins get a Discord message. At most 5 an hour per account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser } from '@/server/lib/require-user';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { validKey } from '@/server/card-lab/collection';
import { getAccount } from '@/server/accounts/store';
import { sendDm } from '@/server/notify/discord-dm';
import { SITE, tournamentInfo } from '@/server/notify/notify';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const HOUR = 3600_000;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 600_000) return bad('Za duże zgłoszenie');
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return bad('Złe zapytanie'); }
  const text = typeof b.text === 'string' ? b.text.trim().slice(0, 1500) : '';
  if (!validKey(b.t) || text.length < 3) return bad('Złe zapytanie');
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  ensureAdminInitialized();
  const db = getAdminDb();
  try {
    // A few an hour is plenty
    const limit = db.collection('cardReportLimits').doc(user.uid);
    const allowed = await db.runTransaction(async tx => {
      const l = (await tx.get(limit)).data() as { from?: number; n?: number } | undefined;
      const now = Date.now();
      const fresh = !l?.from || now - l.from > HOUR;
      if (!fresh && (l!.n ?? 0) >= 5) return false;
      tx.set(limit, fresh ? { from: now, n: 1 } : { from: l!.from, n: (l!.n ?? 0) + 1 });
      return true;
    });
    if (!allowed) return bad('Za dużo zgłoszeń, spróbuj za godzinę', 429);

    const ctx = (b.context && typeof b.context === 'object' ? b.context : {}) as Record<string, unknown>;
    // The whole duel (both hands, the server's clock) when the reporter plays in it
    let duel: string | null = null;
    if (typeof ctx.duelId === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(ctx.duelId)) {
      const d = (await db.collection('cardDuels').doc(ctx.duelId).get()).data();
      if (d && (d.host?.uid === user.uid || d.guest?.uid === user.uid)) {
        // The match and its whole history (start + every move with its time: it replays exactly)
        const h = (await db.collection('cardDuels').doc(ctx.duelId).collection('meta').doc('history').get()).data();
        duel = JSON.stringify({ ...d, history: h ?? null }).slice(0, 650_000);
      }
    }
    const acc = await getAccount(user.uid);
    const name = acc.nickname || acc.discord?.name || user.name || '?';
    const ref = await db.collection('cardReports').add({
      t: b.t, uid: user.uid, name, text,
      url: typeof b.url === 'string' ? b.url.slice(0, 300) : null,
      client: JSON.stringify(b.client ?? null).slice(0, 2000),
      log: JSON.stringify(b.log ?? []).slice(0, 60_000),
      context: JSON.stringify(ctx).slice(0, 200_000),
      duelId: typeof ctx.duelId === 'string' ? ctx.duelId : null, duel,
      mode: typeof ctx.mode === 'string' ? ctx.mode : null,
      status: 'new', at: FieldValue.serverTimestamp(),
    });

    // Tell the admins on Discord (best effort)
    const t = await tournamentInfo(b.t as string);
    const [supers, admins] = await Promise.all([db.collection('admins').get(), db.collection('tournaments').doc(b.t as string).collection('admins').get()]);
    const uids = [...new Set([...supers.docs, ...admins.docs].map(d => d.id))];
    const accs = await Promise.all(uids.map(u => db.collection('accounts').doc(u).get()));
    await Promise.all(accs.map(a => a.data()?.discord?.id).filter((id): id is string => !!id).map(id => sendDm(id, {
      title: 'Zgłoszenie błędu w grze karcianej', body: `**${name}**${ctx.mode ? ` (${ctx.mode})` : ''}: ${text}`,
      url: `${SITE}/${t?.slug ?? b.t}/admin`, footer: t?.name ?? null, color: t?.color ?? null,
    }).catch(() => 'failed')));
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) { console.error('[cards/report] failed:', e); return bad('Nie udało się wysłać', 500); }
}
