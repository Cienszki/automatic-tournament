// Merging an account made by "Zaloguj przez Discord" into the account its owner really uses.
// Linking a Discord that such an account holds creates a ticket (accountMerges/{id}, see
// linkDiscord in ./store.ts); the page shows what would move (mergePreview) and the person confirms
// (mergeAccounts). What moves: card collections with their card-game ranking and game history, the
// pack-finding activity, the linked Steam account, the inbox and unset profile fields. Where both
// accounts have a collection for the same tournament, the person chooses which one stays. Then the
// old account is deleted and the Discord is linked to the one they use.

import { FieldValue } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { type DiscordIdentity } from './identity';
import { accountRef, deleteAccount, getAccount, isDiscordOnlyWithoutRoles, linkDiscord } from './store';

const db = () => { ensureAdminInitialized(); return getAdminDb(); };

interface Ticket { to: string; from: string; discord: DiscordIdentity; exp: number }
export type Keep = 'mine' | 'other';

interface Pile { cards: number; packs: number; games: number }
export interface MergePreview {
  discord: { username: string; name: string };
  /** One line per tournament where the other account has cards; `mine` is set when this account has a collection there too */
  tournaments: Array<{ key: string; name: string; other: Pile; mine: Pile | null }>;
  /** The other account's Steam moves here (this one has none), or is dropped (this one has its own) */
  steam: 'moves' | 'dropped' | null;
}

async function ticket(id: string, uid: string): Promise<{ t: Ticket } | { error: string }> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { error: 'Nieprawidłowe połączenie kont.' };
  const t = (await db().collection('accountMerges').doc(id).get()).data() as Ticket | undefined;
  if (!t || t.to !== uid) return { error: 'Nieprawidłowe połączenie kont.' };
  if (t.exp < Date.now()) return { error: 'Minęło za dużo czasu. Połącz Discord jeszcze raz.' };
  if ((await db().collection('discordLinks').doc(t.discord.id).get()).data()?.uid !== t.from || !await isDiscordOnlyWithoutRoles(t.from)) {
    return { error: 'Tamto konto zmieniło się w międzyczasie. Połącz Discord jeszcze raz albo napisz do organizatorów.' };
  }
  return { t };
}

const collections = (uid: string) => db().collection('cardCollections').where('uid', '==', uid).get();
const collectionRef = (key: string, uid: string) => db().collection('cardCollections').doc(`${key}__${uid}`);
const rankingRef = (key: string, uid: string) => db().collection('cardRankings').doc(key).collection('players').doc(uid);

async function pile(key: string, uid: string, data: FirebaseFirestore.DocumentData): Promise<Pile> {
  const r = (await rankingRef(key, uid).get()).data();
  return { cards: (data.cards ?? []).length, packs: data.packs ?? 0, games: (r?.games as number | undefined) ?? 0 };
}

async function tournamentName(key: string): Promise<string> {
  if (key === 'letnia') return 'Letnia';
  return ((await db().collection('tournaments').doc(key).get()).data()?.name as string | undefined) ?? key;
}

export async function mergePreview(uid: string, id: string): Promise<MergePreview | { error: string }> {
  const r = await ticket(id, uid);
  if ('error' in r) return r;
  const { t } = r;
  const theirs = await collections(t.from);
  const tournaments = await Promise.all(theirs.docs.map(async c => {
    const key = c.data().tournament as string;
    const mine = await collectionRef(key, uid).get();
    return { key, name: await tournamentName(key), other: await pile(key, t.from, c.data()), mine: mine.exists ? await pile(key, uid, mine.data()!) : null };
  }));
  const [me, them] = await Promise.all([getAccount(uid), getAccount(t.from)]);
  const steam = them.steam?.length ? (me.steam?.length ? 'dropped' : 'moves') : null;
  return { discord: { username: t.discord.username, name: t.discord.name }, tournaments, steam };
}

