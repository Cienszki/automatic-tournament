// Accounts: one per person, signed in with Discord or Google, with Discord and Steam linked to it.
//   accounts/{uid}         what the account is linked to + profile (server-written; the owner may read)
//   discordLinks/{id}      Discord user → account (one account per Discord user)
//   steamLinks/{steamId64} Steam account → account (one account per Steam account)
// Never `users/{uid}` for any of this: its owner can write it. We only mirror the verified Discord name
// there (`discordUsername`), because the existing pages (registration, Pick'em) read it.

import { FieldValue } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminAuth, getAdminDb } from '@/server/lib/admin';
import { steam32to64, type DiscordIdentity } from './identity';

export type AvatarSource = 'google' | 'discord' | 'steam' | 'url';
export interface AccountDoc {
  discord?: { id: string; username: string; name: string; avatar: string | null; linkedAt?: unknown };
  steam?: Array<{ id: string; source: 'discord' | 'inhouse' | 'steam'; avatar?: string | null }>;
  nickname?: string;
  avatar?: { source: AvatarSource; url?: string };
  /** Stream link, any platform (casters show it on their matches; src/lib/stream-link.ts) */
  stream?: string;
}

const db = () => { ensureAdminInitialized(); return getAdminDb(); };
export const accountRef = (uid: string) => db().collection('accounts').doc(uid);

export async function getAccount(uid: string): Promise<AccountDoc> {
  const s = await accountRef(uid).get();
  return (s.data() as AccountDoc) ?? {};
}

/** Steam accounts the bot already knows for this Discord user (the dota2inhouse.pl !link flow) */
async function inhouseSteam(discordId: string): Promise<string[]> {
  const s = await db().collection('inhousePlayers').doc(discordId).get();
  const ids = (s.data()?.steamIds ?? []) as string[];
  return ids.filter(x => /^\d+$/.test(x)).map(steam32to64);
}

/** Links a Steam account no other account holds (only while none is linked); returns those that belong to someone else */
async function addSteam(uid: string, ids: Array<{ id: string; source: 'discord' | 'inhouse' | 'steam' }>): Promise<string[]> {
  const conflicts: string[] = [];
  const ref = accountRef(uid);
  await db().runTransaction(async tx => {
    const acc = ((await tx.get(ref)).data() as AccountDoc) ?? {};
    // One Steam account per site account: keep the one already linked, else take the first free one
    if (acc.steam?.length) return;
    const links = await Promise.all(ids.map(i => tx.get(db().collection('steamLinks').doc(i.id))));
    const k = ids.findIndex((_, n) => { const owner = links[n].data()?.uid; return !owner || owner === uid; });
    ids.forEach((i, n) => { const owner = links[n].data()?.uid; if (owner && owner !== uid) conflicts.push(i.id); });
    if (k < 0) return;
    if (!links[k].data()?.uid) tx.set(db().collection('steamLinks').doc(ids[k].id), { uid, at: FieldValue.serverTimestamp() });
    tx.set(ref, { steam: [{ id: ids[k].id, source: ids[k].source }], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return conflicts;
}

/** Links a Discord user to an account (and the Steam accounts known for them). Refuses one held by another account. */
export async function linkDiscord(uid: string, d: DiscordIdentity): Promise<{ ok: true; steamConflicts: string[] } | { error: string }> {
  const linkRef = db().collection('discordLinks').doc(d.id);
  const res = await db().runTransaction<{ error: string } | { ok: true }>(async tx => {
    const owner = (await tx.get(linkRef)).data()?.uid;
    if (owner && owner !== uid) return { error: 'Ten Discord jest już połączony z innym kontem.' };
    const acc = ((await tx.get(accountRef(uid))).data() as AccountDoc) ?? {};
    if (acc.discord && acc.discord.id !== d.id) tx.delete(db().collection('discordLinks').doc(acc.discord.id));
    tx.set(linkRef, { uid, at: FieldValue.serverTimestamp() });
    tx.set(accountRef(uid), {
      discord: { id: d.id, username: d.username, name: d.name, avatar: d.avatar, linkedAt: FieldValue.serverTimestamp() },
      ...(acc.avatar ? {} : { avatar: { source: 'discord' } }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(db().collection('users').doc(uid), { discordUsername: d.username }, { merge: true });
    return { ok: true as const };
  });
  if ('error' in res) return res;
  const fromInhouse = await inhouseSteam(d.id).catch(() => []);
  const steamConflicts = await addSteam(uid, [
    ...d.steamIds.map(id => ({ id, source: 'discord' as const })),
    ...fromInhouse.filter(id => !d.steamIds.includes(id)).map(id => ({ id, source: 'inhouse' as const })),
  ]);
  return { ok: true, steamConflicts };
}

/** Signing in with Discord: the account it is linked to, or a new account made for it */
export async function accountForDiscord(d: DiscordIdentity): Promise<string> {
  const owner = (await db().collection('discordLinks').doc(d.id).get()).data()?.uid as string | undefined;
  if (owner) {
    // Keep the name and picture current
    await accountRef(owner).set({ discord: { id: d.id, username: d.username, name: d.name, avatar: d.avatar }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db().collection('users').doc(owner).set({ discordUsername: d.username }, { merge: true });
    return owner;
  }
  const uid = `discord_${d.id}`;
  const auth = getAdminAuth();
  try { await auth.getUser(uid); } catch { await auth.createUser({ uid, displayName: d.name, ...(d.avatar ? { photoURL: d.avatar } : {}) }); }
  await db().collection('users').doc(uid).set({ uid, displayName: d.name, ...(d.avatar ? { photoURL: d.avatar } : {}) }, { merge: true });
  const r = await linkDiscord(uid, d);
  if ('error' in r) throw new Error(r.error);
  return uid;
}

export const linkSteam = (uid: string, steamId64: string) => addSteam(uid, [{ id: steamId64, source: 'steam' }]);

export async function unlinkSteam(uid: string, steamId64: string) {
  await db().runTransaction(async tx => {
    const ref = accountRef(uid); const linkRef = db().collection('steamLinks').doc(steamId64);
    const [acc, link] = [((await tx.get(ref)).data() as AccountDoc) ?? {}, (await tx.get(linkRef)).data()];
    tx.set(ref, { steam: (acc.steam ?? []).filter(s => s.id !== steamId64), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (link?.uid === uid) tx.delete(linkRef);
  });
}

/** Removes the Discord link (only when the account can still sign in another way) */
export async function unlinkDiscord(uid: string): Promise<{ error: string } | { ok: true }> {
  const user = await getAdminAuth().getUser(uid);
  if (!user.providerData.some(p => p.providerId === 'google.com')) return { error: 'To jedyny sposób logowania na to konto.' };
  const acc = await getAccount(uid);
  if (!acc.discord) return { ok: true };
  await db().collection('discordLinks').doc(acc.discord.id).delete();
  await accountRef(uid).set({ discord: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
}

/** Everything about the account is removed: links, collections, profile, the sign-in itself */
export async function deleteAccount(uid: string) {
  const acc = await getAccount(uid);
  const batch = db().batch();
  if (acc.discord) batch.delete(db().collection('discordLinks').doc(acc.discord.id));
  for (const s of acc.steam ?? []) batch.delete(db().collection('steamLinks').doc(s.id));
  const cards = await db().collection('cardCollections').where('uid', '==', uid).get();
  cards.docs.forEach(d => batch.delete(d.ref));
  batch.delete(accountRef(uid));
  batch.delete(db().collection('users').doc(uid));
  await batch.commit();
  await getAdminAuth().deleteUser(uid).catch(() => {});
}
