// Card duels between two players (the rules and clocks: src/lib/card-lab/pvp.ts).
//
//   cardDuels/{id}                  the duel and its full game (server-only: it holds both hands)
//   cardDuels/{id}/views/{uid}      what each participant sees (DuelView as JSON), read live by
//                                   their browser; written here on every change
//   cardRankings/{key}/players/{uid}            rating, games, wins (the public ranking)
//   cardRankings/{key}/players/{uid}/games/{id} each finished duel, for the history
//   cardRankings/{key}/pairs/{day}__{a}__{b}    games of a pair that day (repeats count less)
//
// A duel starts as a lobby: an open link anyone may take, or a challenge for one player. The host
// keeps it open by being on its page; whoever presses "Przyjmij" first gets the seat and has
// LOBBY.seat to be ready (log in, packs, deck); then the match starts with both saved decks.

import { randomBytes, randomInt } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminAuth, getAdminDb } from '@/server/lib/admin';
import { getAccount } from '@/server/accounts/store';
import { notify, tournamentInfo } from '@/server/notify/notify';
import { playableDeck } from './collection';
import {
  act, eloDelta, fromView, LOBBY, settle, startGame, START_RATING, viewFor,
  type DuelStatus, type DuelView, type EndReason, type Game, type Person, type PvpAction,
} from '@/lib/card-lab/pvp';
import type { Side } from '@/lib/card-lab/outposts';

const db = () => { ensureAdminInitialized(); return getAdminDb(); };
const duels = () => db().collection('cardDuels');
const rnd = () => randomInt(0, 2 ** 32) / 2 ** 32;

interface DuelDoc {
  key: string;
  kind: 'open' | 'direct';
  status: DuelStatus;
  host: Person;
  guest: Person | null;
  invited: Person | null;
  hostSeen: number;
  seatUntil: number | null;
  expiresAt: number;
  createdAt: number;
  /** uids by side (side 0 moves first) */
  sides: [string, string] | null;
  players: [Person, Person] | null;
  /** The game as JSON (nested arrays and undefined fields don't fit Firestore maps) */
  game: string | null;
  rated: boolean;
  result: { winner: Side; reason: EndReason; delta: [number, number] | null; rating: [number, number] | null } | null;
  updatedAt: number;
}

export async function personOf(uid: string): Promise<Person> {
  const [acc, user] = await Promise.all([getAccount(uid), getAdminAuth().getUser(uid).catch(() => null)]);
  const avatar = acc.avatar?.source === 'url' ? acc.avatar.url ?? null : acc.avatar?.source === 'google' ? user?.photoURL ?? null : acc.discord?.avatar ?? user?.photoURL ?? null;
  return { uid, name: acc.nickname ?? acc.discord?.name ?? user?.displayName ?? 'Gracz', avatar };
}

/** The lobby is dead: past its time, or its host left (unless someone already sits in it) */
const lobbyDead = (d: DuelDoc, now: number) => (d.status === 'open' || d.status === 'seated') && (now > d.expiresAt || (d.status === 'open' && now - d.hostSeen > LOBBY.hostAway));
/** A seat whose holder never got ready is free again */
const seatLapsed = (d: DuelDoc, now: number) => d.status === 'seated' && !!d.seatUntil && now > d.seatUntil;

function viewOf(id: string, d: DuelDoc, uid: string, now: number): DuelView {
  const side = d.sides ? (d.sides.indexOf(uid) as Side) : null;
  const game = d.game && side !== null && side >= 0 ? viewFor(JSON.parse(d.game) as Game, side) : null;
  const players = d.players && side !== null && side >= 0 ? (side === 0 ? d.players : [d.players[1], d.players[0]]) as [Person, Person] : null;
  const result = d.result && side !== null && side >= 0
    ? { won: d.result.winner === side, reason: d.result.reason, delta: d.result.delta?.[side] ?? null, rating: d.result.rating?.[side] ?? null }
    : null;
  return {
    id, key: d.key, status: d.status, kind: d.kind, me: uid === d.host.uid ? 'host' : 'guest',
    host: d.host, guest: d.guest, invited: d.invited, seatUntil: d.seatUntil, expiresAt: d.expiresAt,
    players, game, result, at: now,
  };
}

