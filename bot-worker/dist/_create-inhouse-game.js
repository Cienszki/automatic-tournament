"use strict";
// Manual M1 dry-run driver for the Inhouse Runner — mirrors _create-session.js
// / _drytest.js's style and conventions (plain JS, require the compiled
// dist/ output directly, phase-based argv CLI).
//
// Creates one inhouseGames document by hand (in lobby_creating, with a
// create_inhouse_lobby command already queued) exactly the way the website's
// createInhouseGame() server action does it — so this exercises the real
// InhouseRunner code path, not a special test-only shortcut.
//
// Usage:
//   node dist/_create-inhouse-game.js create   — write the game doc + queue the command
//   node dist/_create-inhouse-game.js status   — print the game doc + slotSnapshot + memberships
//   node dist/_create-inhouse-game.js clear    — delete this test game's queued commands
//
// Then, in another terminal:
//   node dist/inhouse-runner.js --game-id=<printed id> --bot-id=<STAGING_BOT_ID>

const dotenv = require('dotenv');
dotenv.config();
const { initFirebase } = require('./firebase.js');
const { resolveSettings } = require('./inhouse/core/settings.js');
const { InhouseStore } = require('./inhouse/core/store.js');

// ─── Fill these in before running ───────────────────────────────────────────
// A staging account per the plan's verification steps: enabled:false in
// Firestore, so it's never picked up by the real website's leaseAccount() or
// the (not-yet-wired, M3) Conductor pool. Passed explicitly to the runner via
// --bot-id instead.
const STAGING_BOT_ID = 'staging-pd2ihbot5';
// A fixed id makes re-running 'status' after 'create' trivial.
const GAME_ID = 'm1-drytest';

