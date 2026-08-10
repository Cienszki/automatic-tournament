"use strict";
// Tests the zombie-runner fix without needing Steam or a Dota client.
//
// Reproduces what happened in production: a runner whose lobby is gone but
// which never received 'lobbyCleared', so it sat renewing its lease while the
// website showed the game as open forever. The GC client is stubbed because the
// whole point is the case where the GC tells us nothing by event — only its
// shared-object cache (hasLobby) still reflects the truth.
//
// Usage: node dist/_drytest-reconcile.js

const dotenv = require('dotenv');
dotenv.config();
const { initFirebase } = require('./firebase.js');
const { InhouseRunner } = require('./inhouse/runner.js');

const GAME_ID = '_reconcile-drytest';
const BOT_ID = 'staging-pd2ihbot5';

function stubDota({ connected, lobby }) {
  return {
    isConnected: connected,
    hasLobby: () => lobby,
    leaveLobby: async () => {},
    disconnect: async () => {},
    getCurrentLobbyId: () => '123',
  };
}

async function seed(db) {
  const nowIso = new Date().toISOString();
  await db.collection('inhouseGames').doc(GAME_ID).set({
    id: GAME_ID,
    state: 'open',
    botAccountId: BOT_ID,
    dotaLobbyId: '99999999999',
    lobbyName: 'Reconcile Drytest',
    lobbyPassword: 'pdl',
    createdAt: nowIso,
    updatedAt: nowIso,
    published: false,
    locked: false,
  });
  await db.collection('botAccounts').doc(BOT_ID).update({
    status: 'assigned',
    leasedByGameId: GAME_ID,
    leaseHeartbeatAt: nowIso,
  });
}

async function readState(db) {
  const g = (await db.collection('inhouseGames').doc(GAME_ID).get()).data();
  const a = (await db.collection('botAccounts').doc(BOT_ID).get()).data();
  return { state: g.state, endReason: g.endReason, acct: a.status, leased: a.leasedByGameId ?? null };
}

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`);
}

async function main() {
  const db = initFirebase();
  await seed(db);

  const runner = new InhouseRunner(db, GAME_ID, BOT_ID);
  runner.lobbyCreated = true;

  console.log('\n1. GC session is DOWN and reports no lobby — must not count as a miss');
  runner.dota = stubDota({ connected: false, lobby: false });
  runner.reconcileLobby();
  runner.reconcileLobby();
  runner.reconcileLobby();
  check('misses stay at 0 while the GC is unreachable', runner.lobbyMisses, 0);
  check('game untouched', (await readState(db)).state, 'open');

  console.log('\n2. GC is up and HAS the lobby — healthy, misses reset');
  runner.dota = stubDota({ connected: true, lobby: true });
  runner.reconcileLobby();
  check('misses reset', runner.lobbyMisses, 0);

  console.log('\n3. One miss only — a single blip must NOT tear down a live lobby');
  runner.dota = stubDota({ connected: true, lobby: false });
  runner.reconcileLobby();
  check('miss counted', runner.lobbyMisses, 1);
  check('game still open after one miss', (await readState(db)).state, 'open');

  console.log('\n4. Recovery after a blip — lobby comes back, counter clears');
  runner.dota = stubDota({ connected: true, lobby: true });
  runner.reconcileLobby();
  check('misses cleared by recovery', runner.lobbyMisses, 0);
  check('game still open', (await readState(db)).state, 'open');

  console.log('\n5. THE PRODUCTION BUG: lobby gone, no lobbyCleared event ever arrives');
  runner.dota = stubDota({ connected: true, lobby: false });
  runner.reconcileLobby(); // miss 1
  runner.reconcileLobby(); // miss 2 -> teardown
  await new Promise((r) => setTimeout(r, 4000));
  const after = await readState(db);
  check('game is terminal', after.state, 'cancelled');
  check('endReason recorded', after.endReason, 'Lobby zostało zamknięte przed startem meczu');
  check('account released', after.acct, 'idle');
  check('lease cleared', after.leased, null);

  console.log('\n6. Idempotence — further reconciles after finishing must do nothing');
  runner.reconcileLobby();
  check('still cancelled', (await readState(db)).state, 'cancelled');

  await db.collection('inhouseGames').doc(GAME_ID).delete();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('fatal', e); process.exit(1); });