/** Copies a ranking entry with its game history to another account, replacing what was there */
async function moveRanking(key: string, from: string, to: string, replace: boolean) {
  const src = rankingRef(key, from);
  const [s, games] = await Promise.all([src.get(), src.collection('games').get()]);
  if (s.exists && replace) {
    const dst = rankingRef(key, to);
    const old = await dst.collection('games').get();
    await Promise.all(old.docs.map(g => g.ref.delete()));
    await dst.set({ ...s.data(), uid: to });
    await Promise.all(games.docs.map(g => dst.collection('games').doc(g.id).set(g.data())));
  }
  await Promise.all(games.docs.map(g => g.ref.delete()));
  if (s.exists) await src.delete();
}

export async function mergeAccounts(uid: string, id: string, keep: Record<string, Keep>): Promise<{ ok: true } | { error: string }> {
  const r = await ticket(id, uid);
  if ('error' in r) return r;
  const { t } = r;
  const from = t.from;

  // A card match in progress would lose its player
  const live = await db().collection('cardDuels').where('sides', 'array-contains', from).get();
  if (live.docs.some(d => ['open', 'seated', 'play'].includes(d.data().status))) {
    return { error: 'Tamto konto gra teraz w karty. Połącz konta po skończonym meczu.' };
  }

  const theirs = await collections(from);
  const mineByKey = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  for (const c of theirs.docs) mineByKey.set(c.data().tournament, await collectionRef(c.data().tournament, uid).get());
  const unanswered = theirs.docs.filter(c => mineByKey.get(c.data().tournament)!.exists && !['mine', 'other'].includes(keep[c.data().tournament]));
  if (unanswered.length) return { error: 'Wybierz, którą kolekcję kart zostawić.' };

  const moved: Record<string, Keep | 'only'> = {};
  for (const c of theirs.docs) {
    const key = c.data().tournament as string;
    const mine = mineByKey.get(key)!;
    const take = !mine.exists || keep[key] === 'other';
    if (take) await collectionRef(key, uid).set({ ...c.data(), uid, updatedAt: FieldValue.serverTimestamp(), ...(mine.exists ? { createdAt: mine.data()!.createdAt ?? FieldValue.serverTimestamp() } : {}) });
    await moveRanking(key, from, uid, take);
    await c.ref.delete();
    moved[key] = mine.exists ? keep[key] : 'only';
  }

  // Pack-finding activity: kept when this account has none
  const actFrom = db().collection('cardActivity').doc(from);
  const actTo = db().collection('cardActivity').doc(uid);
  const [af, at] = await Promise.all([actFrom.get(), actTo.get()]);
  if (af.exists && !at.exists) await actTo.set(af.data()!);
  if (af.exists) await actFrom.delete();

  // Inbox items move over (same ids, so nothing arrives twice)
  const inbox = await accountRef(from).collection('inbox').limit(400).get();
  for (const x of inbox.docs) {
    await accountRef(uid).collection('inbox').doc(x.id).create(x.data()).catch(() => {});
    await x.ref.delete();
  }

  // Steam (one per account) and the profile fields this account hasn't set
  const [me, them] = await Promise.all([getAccount(uid), getAccount(from)]);
  const patch: Record<string, unknown> = {};
  if (!me.steam?.length && them.steam?.length) {
    for (const s of them.steam) await db().collection('steamLinks').doc(s.id).set({ uid, at: FieldValue.serverTimestamp() });
    patch.steam = them.steam;
    // so deleting the old account below doesn't remove the links that just moved
    await accountRef(from).set({ steam: [] }, { merge: true });
  }
  if (!me.nickname && them.nickname) patch.nickname = them.nickname;
  if (!me.stream && them.stream) patch.stream = them.stream;
  const themNotify = (await accountRef(from).get()).data()?.notify;
  const meNotify = (await accountRef(uid).get()).data()?.notify;
  if (themNotify && !meNotify) patch.notify = themNotify;
  if (Object.keys(patch).length) await accountRef(uid).set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  // The old account goes (with its Discord link), then the Discord joins this one
  await deleteAccount(from);
  const linked = await linkDiscord(uid, t.discord);
  if (!('ok' in linked)) return { error: 'error' in linked ? linked.error : 'Nie udało się połączyć Discorda.' };

  await db().collection('accountMerges').doc(id).delete();
  await db().collection('accountMergeLog').add({ to: uid, from, discordId: t.discord.id, moved, at: FieldValue.serverTimestamp() });
  return { ok: true };
}
