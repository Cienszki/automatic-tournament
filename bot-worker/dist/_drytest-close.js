"use strict";
// Tests the two things §5a of lobby-bot-integration.md asks for, without Steam:
//
//   1. A lobby nobody is in closes after five minutes, and the Dota lobby is
//      actually left — not merely written off in Firestore.
//   2. `slotSnapshot.updatedAt` moves ONLY when the slots move. The website
//      reads it as "empty since", so a name refresh or a spectator walking in
//      must not touch it, or the five-minute clock resets forever and no empty
//      lobby ever closes. That is the failure mode the website flagged as the
//      one that would silently break everything.
//
// Usage: node dist/_drytest-close.js

const dotenv = require('dotenv');
dotenv.config();
const { initFirebase } = require('./firebase.js');
const { InhouseRunner } = require('./inhouse/runner.js');
const { InhouseSessionLogic } = require('./inhouse/session-logic.js');
const { BanGuard } = require('./inhouse/ban-guard.js');
const { InhouseStore } = require('./inhouse/core/store.js');
const { DEFAULT_SETTINGS } = require('./inhouse/core/settings.js');

const GAME_ID = '_close-drytest';
const BOT_ID = 'staging-pd2ihbot5';
const MIN = 60_000;

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`);
}

function stubDota() {
  const calls = { left: 0, chat: [] };
  return {
    calls,
    isConnected: true,
    hasLobby: () => true,
    connect: async () => {},
    reattachToCachedLobby: () => '99999999999',
    leaveLobby: async () => { calls.left++; },
    sendChatMessage: async (m) => { calls.chat.push(m); },
    disconnect: async () => {},
    kickPlayer: async () => {},
    getCurrentLobbyId: () => '99999999999',
  };
}

/** Same contract as InhouseSessionLogic, minus everything the close rules don't use. */
function stubLogic(db) {
  let cur = null;
  return {
    stop: () => {},
    refresh: async () => {
      cur = (await db.collection('inhouseGames').doc(GAME_ID).get()).data();
    },
    get current() {
      return cur;
    },
  };
}

async function seed(db, patch = {}) {
  const nowIso = new Date().toISOString();
  const settings = DEFAULT_SETTINGS;
  // Sub-collections survive a doc delete, so clear them between phases.
  for (const c of ['memberships', 'reservations']) {
    const snap = await db.collection('inhouseGames').doc(GAME_ID).collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.collection('inhouseGames').doc(GAME_ID).set({
    id: GAME_ID,
    gameNumber: 9100,
    mode: 'inhouse',
    state: 'open',
    initiatorDiscordId: '',
    initiatorSteamId32: null,
    initiatorName: 'Gość',
    published: false,
    locked: false,
    settings,
    botAccountId: BOT_ID,
    dotaLobbyId: '99999999999',
    lobbyName: 'Close Drytest',
    lobbyPassword: 'pdl',
    dotaMatchId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    endedAt: null,
    endReason: null,
    lastActivityAt: nowIso,
    nudgedAt: null,
    slotSnapshot: null,
    ...patch,
  });
  await db.collection('botAccounts').doc(BOT_ID).update({
    status: 'assigned',
    leasedByGameId: GAME_ID,
    leaseHeartbeatAt: nowIso,
  });
}

async function readGame(db) {
  return (await db.collection('inhouseGames').doc(GAME_ID).get()).data();
}

/** A runner wired up to the point where checkLobbyLifetime can run. */
async function makeRunner(db, { idleMs, playersSeated }) {
  const runner = new InhouseRunner(db, GAME_ID, BOT_ID);
  runner.dota = stubDota();
  runner.sessionLogic = stubLogic(db);
  runner.lobbyCreated = true;
  runner.game = await readGame(db);
  runner.lastSlotChangeMs = Date.now() - idleMs;
  runner.playersSeated = playersSeated;
  return runner;
}

async function closeRules(db) {
  console.log('\n── Close rules (§5a) ──');

  console.log('\n1. Empty for 4 minutes — still inside the window, stays open');
  await seed(db);
  let runner = await makeRunner(db, { idleMs: 4 * MIN, playersSeated: 0 });
  await runner.checkLobbyLifetime();
  check('state', (await readGame(db)).state, 'open');
  check('lobby not left', runner.dota.calls.left, 0);

  console.log('\n2. Empty for 6 minutes — closes, and the Dota lobby is destroyed');
  runner = await makeRunner(db, { idleMs: 6 * MIN, playersSeated: 0 });
  await runner.checkLobbyLifetime();
  let game = await readGame(db);
  check('state', game.state, 'expired');
  check('endReason', game.endReason, 'Puste lobby przez 6 min');
  check('left the Dota lobby', runner.dota.calls.left, 1);
  check('warned in chat first', runner.dota.calls.chat.length, 1);
  // Cleared only because the leave succeeded — this is what stops the
  // Conductor's orphan sweep from logging in again for a lobby we closed.
  check('dotaLobbyId cleared', game.dotaLobbyId, null);
  const acct = (await db.collection('botAccounts').doc(BOT_ID).get()).data();
  check('account released', acct.status, 'idle');
  check('lease cleared', acct.leasedByGameId, null);

  console.log('\n3. Players seated, no slot movement for 20 minutes — must NOT close');
  await seed(db);
  runner = await makeRunner(db, { idleMs: 20 * MIN, playersSeated: 6 });
  await runner.checkLobbyLifetime();
  check('state', (await readGame(db)).state, 'open');
  check('lobby not left', runner.dota.calls.left, 0);

  console.log('\n4. Players seated, nothing at all for 4 hours — closes');
  runner = await makeRunner(db, { idleMs: 4 * 60 * MIN, playersSeated: 6 });
  await runner.checkLobbyLifetime();
  game = await readGame(db);
  check('state', game.state, 'expired');
  check('endReason', game.endReason, 'Brak aktywności w lobby przez 240 min');

  console.log('\n4b. A live reservation holds an empty lobby open (mirrors the website)');
  const reservation = (expiresInMs) => ({
    inLobby: [], radiant: [], dire: [], unassigned: [],
    committed: 1, slotsOpen: 9,
    reserved: [{ discordId: 'd1', steamId32: '111', playerName: 'Nocnik', expiresAt: new Date(Date.now() + expiresInMs).toISOString() }],
    updatedAt: new Date(Date.now() - 6 * MIN).toISOString(),
  });
  await seed(db, { slotSnapshot: reservation(3 * MIN) });
  runner = await makeRunner(db, { idleMs: 6 * MIN, playersSeated: 0 });
  await runner.checkLobbyLifetime();
  check('empty past the window but a slot is held', (await readGame(db)).state, 'open');
  check('lobby not left', runner.dota.calls.left, 0);

  console.log('\n4c. …but a lapsed reservation must not hold it open forever');
  await seed(db, { slotSnapshot: reservation(-1 * MIN) });
  runner = await makeRunner(db, { idleMs: 6 * MIN, playersSeated: 0 });
  await runner.checkLobbyLifetime();
  check('stale hold ignored', (await readGame(db)).state, 'expired');

  console.log('\n5. A start is counting down — an empty-looking lobby must not be closed under it');
  await seed(db);
  runner = await makeRunner(db, { idleMs: 30 * MIN, playersSeated: 0 });
  runner.countdownTimer = setTimeout(() => {}, 60_000);
  await runner.checkLobbyLifetime();
  clearTimeout(runner.countdownTimer);
  check('state', (await readGame(db)).state, 'open');

  console.log('\n6. Match in progress — never closed by the idle rules');
  await seed(db, { state: 'in_progress' });
  runner = await makeRunner(db, { idleMs: 5 * 60 * MIN, playersSeated: 10 });
  await runner.checkLobbyLifetime();
  check('state', (await readGame(db)).state, 'in_progress');
  check('lobby not left', runner.dota.calls.left, 0);

  console.log('\n7. "Empty since" survives a restart — a runner booting onto a long-dead lobby');
  const staleSnapshot = {
    inLobby: [], radiant: [], dire: [], unassigned: [],
    committed: 0, slotsOpen: 10, reserved: [],
    updatedAt: new Date(Date.now() - 26 * 60 * MIN).toISOString(),
  };
  await seed(db, { slotSnapshot: staleSnapshot });
  const booted = new InhouseRunner(db, GAME_ID, BOT_ID);
  const seenAt = Date.parse(staleSnapshot.updatedAt);
  booted.lastSlotChangeMs = seenAt; // what run() seeds from the persisted snapshot
  booted.playersSeated = staleSnapshot.inLobby.length;
  booted.dota = stubDota();
  booted.sessionLogic = stubLogic(db);
  booted.lobbyCreated = true;
  await booted.checkLobbyLifetime();
  check('closed on the first heartbeat, not five minutes later', (await readGame(db)).state, 'expired');
}

async function fingerprints(db) {
  console.log('\n── slotSnapshot.updatedAt moves only on real slot changes (§5a.2) ──');
  await seed(db, { initiatorSteamId32: '111', initiatorName: 'A' });

  const store = new InhouseStore(db);
  const changes = [];
  const logic = new InhouseSessionLogic(await readGame(db), {
    store,
    banGuard: new BanGuard(store, { kick: async () => {}, announce: async () => {} }),
    kick: async () => {},
    sendChatMessage: async () => {},
    botSteamId32: '999999',
    onSlotsChanged: (updatedAt, seated) => changes.push({ updatedAt, seated }),
  });

  const bot = { accountId: 999999, steamId32: '999999', slot: 0, team: 'unassigned', name: 'bot' };
  const p1 = { accountId: 111, steamId32: '111', slot: 0, team: 'radiant', name: 'A' };
  const p2 = { accountId: 222, steamId32: '222', slot: 1, team: 'radiant', name: 'B' };
  const obs = { accountId: 333, steamId32: '333', slot: 0, team: 'spectator', name: 'Widz' };

  console.log('\n1. First player arrives — slots moved, snapshot written');
  await logic.onLobbyUpdate([bot, p1]);
  let game = await readGame(db);
  const t1 = game.slotSnapshot.updatedAt;
  const u1 = game.updatedAt;
  check('inLobby excludes the bot', JSON.stringify(game.slotSnapshot.inLobby), '["111"]');
  check('onSlotsChanged fired', changes.length, 1);
  check('reported seated', changes[0].seated, 1);

  console.log('\n2. Identical update re-sent by the GC — nothing written at all');
  await logic.onLobbyUpdate([bot, p1]);
  game = await readGame(db);
  check('slotSnapshot.updatedAt unchanged', game.slotSnapshot.updatedAt, t1);
  check('game.updatedAt unchanged', game.updatedAt, u1);

  console.log('\n3. Persona name changes — game doc touched, clock NOT reset');
  await logic.onLobbyUpdate([bot, { ...p1, name: 'A-renamed' }]);
  game = await readGame(db);
  check('slotSnapshot.updatedAt unchanged', game.slotSnapshot.updatedAt, t1);
  check('game.updatedAt moved', game.updatedAt !== u1, true);
  check('no slot change reported', changes.length, 1);
  const u2 = game.updatedAt;

  console.log('\n4. An observer walks in — not a player, so the clock must not reset');
  await logic.onLobbyUpdate([bot, { ...p1, name: 'A-renamed' }, obs]);
  game = await readGame(db);
  check('observer kept out of inLobby', JSON.stringify(game.slotSnapshot.inLobby), '["111"]');
  check('slotSnapshot.updatedAt unchanged', game.slotSnapshot.updatedAt, t1);
  check('game.updatedAt moved', game.updatedAt !== u2, true);
  check('no slot change reported', changes.length, 1);

  console.log('\n5. A real player joins — now the clock moves');
  await logic.onLobbyUpdate([bot, { ...p1, name: 'A-renamed' }, obs, p2]);
  game = await readGame(db);
  check('slotSnapshot.updatedAt moved', game.slotSnapshot.updatedAt !== t1, true);
  check('onSlotsChanged fired', changes.length, 2);
  check('reported seated', changes[1].seated, 2);

  console.log('\n6. Everyone leaves — the empty snapshot lands, which is what starts the clock');
  await logic.onLobbyUpdate([bot, obs]);
  game = await readGame(db);
  check('inLobby empty', JSON.stringify(game.slotSnapshot.inLobby), '[]');
  check('onSlotsChanged fired', changes.length, 3);
  check('reported seated', changes[2].seated, 0);
}

/**
 * The lobby the website could only write off: game already terminal, Dota lobby
 * still live. The Conductor forks a runner purely to destroy it.
 */
async function orphanCleanup(db) {
  console.log('\n── Orphaned lobby left by a game that ended while we were down ──');
  await seed(db, { state: 'expired', endReason: 'worker went silent', endedAt: new Date().toISOString() });

  const runner = new InhouseRunner(db, GAME_ID, BOT_ID);
  runner.game = await readGame(db);
  runner.dota = stubDota();
  const code = await runner.closeOrphanedLobby();

  const game = await readGame(db);
  const acct = (await db.collection('botAccounts').doc(BOT_ID).get()).data();
  check('exit code', code, 0);
  check('Dota lobby destroyed', runner.dota.calls.left, 1);
  check('dotaLobbyId cleared so it is never retried', game.dotaLobbyId, null);
  check('terminal state untouched', game.state, 'expired');
  check('account back in the pool', acct.status, 'idle');
  check('lease cleared', acct.leasedByGameId, null);

  console.log('\n2. GC has no such lobby any more — cleanly a no-op, still tidies up');
  await seed(db, { state: 'cancelled', endedAt: new Date().toISOString() });
  const gone = new InhouseRunner(db, GAME_ID, BOT_ID);
  gone.game = await readGame(db);
  gone.dota = { ...stubDota(), hasLobby: () => false };
  gone.dota.calls = { left: 0, chat: [] };
  gone.dota.leaveLobby = async () => { gone.dota.calls.left++; };
  check('exit code', await gone.closeOrphanedLobby(), 0);
  check('nothing left', gone.dota.calls.left, 0);
  check('dotaLobbyId cleared', (await readGame(db)).dotaLobbyId, null);
}

async function main() {
  const db = initFirebase();
  await closeRules(db);
  await fingerprints(db);
  await orphanCleanup(db);

  const subs = await db.collection('inhouseGames').doc(GAME_ID).collection('memberships').get();
  await Promise.all(subs.docs.map((d) => d.ref.delete()));
  await db.collection('inhouseGames').doc(GAME_ID).delete();
  await db.collection('botAccounts').doc(BOT_ID).update({
    status: 'idle',
    leasedByGameId: null,
    leaseHeartbeatAt: null,
  });

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('fatal', e); process.exit(1); });
