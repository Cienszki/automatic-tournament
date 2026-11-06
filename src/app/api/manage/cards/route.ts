/**
 * The card game's admin side (Admin → Karty).
 *   GET  ?tournamentId=…            → { settings, defaultHowTo, grants }: settings and the last packs given
 *   GET  ?tournamentId=…&q=<text>   → { found }: accounts whose nick or Discord name matches
 *   PUT  { tournamentId, settings } → { settings }: the "how to get cards" text, packs per round, Twitch channels
 *   POST { tournamentId, uids, n, reason } → { grants }: gives these accounts n packs each, with a notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/server/lib/require-admin';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { addPacks } from '@/server/card-lab/collection';
import { notify, tournamentInfo } from '@/server/notify/notify';
import { cardSettingsOf, defaultHowTo, ROUND_PACKS_MAX, TWITCH_LOGIN, type CardSettings } from '@/lib/card-lab/settings';
import { count } from '@/lib/plural';

export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const GRANT_MAX = 50;

const db = () => { ensureAdminInitialized(); return getAdminDb(); };

async function grants(tid: string) {
  const snap = await db().collection('cardGrants').where('tournament', '==', tid).get();
  return snap.docs
    .map(d => { const g = d.data(); return { id: d.id, kind: g.kind as 'round' | 'admin', label: (g.label ?? null) as string | null, reason: (g.reason ?? null) as string | null, n: g.n as number, uids: g.uids as number, names: (g.names ?? []) as string[], at: g.at?.toMillis?.() ?? 0 }; })
    .sort((a, b) => b.at - a.at).slice(0, 20);
}

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('tournamentId') ?? '';
  if (!ID.test(tid)) return bad('Złe zapytanie');
  const caller = await requireAdmin(req, tid); if (caller instanceof NextResponse) return caller;
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
    if (q) {
      if (q.length < 2) return NextResponse.json({ found: [] });
      // Few enough accounts to filter here; Firestore has no "contains"
      const all = await db().collection('accounts').select('nickname', 'discord').get();
      const found = all.docs
        .map(d => ({ uid: d.id, name: (d.data().nickname ?? d.data().discord?.name ?? '') as string, discord: (d.data().discord?.username ?? null) as string | null, avatar: (d.data().discord?.avatar ?? null) as string | null }))
        .filter(a => a.name && (a.name.toLowerCase().includes(q) || a.discord?.toLowerCase().includes(q)))
        .slice(0, 8);
      return NextResponse.json({ found });
    }
    const t = (await db().collection('tournaments').doc(tid).get()).data();
    if (!t) return bad('Nie ma takiego turnieju', 404);
    const settings = cardSettingsOf(t);
    return NextResponse.json({ settings, defaultHowTo: defaultHowTo(t.type, settings.roundPacks), grants: await grants(tid) });
  } catch (e) { console.error('[manage/cards] get failed:', e); return bad('Nie udało się wczytać', 500); }
}

export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!ID.test(b?.tournamentId ?? '') || !b?.settings || typeof b.settings !== 'object') return bad('Złe zapytanie');
  const caller = await requireAdmin(req, b.tournamentId); if (caller instanceof NextResponse) return caller;
  const s = b.settings as Partial<CardSettings>;
  if (typeof s.howTo !== 'string' || s.howTo.length > 1500) return bad('Tekst może mieć najwyżej 1500 znaków');
  if (!Number.isInteger(s.roundPacks) || s.roundPacks! < 0 || s.roundPacks! > ROUND_PACKS_MAX) return bad(`Paczki po kolejce: od 0 do ${ROUND_PACKS_MAX}`);
  const channels = Array.isArray(s.twitchChannels) ? [...new Set(s.twitchChannels.map(c => String(c).trim().toLowerCase()).filter(Boolean))] : [];
  const wrong = channels.find(c => !TWITCH_LOGIN.test(c));
  if (wrong) return bad(`„${wrong}” to nie jest nazwa kanału na Twitchu`);
  if (channels.length > 20) return bad('Najwyżej 20 kanałów');
  try {
    const settings: CardSettings = { howTo: s.howTo.trim(), roundPacks: s.roundPacks!, twitchChannels: channels };
    await db().collection('tournaments').doc(b.tournamentId).update({ cardSettings: settings });
    return NextResponse.json({ settings });
  } catch (e) { console.error('[manage/cards] put failed:', e); return bad('Nie udało się zapisać', 500); }
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const uids = Array.isArray(b?.uids) ? [...new Set(b.uids as unknown[])] : [];
  if (!ID.test(b?.tournamentId ?? '') || !uids.length || uids.length > 50 || uids.some(u => typeof u !== 'string' || !ID.test(u))) return bad('Złe zapytanie');
  const caller = await requireAdmin(req, b.tournamentId); if (caller instanceof NextResponse) return caller;
  const n = b.n;
  if (!Number.isInteger(n) || n < 1 || n > GRANT_MAX) return bad(`Liczba paczek: od 1 do ${GRANT_MAX}`);
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 140) : '';
  try {
    const accounts = await Promise.all((uids as string[]).map(u => db().collection('accounts').doc(u).get()));
    const missing = accounts.find(a => !a.exists);
    if (missing) return bad('Nie ma takiego konta.', 404);
    const ref = await db().collection('cardGrants').add({
      tournament: b.tournamentId, kind: 'admin', n, reason: reason || null, uids: uids.length,
      names: accounts.map(a => (a.data()?.nickname ?? a.data()?.discord?.name ?? '?') as string), to: uids, by: caller.uid, at: FieldValue.serverTimestamp(),
    });
    for (const u of uids as string[]) await addPacks(b.tournamentId, u, n);
    const info = await tournamentInfo(b.tournamentId);
    await notify(uids as string[], {
      type: 'packs', key: `packs:grant:${ref.id}`, tournament: info,
      title: `${count(n, 'paczka', 'paczki', 'paczek')} do otwarcia`,
      body: reason ? `Od organizatorów: ${reason}` : 'Od organizatorów.',
      href: `/${info?.slug ?? b.tournamentId}/cards`,
    });
    return NextResponse.json({ grants: await grants(b.tournamentId) });
  } catch (e) { console.error('[manage/cards] grant failed:', e); return bad('Nie udało się dać paczek', 500); }
}
