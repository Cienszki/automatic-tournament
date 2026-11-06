/**
 * The signed-in account.
 *   GET  ?t=<tournamentId>                → profile, linked Discord / Steam / Google, admin / caster of this tournament
 *   PUT  { nickname?, avatar?, stream? }  → profile (avatar: { source: 'google'|'discord'|'steam'|'url', url? }; stream: link or channel, '' clears)
 *   PUT  { unlink: 'discord' | steamId64 } → removes a link
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser } from '@/server/lib/require-user';
import { ensureAdminInitialized, getAdminAuth, getAdminDb } from '@/server/lib/admin';
import { steamAvatar } from '@/server/accounts/identity';
import { accountRef, getAccount, unlinkDiscord, unlinkSteam, type AvatarSource } from '@/server/accounts/store';
import { parseStream } from '@/lib/stream-link';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function view(uid: string, tournamentId?: string | null) {
  ensureAdminInitialized();
  const db = getAdminDb();
  const [acc, user, superAdmin, tAdmin, caster] = await Promise.all([
    getAccount(uid), getAdminAuth().getUser(uid),
    db.collection('admins').doc(uid).get(),
    tournamentId ? db.collection('tournaments').doc(tournamentId).collection('admins').doc(uid).get() : null,
    tournamentId ? db.collection('tournaments').doc(tournamentId).collection('casters').doc(uid).get() : null,
  ]);
  const google = user.providerData.find(p => p.providerId === 'google.com');
  const steam = await Promise.all((acc.steam ?? []).slice(0, 1).map(async s => ({ ...s, avatar: s.avatar ?? await steamAvatar(s.id) })));
  const pictures: Partial<Record<AvatarSource, string>> = {
    ...(user.photoURL && google ? { google: google.photoURL ?? user.photoURL } : {}),
    ...(acc.discord?.avatar ? { discord: acc.discord.avatar } : {}),
    ...(steam[0]?.avatar ? { steam: steam[0].avatar } : {}),
    ...(acc.avatar?.source === 'url' && acc.avatar.url ? { url: acc.avatar.url } : {}),
  };
  const src = acc.avatar?.source ?? (pictures.discord ? 'discord' : 'google');
  return {
    uid,
    nickname: acc.nickname ?? acc.discord?.name ?? user.displayName ?? '',
    avatar: { source: src, url: pictures[src] ?? null },
    pictures,
    discord: acc.discord ? { id: acc.discord.id, username: acc.discord.username, name: acc.discord.name, avatar: acc.discord.avatar } : null,
    steam: steam[0] ?? null,
    google: google ? { email: google.email ?? user.email ?? null } : null,
    /** Roles in the tournament being viewed (the captain role shows as the team below) */
    admin: superAdmin.exists || !!tAdmin?.exists,
    caster: !!caster?.exists,
    stream: acc.stream ?? null,
  };
}

const tid = (req: NextRequest) => { const t = req.nextUrl.searchParams.get('t'); return t && /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : null; };

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try { return NextResponse.json(await view(user.uid, tid(req))); }
  catch (e) { console.error('[account] get failed:', e); return bad('Nie udało się wczytać konta', 500); }
}

/** A picture from the internet: https, a real image, not huge */
async function checkImage(url: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(url); } catch { return 'To nie jest link.'; }
  if (u.protocol !== 'https:' || url.length > 600) return 'Link musi zaczynać się od https://';
  if (!u.hostname.includes('.') || /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|\[)/.test(u.hostname)) return 'Ten adres jest niedostępny.';
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
    const type = r.headers.get('content-type') ?? ''; const size = Number(r.headers.get('content-length') ?? 0);
    if (!r.ok || !/^image\/(png|jpe?g|gif|webp|avif)/.test(type)) return 'Pod tym linkiem nie ma obrazka (PNG, JPG, GIF, WEBP).';
    if (size > 5_000_000) return 'Obrazek jest za duży (maks. 5 MB).';
  } catch { return 'Nie udało się otworzyć obrazka.'; }
  return null;
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return bad('Złe zapytanie');
  try {
    if (b.unlink === 'discord') {
      const r = await unlinkDiscord(user.uid);
      return 'error' in r ? bad(r.error, 409) : NextResponse.json(await view(user.uid, tid(req)));
    }
    if (typeof b.unlink === 'string' && /^\d{17}$/.test(b.unlink)) { await unlinkSteam(user.uid, b.unlink); return NextResponse.json(await view(user.uid, tid(req))); }

    const patch: Record<string, unknown> = {};
    const auth: { displayName?: string; photoURL?: string | null } = {};
    if (b.nickname !== undefined) {
      const n = String(b.nickname).replace(/[\u0000-\u001f\u007f]/g, '').trim();
      if (n.length < 2 || n.length > 32) return bad('Nick musi mieć od 2 do 32 znaków.');
      patch.nickname = n; auth.displayName = n;
    }
    if (b.avatar !== undefined) {
      const src = b.avatar?.source as AvatarSource;
      if (!['google', 'discord', 'steam', 'url'].includes(src)) return bad('Nieznane źródło zdjęcia.');
      if (src === 'url') {
        const problem = await checkImage(String(b.avatar.url ?? ''));
        if (problem) return bad(problem);
        patch.avatar = { source: 'url', url: String(b.avatar.url) };
      } else patch.avatar = { source: src };
    }
    if (b.stream !== undefined) {
      const r = parseStream(String(b.stream));
      if ('error' in r) return bad(r.error);
      patch.stream = r.url || FieldValue.delete();
    }
    if (!Object.keys(patch).length) return bad('Nic do zmiany');
    await accountRef(user.uid).set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const v = await view(user.uid, tid(req));
    // The name and picture everywhere else on the site (sign-in menu, Pick'em…)
    if (b.avatar !== undefined) auth.photoURL = v.avatar.url;
    await getAdminAuth().updateUser(user.uid, auth);
    await getAdminDb().collection('users').doc(user.uid).set({ ...(auth.displayName ? { displayName: auth.displayName } : {}), ...(auth.photoURL !== undefined ? { photoURL: auth.photoURL } : {}) }, { merge: true });
    return NextResponse.json(v);
  } catch (e) { console.error('[account] put failed:', e); return bad('Nie udało się zapisać', 500); }
}
