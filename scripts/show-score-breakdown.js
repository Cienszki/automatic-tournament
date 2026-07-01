#!/usr/bin/env node
// Pulls a real player from the wiosenna tournament and shows the per-component score breakdown.

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

function initAdmin() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 not set');
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  if (getApps().length === 0) initializeApp({ credential: cert(sa) });
  return getFirestore(getApps()[0]);
}

// Exact formula from performance-rankings-calculator.ts
function calcScore(role, p, gameMins, avgGameMins) {
  if (gameMins <= 0) return { total: 0 };
  const n = (v) => v * avgGameMins / gameMins;

  let killPts = 0, assistPts = 0, deathPts = 0, farmPts = 0, dmgPts = 0, wardPts = 0;

  switch (role) {
    case 'Carry':
      killPts   = n(p.kills)   * 0.29;
      assistPts = n(p.assists) * 0.13;
      deathPts  = n(p.deaths)  * -0.38;
      farmPts   = Math.max(p.gpm - 300, 0) / 150 + n(p.lastHits) / 150;
      dmgPts    = n(p.heroDamage) / 14000 + n(p.towerDamage) / 14000;
      break;
    case 'Mid':
      killPts   = n(p.kills)   * 0.38;
      assistPts = n(p.assists) * 0.12;
      deathPts  = n(p.deaths)  * -0.34;
      farmPts   = Math.max(p.xpm - 300, 0) / 144 + n(p.lastHits) / 220;
      dmgPts    = n(p.heroDamage) / 12000 + n(p.towerDamage) / 12000;
      break;
    case 'Offlane':
      killPts   = n(p.kills)   * 0.43;
      assistPts = n(p.assists) * 0.23;
      deathPts  = n(p.deaths)  * -0.30;
      farmPts   = Math.max(p.gpm - 250, 0) / 175;
      dmgPts    = n(p.heroDamage) / 9000 + n(p.towerDamage) / 9000;
      wardPts   = n(p.obsPlaced) * 0.20 + n(p.senPlaced) * 0.20;
      break;
    case 'Soft Support':
      killPts   = n(p.kills)   * 0.35;
      assistPts = n(p.assists) * 0.20;
      deathPts  = n(p.deaths)  * -0.25;
      farmPts   = Math.max(p.gpm - 200, 0) / 130;
      dmgPts    = n(p.heroDamage) / 13000 + n(p.towerDamage) / 13000;
      wardPts   = n(p.obsPlaced) * 0.22 + n(p.senPlaced) * 0.15;
      break;
    case 'Hard Support':
      killPts   = n(p.kills)   * 0.23;
      assistPts = n(p.assists) * 0.20;
      deathPts  = n(p.deaths)  * -0.21;
      farmPts   = Math.max(p.gpm - 200, 0) / 200;
      dmgPts    = n(p.heroDamage) / 11500 + n(p.towerDamage) / 11500;
      wardPts   = n(p.obsPlaced) * 0.18 + n(p.senPlaced) * 0.12;
      break;
    default:
      return { total: 0 };
  }

  const dewardPts = n(p.observerKills) * 0.25 + n(p.sentryKills) * 0.10;
  const campPts   = n(p.campsStacked) * 0.20;
  const miscPts   = (p.firstBloodClaimed ? 0.75 : 0)
                  + (role === 'Mid' ? n(p.runesPickedUp) * 0.07 : 0);

  const total = killPts + assistPts + deathPts + farmPts + dmgPts + wardPts + dewardPts + campPts + miscPts;
  return { total, killPts, assistPts, deathPts, farmPts, dmgPts, wardPts, dewardPts, campPts, miscPts };
}

