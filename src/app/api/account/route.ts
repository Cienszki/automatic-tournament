/**
 * The signed-in account.
 *   GET                                   → profile, linked Discord / Steam / Google, roles, card collections
 *   PUT  { nickname?, avatar? }           → profile (avatar: { source: 'google'|'discord'|'steam'|'url', url? })
 *   PUT  { unlink: 'discord' | steamId64 } → removes a link
 *   DELETE                                → deletes the account and everything tied to it
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser } from '@/server/lib/require-user';
import { ensureAdminInitialized, getAdminAuth, getAdminDb } from '@/server/lib/admin';
import { steamAvatar } from '@/server/accounts/identity';
import { accountRef, deleteAccount, getAccount, unlinkDiscord, unlinkSteam, type AvatarSource } from '@/server/accounts/store';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function view(uid: string) {
  ensureAdminInitialized();
  const db = getAdminDb();
  const [acc, user, superAdmin, tournaments, cards] = await Promise.all([
    getAccount(uid), getAdminAuth().getUser(uid),
    db.collection('admins').doc(uid).get(),
    db.collection('tournaments').select('name', 'slug', 'status').get(),
    db.collection('cardCollections').where('uid', '==', uid).get(),
  ]);
  const google = user.providerData.find(p => p.providerId === 'google.com');
  // Roles per tournament: admin, captain
  const perT = await Promise.all(tournaments.docs.map(async t => {
    const [adm, teams] = await Promise.all([
      t.ref.collection('admins').doc(uid).get(),
      t.ref.collection('teams').where('captainId', '==', uid).select('name', 'tag', 'logoUrl').get(),
    ]);
    const d = t.data();
    return { id: t.id, name: d.name as string, slug: d.slug as string, admin: adm.exists, teams: teams.docs.map(x => ({ id: x.id, ...(x.data() as { name: string; tag?: string; logoUrl?: string }) })) };
  }));
  const steam = await Promise.all((acc.steam ?? []).map(async s => ({ ...s, avatar: s.avatar ?? await steamAvatar(s.id) })));
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
    steam,
    google: google ? { email: google.email ?? user.email ?? null } : null,
    superAdmin: superAdmin.exists,
    tournaments: perT.filter(t => t.admin || t.teams.length),
    cards: cards.docs.map(c => {
      const d = c.data(); const t = tournaments.docs.find(x => x.id === d.tournament)?.data();
      return { tournament: d.tournament as string, name: (t?.name as string) ?? 'Letnia Batalia', slug: (t?.slug as string) ?? 'letnia', cards: (d.cards ?? []).length as number, packs: d.packs as number };
    }),
  };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try { return NextResponse.json(await view(user.uid)); }
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
      return 'error' in r ? bad(r.error, 409) : NextResponse.json(await view(user.uid));
    }
    if (typeof b.unlink === 'string' && /^\d{17}$/.test(b.unlink)) { await unlinkSteam(user.uid, b.unlink); return NextResponse.json(await view(user.uid)); }

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
    if (!Object.keys(patch).length) return bad('Nic do zmiany');
    await accountRef(user.uid).set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const v = await view(user.uid);
    // The name and picture everywhere else on the site (sign-in menu, Pick'em…)
    if (b.avatar !== undefined) auth.photoURL = v.avatar.url;
    await getAdminAuth().updateUser(user.uid, auth);
    await getAdminDb().collection('users').doc(user.uid).set({ ...(auth.displayName ? { displayName: auth.displayName } : {}), ...(auth.photoURL !== undefined ? { photoURL: auth.photoURL } : {}) }, { merge: true });
    return NextResponse.json(v);
  } catch (e) { console.error('[account] put failed:', e); return bad('Nie udało się zapisać', 500); }
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  try { await deleteAccount(user.uid); return NextResponse.json({ ok: true }); }
  catch (e) { console.error('[account] delete failed:', e); return bad('Nie udało się usunąć konta', 500); }
}