/** Writes the duel and every participant's view in one go */
function write(tx: FirebaseFirestore.Transaction, id: string, d: DuelDoc, now: number, also: string[] = []) {
  const ref = duels().doc(id);
  tx.set(ref, { ...d, updatedAt: now });
  const uids = new Set([d.host.uid, ...(d.guest ? [d.guest.uid] : []), ...also]);
  for (const uid of uids) tx.set(ref.collection('views').doc(uid), { json: JSON.stringify(viewOf(id, { ...d, updatedAt: now }, uid, now)), at: now });
}

// ── Lobby ───────────────────────────────────────────────────────────────────

export async function createDuel(key: string, hostUid: string, invitedUid: string | null): Promise<{ id: string } | { error: string }> {
  const deck = await playableDeck(key, hostUid);
  if ('error' in deck) return deck;
  if (invitedUid === hostUid) return { error: 'Nie możesz wyzwać samego siebie' };
  const [host, invited] = await Promise.all([personOf(hostUid), invitedUid ? personOf(invitedUid) : null]);
  const id = randomBytes(9).toString('base64url');
  const now = Date.now();
  const d: DuelDoc = {
    key, kind: invited ? 'direct' : 'open', status: 'open', host, guest: null, invited, hostSeen: now, seatUntil: null,
    expiresAt: now + LOBBY.max, createdAt: now, sides: null, players: null, game: null, rated: false, result: null, updatedAt: now,
  };
  await db().runTransaction(async tx => { write(tx, id, d, now); });
  if (invited) {
    const t = await tournamentInfo(key);
    await notify([invited.uid], {
      type: 'duel', key: `duel:${id}`, tournament: t, href: `/${t?.slug ?? key}/cards/duel/${id}`,
      title: `${host.name} wyzywa cię na pojedynek`, body: 'Kontrola mapy: twoja talia przeciw talii rywala. Wyzwanie czeka, dopóki rywal jest na stronie.',
    }).catch(e => console.warn('[duels] invite notify failed', e));
  }
  return { id };
}

/** For anyone with the link (no account needed): who challenges, and can it still be taken */
export async function publicLobby(id: string) {
  const snap = await duels().doc(id).get();
  const d = snap.data() as DuelDoc | undefined;
  if (!d) return null;
  const now = Date.now();
  const status: DuelStatus = lobbyDead(d, now) ? 'expired' : seatLapsed(d, now) ? 'open' : d.status;
  return { id, key: d.key, kind: d.kind, status, host: d.host, invited: d.invited, guest: status === 'seated' || status === 'play' ? d.guest : null, players: d.players };
}

type Res = { ok: true } | { error: string; status?: number };

async function update(id: string, uid: string, fn: (d: DuelDoc, now: number) => DuelDoc | { error: string; status?: number } | null): Promise<Res> {
  const ref = duels().doc(id);
  const out = await db().runTransaction<Res & { finished?: boolean }>(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: 'Nie ma takiego pojedynku', status: 404 };
    const now = Date.now();
    const before = snap.data() as DuelDoc;
    const next = fn(before, now);
    if (!next) return { ok: true };
    if ('error' in next) return next;
    write(tx, id, next, now, before.guest && before.guest.uid !== next.guest?.uid ? [before.guest.uid] : []);
    return { ok: true, finished: next.status === 'done' && !next.rated };
  });
  if ('finished' in out && out.finished) await rate(id).catch(e => console.error('[duels] rating failed', e));
  return 'error' in out ? out : { ok: true };
}

/** "Przyjmij": the seat is yours for LOBBY.seat */
export async function takeSeat(id: string, uid: string): Promise<Res> {
  const me = await personOf(uid);
  return update(id, uid, (d, now) => {
    if (d.host.uid === uid) return { error: 'To twoje wyzwanie' };
    if (lobbyDead(d, now)) return { error: 'Wyzwanie wygasło', status: 410 };
    if (d.invited && d.invited.uid !== uid) return { error: `To wyzwanie jest dla gracza ${d.invited.name}`, status: 403 };
    if (d.status === 'seated' && d.guest?.uid === uid) return { ...d, seatUntil: now + LOBBY.seat };
    if (d.status !== 'open' && !seatLapsed(d, now)) return { error: 'Ktoś był szybszy', status: 409 };
    return { ...d, status: 'seated', guest: me, seatUntil: now + LOBBY.seat };
  });
}

