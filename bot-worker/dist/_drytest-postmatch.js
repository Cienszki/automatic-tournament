"use strict";
// Verifies the Conductor does NOT spawn a runner for a game whose match is over.
//
// The website's ingest cron treats `in_progress` as a played state and only
// moves the game to `finished` once OpenDota serves the match — minutes later.
// In that window the game is non-terminal AND account-holding, so without the
// dotaMatchId guard the Conductor would start a fresh runner, find no lobby in
// the GC cache, and open a brand new lobby for a game that already finished.
//
// SAFETY: spawnInhouseRunnersTick spawns for EVERY eligible game it finds, not
// just this test's. Run naively against the live database it forks real runners
// for real lobbies on production accounts, and a second Steam login on an
// account Railway is already using triggers LogonSessionReplaced — crash-looping
// both. (Learned the hard way: an earlier version of this file did exactly
// that.) isolate() below pre-marks every other eligible game as already
// running, so the tick can only ever act on ours.
//
// Usage: node dist/_drytest-postmatch.js

const dotenv = require('dotenv');
dotenv.config();
const { initFirebase } = require('./firebase.js');
const { spawnInhouseRunnersTick } = require('./inhouse/conductor-hook.js');

const AWAITING = '_postmatch-awaiting-ingest';
const BOT_ID = 'staging-pd2ihbot5';

const { ACCOUNT_HOLDING_STATES } = require('./inhouse/core/types.js');

/**
 * Build a runners map that already "owns" every eligible game except ours, so
 * the tick's own per-game and per-account guards make it a no-op for them.
 * A fake child with exitCode === null is exactly what those guards look for.
 */
async function isolate(db, keepGameId) {
  const runners = new Map();
  const snap = await db
    .collection('inhouseGames')
    .where('state', 'in', ACCOUNT_HOLDING_STATES)
    .get();
  let shielded = 0;
  for (const doc of snap.docs) {
    const g = doc.data();
    if (doc.id === keepGameId || !g.botAccountId) continue;
    runners.set(doc.id, {
      child: { exitCode: null, kill() {} },
      botAccountId: g.botAccountId,
      restartCount: 0,
      lastStart: Date.now(),
      stopping: false,
      notBefore: 0,
    });
    shielded++;
  }
  if (shielded) console.log(`  (shielded ${shielded} real game(s) from this test)`);
  return runners;
}

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`);
}

async function main() {
  const db = initFirebase();
  const nowIso = new Date().toISOString();

  // Exactly the shape a game has after a real match, before the site ingests it.
  await db.collection('inhouseGames').doc(AWAITING).set({
    id: AWAITING,
    state: 'in_progress',
    botAccountId: BOT_ID,
    dotaLobbyId: '99999999999',
    dotaMatchId: 8123456789,
    lobbyName: 'Post Match',
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  console.log('\nGame is in_progress with a dotaMatchId (match over, awaiting website ingest)');
  const runners = await isolate(db, AWAITING);
  await spawnInhouseRunnersTick(db, runners, () => false);
  check('no runner spawned for it', runners.has(AWAITING), false);

  console.log('\nSame game with the match id removed (a genuinely live lobby) must still spawn');
  await db.collection('inhouseGames').doc(AWAITING).update({ dotaMatchId: null });
  const runners2 = await isolate(db, AWAITING);
  // Stop before any Steam login: assert the decision, then kill the child at once.
  await spawnInhouseRunnersTick(db, runners2, () => false);
  const spawned = runners2.has(AWAITING);
  for (const s of runners2.values()) {
    s.stopping = true;
    if (s.child && s.child.exitCode === null) s.child.kill('SIGKILL');
  }
  check('runner spawned when no match id', spawned, true);

  await db.collection('inhouseGames').doc(AWAITING).delete();
  await new Promise((r) => setTimeout(r, 1500));
  await db.collection('botAccounts').doc(BOT_ID).update({ status: 'idle', leasedByGameId: null });

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('fatal', e); process.exit(1); });