async function main() {
  const db = initFirebase();
  const phase = process.argv[2] || 'status';
  const gameRef = db.collection('inhouseGames').doc(GAME_ID);

  if (phase === 'create') {
    if (STAGING_BOT_ID === 'CHANGE_ME') {
      console.error('Set STAGING_BOT_ID at the top of this file first.');
      process.exit(1);
    }

    const existing = await gameRef.get();
    if (existing.exists && !['finished', 'cancelled', 'expired', 'abandoned', 'failed'].includes(existing.data().state)) {
      console.log(`Game ${GAME_ID} already exists in state ${existing.data().state} — not recreating.`);
      process.exit(0);
    }

    // Mirror the website's createInhouseGame() exactly (see
    // dota2-community-site/src/app/inhouse/new/actions.ts): settings are the
    // ADMIN DEFAULTS from inhouseConfig/global resolved over the inhouse
    // baseline, and the password is the one shared value from
    // inhouseConfig/lobby. Resolving with no defaults layer (as this script
    // first did) silently produced leagueId:0 plus the wrong mode/region/
    // password — a fixture that tested something the product never does.
    const store = new InhouseStore(db);
    const defaults = await store.getAdminDefaults();
    const settings = resolveSettings(defaults, { mode: 'inhouse' });

    // `create bots` — a launchable-solo variant for testing the match-end path
    // (in_progress → dotaMatchId → webhook) without gathering ten humans. Same
    // trick the tournament team's own _drytest.js uses.
    //
    // leagueId is deliberately DROPPED here: a one-human-nine-bot game would
    // otherwise land in the real league's match history, which the website's
    // /api/cron/inhouse-backfill walks and ingests. All Pick because Captains
    // Draft needs captains; Manual selection priority so a single launch starts
    // the game with no coin toss to complete.
    if (process.argv[3] === 'bots') {
      settings.fillWithBots = true;
      settings.leagueId = 0;
      settings.gameMode = 1;
      settings.selectionPriorityRules = 0;
      console.log('BOT-GAME VARIANT: fillWithBots=true, leagueId dropped, All Pick, manual priority.');
    }

    const lobbyCfgSnap = await db.collection('inhouseConfig').doc('lobby').get();
    const lobbyPassword = (lobbyCfgSnap.exists && lobbyCfgSnap.data().password) || null;

    const nowIso = new Date().toISOString();
    console.log('Using admin defaults: leagueId=' + settings.leagueId +
      ' gameMode=' + settings.gameMode + ' region=' + settings.serverRegion +
      ' password=' + (lobbyPassword ?? '(none)'));

    // Anonymous host, matching the website's real shipped createInhouseGame()
    // behavior — exercises the host-handover path the same way a real
    // "Otwórz lobby" click from a logged-out visitor would.
    const game = {
      id: GAME_ID,
      gameNumber: 9001,
      mode: 'inhouse',
      state: 'lobby_creating',
      initiatorDiscordId: '',
      initiatorSteamId32: null,
      initiatorName: 'Gość',
      published: true,
      publishedAt: nowIso,
      publishedByDiscordId: null,
      locked: false,
      settings,
      botAccountId: STAGING_BOT_ID,
      dotaLobbyId: null,
      // Named/passworded up front, exactly as the website does before it
      // enqueues the command — the worker must honour these, not invent its own.
      lobbyName: 'M1 Drytest',
      lobbyPassword,
      dotaMatchId: null,
      newcomerFriendly: false,
      scheduledFor: null,
      discord: {
        hostPanelChannelId: null, hostPanelMessageId: null,
        cardChannelId: null, cardMessageId: null,
        voiceChannelId: null, scheduledEventId: null,
      },
      createdAt: nowIso, updatedAt: nowIso,
      endedAt: null, endReason: null,
      lastActivityAt: nowIso, nudgedAt: null,
    };
    await gameRef.set(game);

    await db.collection('botCommands').doc(STAGING_BOT_ID).collection('queue').add({
      botAccountId: STAGING_BOT_ID,
      command: {
        type: 'create_inhouse_lobby',
        gameId: GAME_ID,
        lobby: {
          name: 'M1 Drytest', password: lobbyPassword,
          gameMode: settings.gameMode, serverRegion: settings.serverRegion,
          dotaTvDelay: settings.dotaTvDelay, leagueId: settings.leagueId,
          selectionPriorityRules: settings.selectionPriorityRules,
          published: true, cheatsEnabled: settings.cheatsEnabled,
          fillWithBots: settings.fillWithBots,
          allowSpectators: settings.allowSpectators,
          pauseSetting: settings.pauseSetting,
        },
      },
      status: 'pending',
      createdAt: nowIso,
    });

    console.log(`Created ${GAME_ID}, queued create_inhouse_lobby for bot ${STAGING_BOT_ID}.`);
    console.log(`Now run: node dist/inhouse-runner.js --game-id=${GAME_ID} --bot-id=${STAGING_BOT_ID}`);
  } else if (phase === 'clear') {
    const q = await db.collection('botCommands').doc(STAGING_BOT_ID).collection('queue').get();
    for (const d of q.docs) await d.ref.delete();
    console.log(`Cleared ${q.size} queued command(s) for ${STAGING_BOT_ID}.`);
    process.exit(0);
  }

  // Always show the current game doc + roster, so `status` (the default) and
  // a bare re-run after `create` both give you something useful.
  const snap = await gameRef.get();
  if (!snap.exists) {
    console.log(`No game ${GAME_ID} yet — run with 'create' first.`);
    process.exit(0);
  }
  const g = snap.data();
  console.log(`\n--- ${GAME_ID} ---`);
  console.log(`state=${g.state} host=${g.initiatorName} (${g.initiatorSteamId32 || 'none'}) locked=${g.locked}`);
  console.log(`lobby="${g.lobbyName}" pass="${g.lobbyPassword}" dotaLobbyId=${g.dotaLobbyId} dotaMatchId=${g.dotaMatchId}`);
  if (g.slotSnapshot) {
    const s = g.slotSnapshot;
    console.log(`slots: ${s.committed}/10 (open=${s.slotsOpen}) inLobby=[${s.inLobby.join(',')}] reserved=${s.reserved.length}`);
  } else {
    console.log('slots: no slotSnapshot yet');
  }

  const members = await gameRef.collection('memberships').get();
  console.log(`\n--- memberships (${members.size}) ---`);
  members.docs.forEach((d) => {
    const m = d.data();
    console.log(`  ${m.steamId32} side=${m.side} present=${m.leftAt === null} name=${m.displayName || m.playerName || '?'}`);
  });

  process.exit(0);
}
main().catch((e) => { console.error('drytest error:', e.message); process.exit(1); });