/** The guest is ready: the match starts with both saved decks, who begins is drawn */
export async function startMatch(id: string, uid: string): Promise<Res> {
  const pre = (await duels().doc(id).get()).data() as DuelDoc | undefined;
  if (!pre) return { error: 'Nie ma takiego pojedynku', status: 404 };
  const players = db().collection('cardRankings').doc(pre.key).collection('players');
  const [hd, gd, hr, gr] = await Promise.all([playableDeck(pre.key, pre.host.uid), playableDeck(pre.key, uid), players.doc(pre.host.uid).get(), players.doc(uid).get()]);
  if ('error' in gd) return gd;
  if ('error' in hd) return { error: `Talia rywala jest niegotowa (${hd.error.replace(/^Talia niegotowa: /, '')})` };
  const rating = (s: FirebaseFirestore.DocumentSnapshot) => (s.data()?.rating as number | undefined) ?? START_RATING;
  return update(id, uid, (d, now) => {
    if (d.status !== 'seated' || d.guest?.uid !== uid || seatLapsed(d, now)) return { error: 'Twoje miejsce wygasło: przyjmij wyzwanie jeszcze raz', status: 409 };
    if (now > d.expiresAt) return { error: 'Wyzwanie wygasło', status: 410 };
    const hostFirst = rnd() < 0.5;
    const h = { ...d.host, rating: rating(hr) }; const g = { ...d.guest, rating: rating(gr) };
    const order: [Person, Person] = hostFirst ? [h, g] : [g, h];
    const decks = hostFirst ? [hd.deck, gd.deck] as const : [gd.deck, hd.deck] as const;
    const game = startGame([decks[0], decks[1]], rnd, now);
    return { ...d, status: 'play', sides: [order[0].uid, order[1].uid], players: order, game: JSON.stringify(game), seatUntil: null };
  });
}

/** Host: close the lobby (or give up the match) · guest: give the seat back */
export async function leave(id: string, uid: string): Promise<Res> {
  return update(id, uid, (d, now) => {
    if (d.status === 'play') return playOn(d, uid, { kind: 'resign' }, now);
    if (d.host.uid === uid && (d.status === 'open' || d.status === 'seated')) return { ...d, status: 'cancelled' };
    if (d.guest?.uid === uid && d.status === 'seated') return { ...d, status: 'open', guest: null, seatUntil: null };
    return null;
  });
}

// ── The match ───────────────────────────────────────────────────────────────

function withGame(d: DuelDoc, g: Game): DuelDoc {
  const next = { ...d, game: JSON.stringify(g) };
  if (g.end && d.status === 'play') return { ...next, status: 'done', result: { winner: g.end.winner, reason: g.end.reason, delta: null, rating: null } };
  return next;
}

function playOn(d: DuelDoc, uid: string, a: PvpAction, now: number): DuelDoc | { error: string } {
  const side = d.sides!.indexOf(uid) as Side;
  if (side < 0) return { error: 'Nie grasz w tym meczu' };
  const r = act(JSON.parse(d.game!) as Game, side, fromView(a, side), now);
  return 'error' in r ? r : withGame(d, r.game);
}

export async function play(id: string, uid: string, a: PvpAction): Promise<Res> {
  return update(id, uid, (d, now) => (d.status === 'play' ? playOn(d, uid, a, now) : { error: 'Mecz się nie toczy' }));
}

/** A participant's page is open: keeps the lobby / their side alive, and applies whatever came due */
export async function ping(id: string, uid: string): Promise<Res> {
  return update(id, uid, (d, now) => {
    if (d.status === 'open' || d.status === 'seated') {
      if (lobbyDead(d, now)) return { ...d, status: 'expired' };
      if (seatLapsed(d, now)) return { ...d, status: 'open', guest: null, seatUntil: null, ...(d.host.uid === uid ? { hostSeen: now } : {}) };
      return d.host.uid === uid ? { ...d, hostSeen: now } : null;
    }
    if (d.status !== 'play') return null;
    const g = JSON.parse(d.game!) as Game;
    const side = d.sides!.indexOf(uid) as Side;
    const settled = settle(g, now);
    const seen: [number, number] = [...settled.clock.seen];
    if (side >= 0) seen[side] = now;
    return withGame(d, { ...settled, clock: { ...settled.clock, seen } });
  });
}

/** Matches nobody looks at any more: settle them (the 5-minute call) so they end and get rated */
export async function settleStale(now = Date.now()): Promise<number> {
  const s = await duels().where('status', '==', 'play').get();
  let n = 0;
  for (const doc of s.docs.filter(x => (x.data().updatedAt ?? 0) < now - 60_000)) {
    await update(doc.id, '', d => (d.status === 'play' ? withGame(d, settle(JSON.parse(d.game!) as Game, Date.now())) : null));
    n++;
  }
  return n;
}