async function main() {
  const db = initAdmin();

  // 1. Find the wiosenna tournament
  const tourSnap = await db.collection('tournaments').get();
  let tourId = null, tourName = null;
  for (const doc of tourSnap.docs) {
    const name = (doc.data().name || doc.data().slug || doc.id).toLowerCase();
    if (name.includes('wiosenna') || name.includes('spring') || name.includes('wiosna')) {
      tourId = doc.id;
      tourName = doc.data().name || doc.id;
      break;
    }
  }

  if (!tourId) {
    console.log('Could not find wiosenna tournament. Available tournaments:');
    tourSnap.docs.forEach(d => console.log(' -', d.id, '|', d.data().name || ''));
    process.exit(1);
  }
  console.log(`\nTournament: ${tourName} (${tourId})\n`);

  // 2. Read the pre-computed rankings to pick the #1 player
  const rankingsBase = `tournaments/${tourId}/performanceRankings`;
  const rolesOrder = ['carry', 'mid', 'offlane', 'soft-support', 'hard-support'];
  let targetPlayer = null, targetRole = null;

  for (const role of rolesOrder) {
    const snap = await db.doc(`${rankingsBase}/${role}`).get();
    if (snap.exists && snap.data().entries?.length > 0) {
      targetPlayer = snap.data().entries[0];
      targetRole = role;
      break;
    }
  }

  if (!targetPlayer) {
    console.log('No rankings data found yet. Has recalculatePerformanceRankings been run?');
    process.exit(1);
  }

  const roleLabel = { carry: 'Carry', mid: 'Mid', offlane: 'Offlane', 'soft-support': 'Soft Support', 'hard-support': 'Hard Support' }[targetRole];
  console.log(`Player: ${targetPlayer.name} (${targetPlayer.teamName}) — ${roleLabel}`);
  console.log(`Stored avgScore: ${targetPlayer.avgScore.toFixed(4)}, games: ${targetPlayer.games}\n`);

  // 3. Find all performances for this player across completed matches
  const matchesSnap = await db
    .collection(`tournaments/${tourId}/matches`)
    .where('status', '==', 'completed')
    .get();

  const allPerfs = [];
  for (const matchDoc of matchesSnap.docs) {
    if (matchDoc.data().isBanForfeit) continue;
    const gamesSnap = await db.collection(`tournaments/${tourId}/matches/${matchDoc.id}/games`).get();
    for (const gameDoc of gamesSnap.docs) {
      const gameDurationSec = gameDoc.data().duration || 0;
      const gameMins = gameDurationSec / 60;
      if (gameMins < 5) continue;

      const perfSnap = await db
        .collection(`tournaments/${tourId}/matches/${matchDoc.id}/games/${gameDoc.id}/performances`)
        .get();

      for (const perfDoc of perfSnap.docs) {
        const pd = perfDoc.data();
        const nick = pd.nickname || pd.playerNickname || '';
        if (nick.toLowerCase() === targetPlayer.name.toLowerCase()) {
          allPerfs.push({ gameMins, matchId: matchDoc.id, gameId: gameDoc.id, pd });
        }
      }
    }
  }

  if (allPerfs.length === 0) {
    console.log('Could not find individual performances for this player. The nickname lookup may differ.');
    process.exit(1);
  }

  // 4. Compute avgGameMins (same as the calculator)
  const avgGameMins = allPerfs.reduce((s, e) => s + e.gameMins, 0) / allPerfs.length;
  console.log(`Found ${allPerfs.length} game(s). Avg game duration: ${avgGameMins.toFixed(1)} min\n`);

  // 5. Print per-game breakdown + averaged totals
  const accumulated = { killPts: 0, assistPts: 0, deathPts: 0, farmPts: 0, dmgPts: 0, wardPts: 0, dewardPts: 0, campPts: 0, miscPts: 0, total: 0 };

  allPerfs.forEach((e, i) => {
    const pd = e.pd;
    const p = {
      kills:             pd.kills             || 0,
      deaths:            pd.deaths            || 0,
      assists:           pd.assists           || 0,
      gpm:               pd.gpm               || 0,
      xpm:               pd.xpm               || 0,
      lastHits:          pd.lastHits          || 0,
      heroDamage:        pd.heroDamage        || 0,
      towerDamage:       pd.towerDamage       || 0,
      obsPlaced:         pd.obsPlaced         || 0,
      senPlaced:         pd.senPlaced         || 0,
      observerKills:     pd.observerKills     || 0,
      sentryKills:       pd.sentryKills       || 0,
      campsStacked:      pd.campsStacked      || 0,
      firstBloodClaimed: pd.firstBloodClaimed || false,
      runesPickedUp:     pd.runesPickedUp     || 0,
    };
    const b = calcScore(roleLabel, p, e.gameMins, avgGameMins);

    console.log(`--- Game ${i + 1} (${e.matchId} / ${e.gameId}) — ${e.gameMins.toFixed(1)} min ---`);
    console.log(`  Raw stats: ${p.kills}/${p.deaths}/${p.assists}, GPM ${p.gpm}, XPM ${p.xpm}, LH ${p.lastHits}`);
    console.log(`  Hero dmg: ${p.heroDamage}, Tower dmg: ${p.towerDamage}, Obs: ${p.obsPlaced}, Sen: ${p.senPlaced}`);
    console.log(`  Score breakdown:`);
    console.log(`    Kills     : ${b.killPts.toFixed(3)}`);
    console.log(`    Assists   : ${b.assistPts.toFixed(3)}`);
    console.log(`    Deaths    : ${b.deathPts.toFixed(3)}`);
    console.log(`    Farm      : ${b.farmPts.toFixed(3)}`);
    console.log(`    Damage    : ${b.dmgPts.toFixed(3)}`);
    console.log(`    Wards     : ${b.wardPts.toFixed(3)}`);
    console.log(`    Dewarding : ${b.dewardPts.toFixed(3)}`);
    console.log(`    Camps     : ${b.campPts.toFixed(3)}`);
    console.log(`    Misc      : ${b.miscPts.toFixed(3)}`);
    console.log(`    TOTAL     : ${b.total.toFixed(3)}`);
    console.log('');

    for (const k of Object.keys(accumulated)) accumulated[k] += b[k] || 0;
  });

  const g = allPerfs.length;
  console.log('=== AVERAGED ACROSS ALL GAMES ===');
  console.log(`  Kills     : ${(accumulated.killPts   / g).toFixed(3)}`);
  console.log(`  Assists   : ${(accumulated.assistPts  / g).toFixed(3)}`);
  console.log(`  Deaths    : ${(accumulated.deathPts   / g).toFixed(3)}`);
  console.log(`  Farm      : ${(accumulated.farmPts    / g).toFixed(3)}`);
  console.log(`  Damage    : ${(accumulated.dmgPts     / g).toFixed(3)}`);
  console.log(`  Wards     : ${(accumulated.wardPts    / g).toFixed(3)}`);
  console.log(`  Dewarding : ${(accumulated.dewardPts  / g).toFixed(3)}`);
  console.log(`  Camps     : ${(accumulated.campPts    / g).toFixed(3)}`);
  console.log(`  Misc      : ${(accumulated.miscPts    / g).toFixed(3)}`);
  console.log(`  avgScore  : ${(accumulated.total / g).toFixed(4)}  (stored: ${targetPlayer.avgScore.toFixed(4)})`);
}

main().catch(err => { console.error(err); process.exit(1); });
