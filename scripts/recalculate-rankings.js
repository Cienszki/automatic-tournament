// Recalculate performance rankings for a tournament
// Usage: node scripts/recalculate-rankings.js t2LLkrQbj0pwKm9i4nUs

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!saBase64) { console.error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64'); process.exit(1); }

const tournamentId = process.argv[2];
if (!tournamentId) { console.error('Usage: node scripts/recalculate-rankings.js <tournamentId>'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Scoring formula (exact mirror of performance-rankings-calculator.ts v2) ──
const VALID_ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
const ROLE_DOC_ID = {
  'Carry': 'carry', 'Mid': 'mid', 'Offlane': 'offlane',
  'Soft Support': 'soft-support', 'Hard Support': 'hard-support',
};

function calcScore(role, p, gameMins, avgGameMins) {
  if (gameMins <= 0) return 0;
  // Normalise per-count stats to average game length to remove duration bias
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
      return 0;
  }

  const dewardPts = n(p.observerKills) * 0.25 + n(p.sentryKills) * 0.10;
  const campPts   = n(p.campsStacked) * 0.20;
  const miscPts   = (p.firstBloodClaimed ? 0.75 : 0)
                  + (role === 'Mid' ? n(p.runesPickedUp) * 0.07 : 0);

  return killPts + assistPts + deathPts + farmPts + dmgPts + wardPts + dewardPts + campPts + miscPts;
}

async function run() {
  console.log(`Recalculating rankings for tournament: ${tournamentId}`);

  // 1. Build player map
  const playerMap = {};
  const teamNameMap = {};

  const teamsSnap = await db.collection('tournaments').doc(tournamentId).collection('teams').get();
  for (const teamDoc of teamsSnap.docs) {
    const td = teamDoc.data();
    teamNameMap[teamDoc.id] = td.name || teamDoc.id;
    const roster = td.roster || {};

    const playersSnap = await db.collection('tournaments').doc(tournamentId)
      .collection('teams').doc(teamDoc.id).collection('players').get();

    if (!playersSnap.empty) {
      for (const pd of playersSnap.docs) {
        const pData = pd.data();
        // Fall back to roster map for nickname if the subcollection entry lacks it
        const rosterNickname = roster[pd.id]?.nickname || roster[pData.steamId]?.nickname;
        playerMap[pd.id] = {
          nickname: pData.nickname || rosterNickname || pd.id,
          role:     pData.role || '',
          teamId:   teamDoc.id,
        };
        if (pData.steamId && pData.steamId !== pd.id) {
          playerMap[pData.steamId] = playerMap[pd.id];
        }
      }
    } else if (typeof roster === 'object') {
      for (const [steamId64, info] of Object.entries(roster)) {
        playerMap[steamId64] = { nickname: info.nickname, role: info.role, teamId: teamDoc.id };
      }
    }
  }

  console.log(`Loaded ${Object.keys(playerMap).length} players from ${teamsSnap.size} teams`);

  // 2. Walk completed matches → games → performances
  const rawEntries = [];
  const matchesSnap = await db.collection('tournaments').doc(tournamentId)
    .collection('matches').where('status', '==', 'completed').get();

  console.log(`Found ${matchesSnap.size} completed matches`);

  for (const matchDoc of matchesSnap.docs) {
    const gamesSnap = await db.collection('tournaments').doc(tournamentId)
      .collection('matches').doc(matchDoc.id).collection('games').get();

    for (const gameDoc of gamesSnap.docs) {
      const gd = gameDoc.data();
      const gameMins = (gd.duration || 0) / 60;
      if (gameMins < 5) continue;

      const perfSnap = await db.collection('tournaments').doc(tournamentId)
        .collection('matches').doc(matchDoc.id)
        .collection('games').doc(gameDoc.id).collection('performances').get();

      for (const perfDoc of perfSnap.docs) {
        const pd = perfDoc.data();
        const lookupId = pd.steamId || perfDoc.id;
        const pInfo = playerMap[lookupId] || playerMap[perfDoc.id];
        if (!pInfo || !VALID_ROLES.includes(pInfo.role)) continue;

        rawEntries.push({
          gameMins, role: pInfo.role, nickname: pInfo.nickname, teamId: pInfo.teamId,
          perf: {
            kills: pd.kills||0, deaths: pd.deaths||0, assists: pd.assists||0,
            gpm: pd.gpm||0, xpm: pd.xpm||0, lastHits: pd.lastHits||0,
            heroDamage: pd.heroDamage||0, towerDamage: pd.towerDamage||0,
            obsPlaced: pd.obsPlaced||0, senPlaced: pd.senPlaced||0,
            observerKills: pd.observerKills||0, sentryKills: pd.sentryKills||0,
            campsStacked: pd.campsStacked||0, firstBloodClaimed: pd.firstBloodClaimed||false,
            runesPickedUp: pd.runesPickedUp||0,
          },
        });
      }
    }
  }

  console.log(`Collected ${rawEntries.length} performance entries`);

  const updatedAt = new Date().toISOString();
  const rankingsRef = db.collection('tournaments').doc(tournamentId).collection('performanceRankings');

  if (rawEntries.length === 0) {
    console.log('No data found — writing empty docs');
    const batch = db.batch();
    batch.set(rankingsRef.doc('teams'), { entries: [], updatedAt, gameCount: 0 });
    for (const role of VALID_ROLES) batch.set(rankingsRef.doc(ROLE_DOC_ID[role]), { entries: [], updatedAt, gameCount: 0 });
    await batch.commit();
    return;
  }

  // 3. Accumulate per-player
  const avgGameMins = rawEntries.reduce((s, e) => s + e.gameMins, 0) / rawEntries.length;
  const playerAccum = {};
  for (const entry of rawEntries) {
    const score = calcScore(entry.role, entry.perf, entry.gameMins, avgGameMins);
    if (!playerAccum[entry.nickname]) {
      playerAccum[entry.nickname] = { role: entry.role, teamId: entry.teamId, totalScore: 0, games: 0 };
    }
    playerAccum[entry.nickname].totalScore += score;
    playerAccum[entry.nickname].games += 1;
  }

  // 4. Per-role arrays
  const roleEntries = { Carry:[], Mid:[], Offlane:[], 'Soft Support':[], 'Hard Support':[] };
  for (const [nickname, acc] of Object.entries(playerAccum)) {
    const role = acc.role;
    if (roleEntries[role]) {
      roleEntries[role].push({ name: nickname, teamName: teamNameMap[acc.teamId]||acc.teamId, avgScore: acc.totalScore/acc.games, games: acc.games });
    }
  }
  for (const role of VALID_ROLES) roleEntries[role].sort((a,b) => b.avgScore - a.avgScore);

  // 5. Team rankings
  const teamAccum = {};
  for (const acc of Object.values(playerAccum)) {
    if (!teamAccum[acc.teamId]) teamAccum[acc.teamId] = { totalScore: 0, games: 0 };
    teamAccum[acc.teamId].totalScore += acc.totalScore;
    teamAccum[acc.teamId].games += acc.games;
  }
  const teamEntries = Object.entries(teamAccum)
    .filter(([,v]) => v.games > 0)
    .map(([teamId, v]) => ({ name: teamNameMap[teamId]||teamId, teamName: teamNameMap[teamId]||teamId, avgScore: v.totalScore/v.games, games: v.games }))
    .sort((a,b) => b.avgScore - a.avgScore);

  // 6. Write to Firestore
  const batch = db.batch();
  batch.set(rankingsRef.doc('teams'), { entries: teamEntries, updatedAt, gameCount: rawEntries.length });
  for (const role of VALID_ROLES) {
    batch.set(rankingsRef.doc(ROLE_DOC_ID[role]), { entries: roleEntries[role], updatedAt, gameCount: rawEntries.length });
  }
  await batch.commit();

  console.log('\nRankings written successfully!');
  console.log('Teams:', teamEntries.slice(0,3).map(e => e.name + ' ' + e.avgScore.toFixed(2)).join(', '));
  for (const role of VALID_ROLES) {
    const top = roleEntries[role][0];
    if (top) console.log(`${role}: ${top.name} (${top.teamName}) — ${top.avgScore.toFixed(2)}`);
  }
}

run().catch(console.error);