// ── Rating and history ──────────────────────────────────────────────────────

const day = (t: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date(t));

async function rate(id: string) {
  const ref = duels().doc(id);
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const d = snap.data() as DuelDoc;
    if (!d || d.status !== 'done' || d.rated || !d.result || !d.sides || !d.players) return;
    const g = JSON.parse(d.game!) as Game;
    const rk = db().collection('cardRankings').doc(d.key);
    const pRefs = d.sides.map(u => rk.collection('players').doc(u));
    const [a, b] = [...d.sides].sort();
    const pairRef = rk.collection('pairs').doc(`${day(d.updatedAt)}__${a}__${b}`);
    const [p0, p1, pair] = await Promise.all([tx.get(pRefs[0]), tx.get(pRefs[1]), tx.get(pairRef)]);
    const cur = [p0, p1].map(p => ({ rating: (p.data()?.rating as number) ?? START_RATING, games: (p.data()?.games as number) ?? 0 }));
    const w = d.result.winner; const l = (1 - w) as Side;
    const n = ((pair.data()?.n as number) ?? 0) + 1;
    const [dw, dl] = eloDelta(cur[w], cur[l], n);
    const delta: [number, number] = [0, 0]; delta[w] = dw; delta[l] = dl;
    const rating: [number, number] = [cur[0].rating + delta[0], cur[1].rating + delta[1]];
    const now = Date.now();
    ([0, 1] as Side[]).forEach(sd => {
      const won = sd === w;
      tx.set(pRefs[sd], {
        uid: d.sides![sd], name: d.players![sd].name, avatar: d.players![sd].avatar, rating: rating[sd],
        games: FieldValue.increment(1), wins: FieldValue.increment(won ? 1 : 0), losses: FieldValue.increment(won ? 0 : 1), updatedAt: now,
      }, { merge: true });
      const opp = d.players![(1 - sd) as Side];
      tx.set(pRefs[sd].collection('games').doc(id), {
        opp: { uid: opp.uid, name: opp.name, avatar: opp.avatar }, won, reason: d.result!.reason,
        score: [g.s.sides[sd].score, g.s.sides[(1 - sd) as Side].score], turns: g.s.turn, delta: delta[sd], rating: rating[sd], at: now,
      });
    });
    tx.set(pairRef, { n, at: now });
    const done: DuelDoc = { ...d, rated: true, result: { ...d.result, delta, rating } };
    write(tx, id, done, now);
  });
}

export async function ranking(key: string, limit = 50) {
  const s = await db().collection('cardRankings').doc(key).collection('players').orderBy('rating', 'desc').limit(limit).get();
  return s.docs.map(x => { const p = x.data(); return { uid: x.id, name: p.name, avatar: p.avatar ?? null, rating: p.rating, games: p.games ?? 0, wins: p.wins ?? 0, losses: p.losses ?? 0 }; });
}

export async function history(key: string, uid: string, limit = 20) {
  const s = await db().collection('cardRankings').doc(key).collection('players').doc(uid).collection('games').orderBy('at', 'desc').limit(limit).get();
  return s.docs.map(x => ({ id: x.id, ...x.data() }));
}

/** For the cards front page: challenges waiting for you, your open lobbies, your matches in progress */
export async function myDuels(key: string, uid: string) {
  const now = Date.now();
  const [inv, host, play] = await Promise.all([
    duels().where('invited.uid', '==', uid).get(),
    duels().where('host.uid', '==', uid).get(),
    duels().where('sides', 'array-contains', uid).get(),
  ]);
  const mine = (s: FirebaseFirestore.QuerySnapshot) => s.docs.map(d => ({ id: d.id, d: d.data() as DuelDoc })).filter(x => x.d.key === key);
  return {
    invites: mine(inv).filter(x => x.d.status === 'open' && !lobbyDead(x.d, now)).map(x => ({ id: x.id, host: x.d.host })),
    hosting: mine(host).filter(x => (x.d.status === 'open' || x.d.status === 'seated') && !lobbyDead(x.d, now)).map(x => ({ id: x.id, status: x.d.status })),
    live: mine(play).filter(x => x.d.status === 'play').map(x => ({ id: x.id, rival: x.d.players!.find(p => p.uid !== uid)! })),
  };
}
