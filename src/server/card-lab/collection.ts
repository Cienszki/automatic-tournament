// Card collections live on the server: one document per account and tournament, written only here
// (Firestore rules deny clients). Packs are drawn on the server and every card is frozen when issued.

import { randomInt } from 'crypto';
import { unstable_cache } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { buildStatsDataset } from '@/lib/stats-lab/build-dataset';
import { deriveModel } from '@/lib/stats-lab/derive';
import { autoDeck, buildSeriesCards, deckProblem, openPack, packPool, type DeckRule, type GCard } from '@/lib/card-lab/cards';
import { DECK_PER_ROLE, DECK_SIZE } from '@/lib/card-lab/outposts';
import { freezeCard, slotsForDeck, slotsProblem, thawCard, type DeckSlots, type FrozenCard } from '@/lib/card-lab/frozen';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { getAccount } from '@/server/accounts/store';

export const START_PACKS = 10;
export const DECK_RULE: DeckRule = { size: DECK_SIZE, perRole: DECK_PER_ROLE, text: '' };
export const validKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(k);

/** Rivals and the ranking see a name: an account plays cards only with its own nick set or Discord linked */
export async function hasName(uid: string): Promise<boolean> {
  ensureAdminInitialized();
  const a = await getAccount(uid);
  return !!a.nickname?.trim() || !!a.discord;
}
export const NEED_NAME = { error: 'Najpierw ustaw nick albo połącz Discord', need: 'name' } as const;

export interface CollectionState { packs: number; cards: FrozenCard[]; slots: DeckSlots }

// Same cache entry as /api/stats/dataset, so the card pool is the stats the visitor sees
const cachedDataset = (key: string) =>
  unstable_cache(() => buildStatsDataset(key === 'letnia' ? null : key), ['stats-dataset-v5', key], { revalidate: 600, tags: [`stats-dataset-${key}`] })();

const catalogs = new Map<string, { at: number; cards: GCard[] }>();
/** Every card of a tournament (rebuilt at most every 10 minutes per server instance) */
async function catalog(key: string): Promise<GCard[]> {
  const hit = catalogs.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.cards;
  ensureAdminInitialized();
  const [ds, tDoc] = await Promise.all([cachedDataset(key), key === 'letnia' ? null : getAdminDb().collection('tournaments').doc(key).get()]);
  const cards = buildSeriesCards(deriveModel(ds), tDoc?.data()?.type);
  catalogs.set(key, { at: Date.now(), cards });
  return cards;
}

const ref = (key: string, uid: string) => getAdminDb().collection('cardCollections').doc(`${key}__${uid}`);
const toState = (d: FirebaseFirestore.DocumentData): CollectionState => ({ packs: d.packs ?? 0, cards: d.cards ?? [], slots: d.slots ?? {} });

/** The account's collection; a new account gets its starter packs */
export async function getCollection(key: string, uid: string): Promise<CollectionState> {
  ensureAdminInitialized();
  const r = ref(key, uid);
  return getAdminDb().runTransaction(async tx => {
    const snap = await tx.get(r);
    if (snap.exists) return toState(snap.data()!);
    const fresh = { uid, tournament: key, packs: START_PACKS, cards: [], slots: {}, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    tx.set(r, fresh);
    return { packs: START_PACKS, cards: [], slots: {} };
  });
}

/** Opens one pack: drawn here with a secure random, frozen, added to the collection */
export async function openOnePack(key: string, uid: string): Promise<{ opened: FrozenCard[]; state: CollectionState } | { error: string }> {
  const cards = await catalog(key);
  const pool = packPool(cards);
  ensureAdminInitialized();
  const r = ref(key, uid);
  return getAdminDb().runTransaction(async tx => {
    const snap = await tx.get(r);
    if (!snap.exists) return { error: 'Brak kolekcji' };
    const state = toState(snap.data()!);
    if (state.packs < 1) return { error: 'Brak paczek' };
    const opened = openPack(pool, () => randomInt(0, 2 ** 32) / 2 ** 32).map(freezeCard);
    if (!opened.length) return { error: 'Brak kart w tym turnieju' };
    const next = { ...state, packs: state.packs - 1, cards: [...state.cards, ...opened] };
    tx.update(r, { packs: next.packs, cards: next.cards, opened: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { opened, state: next };
  });
}

/** Saves the deck layout, if every card is owned and sits where it may */
export async function saveSlots(key: string, uid: string, slots: DeckSlots): Promise<{ error: string } | { ok: true }> {
  ensureAdminInitialized();
  const r = ref(key, uid);
  return getAdminDb().runTransaction(async tx => {
    const snap = await tx.get(r);
    if (!snap.exists) return { error: 'Brak kolekcji' };
    const owned = new Map(toState(snap.data()!).cards.map(c => [c.id, { pid: c.pid, role: c.role, team: c.team?.id }]));
    const problem = slotsProblem(slots, owned, DECK_RULE);
    if (problem) return { error: problem };
    tx.update(r, { slots, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true as const };
  });
}

/** The account's saved deck, ready to play, or why it can't be played */
export async function playableDeck(key: string, uid: string): Promise<{ deck: GCard[] } | { error: string }> {
  ensureAdminInitialized();
  const snap = await ref(key, uid).get();
  if (!snap.exists) return { error: 'Najpierw otwórz paczki' };
  const st = toState(snap.data()!);
  const byId = new Map(st.cards.map(c => [c.id, c]));
  const deck = Object.values(st.slots).map(id => byId.get(id)).filter((c): c is FrozenCard => !!c).map(thawCard);
  const problem = deckProblem(deck, DECK_RULE);
  return problem ? { error: `Talia niegotowa: ${problem}` } : { deck };
}

/** "Szybka talia" (only on a newcomer's first-game path): the best legal deck from the collection, saved */
export async function quickDeck(key: string, uid: string): Promise<{ slots: DeckSlots } | { error: string }> {
  ensureAdminInitialized();
  const r = ref(key, uid);
  return getAdminDb().runTransaction(async tx => {
    const snap = await tx.get(r);
    if (!snap.exists) return { error: 'Najpierw otwórz paczki' };
    const st = toState(snap.data()!);
    const deck = autoDeck(st.cards.map(thawCard), DECK_RULE);
    const problem = deckProblem(deck, DECK_RULE);
    if (problem) return { error: `Za mało kart na talię: ${problem}` };
    const slots = slotsForDeck(deck, DECK_RULE);
    tx.update(r, { slots, updatedAt: FieldValue.serverTimestamp() });
    return { slots };
  });
}

/** Gives an account packs (an admin's grant); an account that never opened the cards gets them on top of its starter packs */
export async function addPacks(key: string, uid: string, n: number): Promise<number> {
  ensureAdminInitialized();
  const r = ref(key, uid);
  return getAdminDb().runTransaction(async tx => {
    const snap = await tx.get(r);
    if (!snap.exists) {
      tx.set(r, { uid, tournament: key, packs: START_PACKS + n, cards: [], slots: {}, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return START_PACKS + n;
    }
    const packs = toState(snap.data()!).packs + n;
    tx.update(r, { packs, updatedAt: FieldValue.serverTimestamp() });
    return packs;
  });
}

/** Gives every collection of the tournament `n` packs; returns the accounts that got them */
export async function addPacksToAll(key: string, n: number): Promise<string[]> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const snap = await db.collection('cardCollections').where('tournament', '==', key).select('uid').get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) batch.update(d.ref, { packs: FieldValue.increment(n), updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
  }
  return snap.docs.map(d => d.data().uid as string).filter(Boolean);
}
