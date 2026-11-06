/**
 * The signed-in account's notifications (the bell).
 *   GET                              → { items, unread, discord: { linked, problem, on: {type: bool} } }
 *   POST { read: 'all' | string[] }  → marks items read
 *   POST { test: true }              → a test DM (once a minute)
 *   PUT  { discord: { type: bool } } → which types also come as a Discord DM
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireUser } from '@/server/lib/require-user';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { NOTIFY_ORDER, NOTIFY_TYPES, isNotifyType, type InboxItem, type NotifyType } from '@/lib/notify-types';
import { sendDm } from '@/server/notify/discord-dm';
import { SITE } from '@/server/notify/notify';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const db = () => { ensureAdminInitialized(); return getAdminDb(); };
const inbox = (uid: string) => db().collection('accounts').doc(uid).collection('inbox');

async function view(uid: string) {
  const [items, unread, acc] = await Promise.all([
    inbox(uid).orderBy('createdAt', 'desc').limit(30).get(),
    inbox(uid).where('readAt', '==', null).count().get(),
    db().collection('accounts').doc(uid).get(),
  ]);
  const a = acc.data() ?? {};
  const on = Object.fromEntries(NOTIFY_ORDER.map(t => [t, (a.notify?.discord?.[t] as boolean | undefined) ?? NOTIFY_TYPES[t].discord])) as Record<NotifyType, boolean>;
  return {
    items: items.docs.map((d): InboxItem => {
      const x = d.data();
      return {
        id: d.id, type: x.type, title: x.title, body: x.body, href: x.href ?? null, tournament: x.tournament ?? null,
        at: (x.createdAt as Timestamp | null)?.toDate().toISOString() ?? new Date().toISOString(), read: !!x.readAt,
      };
    }),
    unread: unread.data().count,
    discord: { linked: !!a.discord?.id, problem: (a.dmProblem as string | undefined) ?? null, on },
  };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try { return NextResponse.json(await view(user.uid)); }
  catch (e) { console.error('[inbox] get failed:', e); return bad('Nie udało się wczytać powiadomień', 500); }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => null);
  try {
    if (b?.test === true) {
      const ref = db().collection('accounts').doc(user.uid);
      const a = (await ref.get()).data() ?? {};
      if (!a.discord?.id) return bad('Najpierw połącz konto z Discordem.');
      const last = (a.dmTestAt as Timestamp | undefined)?.toMillis() ?? 0;
      if (Date.now() - last < 60_000) return bad('Poczekaj chwilę przed kolejną próbą.', 429);
      await ref.set({ dmTestAt: FieldValue.serverTimestamp() }, { merge: true });
      const res = await sendDm(a.discord.id, { title: 'Powiadomienia działają', body: 'Tak będą wyglądać wiadomości z dota2inhouse.pl.', url: `${SITE}/` });
      if (res === 'sent') { if (a.dmProblem) await ref.update({ dmProblem: FieldValue.delete() }); }
      else if (res === 'blocked') await ref.set({ dmProblem: 'blocked' }, { merge: true });
      return NextResponse.json({ ...(await view(user.uid)), test: res });
    }
    const ids: string[] | 'all' | undefined = b?.read === 'all' ? 'all' : Array.isArray(b?.read) ? b.read.filter((x: unknown) => typeof x === 'string' && /^[0-9a-f]{24}$/.test(x)).slice(0, 50) : undefined;
    if (!ids) return bad('Złe zapytanie');
    const read = { readAt: FieldValue.serverTimestamp() };
    if (ids === 'all') {
      const unread = await inbox(user.uid).where('readAt', '==', null).limit(400).get();
      const batch = db().batch();
      unread.docs.forEach(d => batch.update(d.ref, read));
      if (!unread.empty) await batch.commit();
    } else {
      // One by one: an id that no longer exists must not stop the others
      await Promise.all(ids.map(id => inbox(user.uid).doc(id).update(read).catch(() => {})));
    }
    return NextResponse.json(await view(user.uid));
  } catch (e) { console.error('[inbox] post failed:', e); return bad('Nie udało się zapisać', 500); }
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => null);
  const patch = Object.fromEntries(Object.entries(b?.discord ?? {}).filter(([t, v]) => isNotifyType(t) && typeof v === 'boolean'));
  if (!Object.keys(patch).length) return bad('Nic do zmiany');
  try {
    await db().collection('accounts').doc(user.uid).set({ notify: { discord: patch } }, { merge: true });
    return NextResponse.json(await view(user.uid));
  } catch (e) { console.error('[inbox] put failed:', e); return bad('Nie udało się zapisać', 500); }
}
