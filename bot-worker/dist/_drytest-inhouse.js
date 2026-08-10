"use strict";
// Companion to _create-inhouse-game.js — ongoing interaction with a live M1
// test lobby, mirroring _drytest.js's phase-based CLI style.
//
// Usage (while dist/inhouse-runner.js is running against the game from
// _create-inhouse-game.js create):
//   node dist/_drytest-inhouse.js invite <steamId32>   — queue invite_player
//   node dist/_drytest-inhouse.js kick <steamId32>     — queue kick_player
//   node dist/_drytest-inhouse.js chat <message...>    — queue send_chat
//   node dist/_drytest-inhouse.js end [reason]         — queue end_inhouse_session
//   node dist/_drytest-inhouse.js ban <steamId32>      — write a test ban (verification step 5)
//   node dist/_drytest-inhouse.js unban <steamId32>    — remove it again

const dotenv = require('dotenv');
dotenv.config();
const { initFirebase } = require('./firebase.js');

const STAGING_BOT_ID = 'staging-pd2ihbot5'; // same value as in _create-inhouse-game.js
const GAME_ID = 'm1-drytest';

async function queue(db, command) {
  await db.collection('botCommands').doc(STAGING_BOT_ID).collection('queue').add({
    botAccountId: STAGING_BOT_ID,
    command: { gameId: GAME_ID, ...command },
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

async function main() {
  if (STAGING_BOT_ID === 'CHANGE_ME') {
    console.error('Set STAGING_BOT_ID at the top of this file first (same value as _create-inhouse-game.js).');
    process.exit(1);
  }

  const db = initFirebase();
  const phase = process.argv[2];
  const arg = process.argv[3];

  if (phase === 'invite') {
    await queue(db, { type: 'invite_player', steamId32: arg });
    console.log(`Queued invite_player(${arg}).`);
  } else if (phase === 'kick') {
    await queue(db, { type: 'kick_player', steamId32: arg });
    console.log(`Queued kick_player(${arg}).`);
  } else if (phase === 'chat') {
    const message = process.argv.slice(3).join(' ');
    await queue(db, { type: 'send_chat', message });
    console.log(`Queued send_chat("${message}").`);
  } else if (phase === 'end') {
    await queue(db, { type: 'end_inhouse_session', reason: arg || 'manual dry-run stop' });
    console.log('Queued end_inhouse_session.');
  } else if (phase === 'ban') {
    // Matches createModerationRecord's enforcement-index shape
    // (inhouseBans/s_{steamId32}) — the ONLY thing BanGuard actually checks.
    await db.collection('inhouseBans').doc(`s_${arg}`).set({
      moderationId: 'm1-drytest-ban',
      expiresAt: null,
      createdAt: new Date().toISOString(),
    });
    console.log(`Wrote inhouseBans/s_${arg} — that account should be kicked on next join.`);
  } else if (phase === 'unban') {
    await db.collection('inhouseBans').doc(`s_${arg}`).delete();
    console.log(`Removed inhouseBans/s_${arg}. BanGuard caches for 60s, so this may take up to a minute to take effect in the live lobby.`);
  } else {
    console.log('Usage: node dist/_drytest-inhouse.js <invite|kick|chat|end|ban|unban> <arg...>');
    process.exit(1);
  }

  process.exit(0);
}
main().catch((e) => { console.error('drytest-inhouse error:', e.message); process.exit(1); });
