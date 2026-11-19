// @vitest-environment node
// Runs only against the Firebase emulators:
//   firebase emulators:exec --only firestore,auth --project demo-merge "npx vitest run src/__tests__/account-merge.emulator.test.ts"
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/server/lib/admin', async () => {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  const app = getApps().find(a => a.name === 'merge-test') ?? initializeApp({ projectId: 'demo-merge' }, 'merge-test');
  return { ensureAdminInitialized: () => {}, getAdminDb: () => getFirestore(app), getAdminAuth: () => getAuth(app) };
});

import { getAdminAuth, getAdminDb } from '@/server/lib/admin';
import { linkDiscord } from '@/server/accounts/store';
import { mergeAccounts, mergePreview } from '@/server/accounts/merge';

const on = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const db = () => getAdminDb();
const FROM = 'discord_123456789012345678';
const TO = 'googleUser1';
const STEAM = '76561198000000001';
const identity = { id: '123456789012345678', username: 'maruda', name: 'Maruda', avatar: null, steamIds: [] };

async function wipe() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/demo-merge/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/demo-merge/accounts`, { method: 'DELETE' });
}

/** Maruda's situation: a Google captain account, and a Discord-made one holding cards and Steam */
async function seed() {
  await getAdminAuth().createUser({ uid: TO, displayName: 'Jakub' });
  await getAdminAuth().createUser({ uid: FROM, displayName: 'Maruda' });
  const b = db().batch();
  b.set(db().collection('tournaments').doc('t1'), { name: 'Turniej 1', slug: 't1' });
  b.set(db().collection('tournaments').doc('t2'), { name: 'Turniej 2', slug: 't2' });
  b.set(db().collection('tournaments').doc('t1').collection('teams').doc('team1'), { name: 'Voodoo', captainId: TO });
  b.set(db().collection('accounts').doc(FROM), { discord: { id: identity.id, username: 'maruda', name: 'Maruda', avatar: null }, steam: [{ id: STEAM, source: 'discord' }], nickname: 'Maruda' });
  b.set(db().collection('discordLinks').doc(identity.id), { uid: FROM });
  b.set(db().collection('steamLinks').doc(STEAM), { uid: FROM });
  b.set(db().collection('cardCollections').doc(`t1__${FROM}`), { uid: FROM, tournament: 't1', packs: 0, cards: [{ c: 1 }, { c: 2 }], slots: {} });
  b.set(db().collection('cardCollections').doc(`t2__${FROM}`), { uid: FROM, tournament: 't2', packs: 3, cards: [{ c: 9 }], slots: {} });
  b.set(db().collection('cardCollections').doc(`t2__${TO}`), { uid: TO, tournament: 't2', packs: 10, cards: [], slots: {} });
  b.set(db().collection('cardRankings').doc('t1').collection('players').doc(FROM), { uid: FROM, rating: 1100, games: 2 });
  b.set(db().collection('cardRankings').doc('t1').collection('players').doc(FROM).collection('games').doc('d1'), { won: true });
  b.set(db().collection('cardActivity').doc(FROM), { finds: 3 });
  b.set(db().collection('accounts').doc(FROM).collection('inbox').doc('aaaaaaaaaaaaaaaaaaaaaaaa'), { type: 'duel', title: 'x' });
  await b.commit();
}

describe.skipIf(!on)('merging a Discord-made account into the signed-in one', () => {
  beforeEach(async () => { await wipe(); await seed(); });

  it('offers a merge instead of refusing, and shows what moves', async () => {
    const r = await linkDiscord(TO, identity);
    expect('merge' in r).toBe(true);
    const p = await mergePreview(TO, (r as { merge: string }).merge);
    if ('error' in p) throw new Error(p.error);
    expect(p.steam).toBe('moves');
    const byKey = Object.fromEntries(p.tournaments.map(t => [t.key, t]));
    expect(byKey.t1).toMatchObject({ name: 'Turniej 1', mine: null, other: { cards: 2, packs: 0, games: 2 } });
    expect(byKey.t2).toMatchObject({ mine: { cards: 0, packs: 10 }, other: { cards: 1, packs: 3 } });
  });

  it('asks which collection stays where both have one', async () => {
    const { merge } = await linkDiscord(TO, identity) as { merge: string };
    expect(await mergeAccounts(TO, merge, {})).toEqual({ error: 'Wybierz, którą kolekcję kart zostawić.' });
    expect((await db().collection('discordLinks').doc(identity.id).get()).data()?.uid).toBe(FROM);
  });

  it('moves everything and links the Discord, keeping the other collection when asked', async () => {
    const { merge } = await linkDiscord(TO, identity) as { merge: string };
    expect(await mergeAccounts(TO, merge, { t2: 'other' })).toEqual({ ok: true });

    const t1 = (await db().collection('cardCollections').doc(`t1__${TO}`).get()).data();
    const t2 = (await db().collection('cardCollections').doc(`t2__${TO}`).get()).data();
    expect(t1).toMatchObject({ uid: TO, cards: [{ c: 1 }, { c: 2 }] });
    expect(t2).toMatchObject({ uid: TO, packs: 3, cards: [{ c: 9 }] });
    expect((await db().collection('cardCollections').where('uid', '==', FROM).get()).empty).toBe(true);

    const rank = db().collection('cardRankings').doc('t1').collection('players');
    expect((await rank.doc(TO).get()).data()).toMatchObject({ uid: TO, rating: 1100, games: 2 });
    expect((await rank.doc(TO).collection('games').doc('d1').get()).exists).toBe(true);
    expect((await rank.doc(FROM).get()).exists).toBe(false);

    const acc = (await db().collection('accounts').doc(TO).get()).data();
    expect(acc).toMatchObject({ steam: [{ id: STEAM, source: 'discord' }], nickname: 'Maruda', discord: { id: identity.id } });
    expect((await db().collection('steamLinks').doc(STEAM).get()).data()?.uid).toBe(TO);
    expect((await db().collection('discordLinks').doc(identity.id).get()).data()?.uid).toBe(TO);
    expect((await db().collection('cardActivity').doc(TO).get()).data()).toEqual({ finds: 3 });
    expect((await db().collection('accounts').doc(TO).collection('inbox').doc('aaaaaaaaaaaaaaaaaaaaaaaa').get()).exists).toBe(true);

    expect((await db().collection('accounts').doc(FROM).get()).exists).toBe(false);
    await expect(getAdminAuth().getUser(FROM)).rejects.toThrow();
    expect((await db().collection('accountMerges').doc(merge).get()).exists).toBe(false);
    expect((await db().collection('accountMergeLog').where('to', '==', TO).get()).size).toBe(1);
  });

  it('keeps this account\'s collection when asked, dropping the other one', async () => {
    const { merge } = await linkDiscord(TO, identity) as { merge: string };
    expect(await mergeAccounts(TO, merge, { t2: 'mine' })).toEqual({ ok: true });
    expect((await db().collection('cardCollections').doc(`t2__${TO}`).get()).data()).toMatchObject({ packs: 10, cards: [] });
    expect((await db().collection('cardCollections').doc(`t2__${FROM}`).get()).exists).toBe(false);
  });

  it('only the signed-in account the ticket was made for can use it', async () => {
    const { merge } = await linkDiscord(TO, identity) as { merge: string };
    expect(await mergeAccounts('someoneElse', merge, { t2: 'other' })).toEqual({ error: 'Nieprawidłowe połączenie kont.' });
  });

  it('still refuses when the Discord account captains a team', async () => {
    await db().collection('tournaments').doc('t2').collection('teams').doc('team2').set({ name: 'Other', captainId: FROM });
    const r = await linkDiscord(TO, identity);
    expect('error' in r).toBe(true);
  });
});
