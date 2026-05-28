/**
 * PDL Performance Score Calculator  v2
 *
 * Changes from v1:
 *   + All COUNT stats normalized to average game duration (eliminates 30-min vs 60-min bias)
 *     GPM and XPM are NOT normalized - they are already per-minute rates
 *   + Added: observerKills x 0.25 + sentryKills x 0.10  (deward quality, all roles)
 *   + Added: campsStacked x 0.20  (all roles)
 *   + Added: firstBloodClaimed x 0.75  (all roles)
 *   + Added: runesPickedUp x 0.07  (Mid only)
 *   + Tables include a per-factor breakdown column
 *   + heroHealing removed (hero-discriminatory)
 *
 * Calibration anchors (PDL raw averages before normalization):
 *   Carry (98g):   K 8.70  A 11.34  D 5.19  GPM 598  LH 313  HeroDmg 27282  TwrDmg 6563
 *                  obsK 0.24  senK 0.65  camps 1.51  runes 3.38  fb% 16.3
 *   Mid (98g):     K 7.84  A 13.06  D 5.91  XPM 660  LH 219  HeroDmg 26595  TwrDmg 2783
 *                  obsK 0.81  senK 1.12  camps 0.91  runes 7.55  fb% 7.1
 *   Offlane(100g): K 6.23  A 13.98  D 6.49  GPM 488  HeroDmg 20942  TwrDmg 2704
 *                  Obs 0.9  Sen 1.9  obsK 0.53  senK 1.01  camps 0.92  fb% 6.0
 *   SS (98g):      K 4.42  A 16.24  D 7.86  GPM 326  HeroDmg 16713  TwrDmg 844
 *                  Obs 5.9  Sen 10.4  obsK 1.64  senK 3.43  camps 2.36  fb% 11.2
 *   HS (92g):      K 4.20  A 17.77  D 7.08  GPM 321  HeroDmg 15135  TwrDmg 1209
 *                  Obs 7.4  Sen 15.7  obsK 1.64  senK 4.43  camps 1.24  fb% 9.8
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];

// Global bonus weights (same across all roles)
const OBS_KILL_W = 0.25; // per normalized observer kill (deward)
const SEN_KILL_W = 0.10; // per normalized sentry kill  (deward)
const CAMP_W     = 0.20; // per normalized camp stack
const FB_W       = 0.75; // flat bonus for claiming first blood
const RUNE_W     = 0.07; // per normalized rune pickup (Mid only)

// ---------------------------------------------------------------------------
// SCORE BREAKDOWN
// Returns individual point contributions grouped by factor.
// All count stats are normalized to the average game duration so that
// a 20-min stomp and a 50-min grind are measured on the same scale.
// GPM and XPM are already rates (gold/xp per minute) - no normalization needed.
// ---------------------------------------------------------------------------

function calcBreakdown(role, p, gameMins, avgGameMins) {
  const n   = (v) => (v || 0) * avgGameMins / gameMins;
  const gpm = p.gpm || 0;
  const xpm = p.xpm || 0;

  let killPts = 0, assistPts = 0, deathPts = 0, farmPts = 0, dmgPts = 0, wardPts = 0;

  switch (role) {
    case 'Carry':
      killPts   = n(p.kills)   * 0.29;
      assistPts = n(p.assists) * 0.13;
      deathPts  = n(p.deaths)  * (-0.38);
      farmPts   = Math.max(gpm - 300, 0) / 150 + n(p.lastHits) / 150;
      dmgPts    = n(p.heroDamage) / 14000 + n(p.towerDamage) / 4000;
      wardPts   = 0;
      break;
    case 'Mid':
      killPts   = n(p.kills)   * 0.38;
      assistPts = n(p.assists) * 0.12;
      deathPts  = n(p.deaths)  * (-0.34);
      farmPts   = Math.max(xpm - 300, 0) / 144 + n(p.lastHits) / 220;
      dmgPts    = n(p.heroDamage) / 12000 + n(p.towerDamage) / 3500;
      wardPts   = 0;
      break;
    case 'Offlane':
      killPts   = n(p.kills)   * 0.43;
      assistPts = n(p.assists) * 0.23;
      deathPts  = n(p.deaths)  * (-0.30);
      farmPts   = Math.max(gpm - 250, 0) / 175;
      dmgPts    = n(p.heroDamage) / 9000 + n(p.towerDamage) / 2000;
      wardPts   = n(p.obsPlaced) * 0.20 + n(p.senPlaced) * 0.20;
      break;
    case 'Soft Support':
      killPts   = n(p.kills)   * 0.35;
      assistPts = n(p.assists) * 0.20;
      deathPts  = n(p.deaths)  * (-0.25);
      farmPts   = Math.max(gpm - 200, 0) / 130;
      dmgPts    = n(p.heroDamage) / 13000 + n(p.towerDamage) / 1300;
      wardPts   = n(p.obsPlaced) * 0.22 + n(p.senPlaced) * 0.15;
      break;
    case 'Hard Support':
      killPts   = n(p.kills)   * 0.23;
      assistPts = n(p.assists) * 0.20;
      deathPts  = n(p.deaths)  * (-0.21);
      farmPts   = Math.max(gpm - 200, 0) / 200;
      dmgPts    = n(p.heroDamage) / 11500 + n(p.towerDamage) / 2000;
      wardPts   = n(p.obsPlaced) * 0.18 + n(p.senPlaced) * 0.12;
      break;
  }

  const dewardPts = n(p.observerKills) * OBS_KILL_W + n(p.sentryKills) * SEN_KILL_W;
  const campPts   = n(p.campsStacked)  * CAMP_W;
  const miscPts   = (p.firstBloodClaimed ? FB_W : 0)
                  + (role === 'Mid' ? n(p.runesPickedUp) * RUNE_W : 0);

  const kadPts = killPts + assistPts + deathPts;
  const total  = kadPts + farmPts + dmgPts + wardPts + dewardPts + campPts + miscPts;
  return { kadPts, farmPts, dmgPts, wardPts, dewardPts, campPts, miscPts, total };
}

// ---------------------------------------------------------------------------
// TABLE HELPERS
// Column widths: Player, Team, G, Total, KAD, Farm, Dmg, Ward, Dwd, Camp, Misc
// ---------------------------------------------------------------------------
const COLS = [18, 16, 3, 6, 6, 5, 5, 5, 5, 5, 5];
const HDRS = ['Player', 'Team', 'G', 'Total', 'KAD', 'Farm', 'Dmg', 'Ward', 'Dwd', 'Camp', 'Misc'];

function sepLine() {
  return '+' + COLS.map(w => '-'.repeat(w + 2)).join('+') + '+';
}

function tableRow(vals, rightAlignSet) {
  return '|' + COLS.map((w, i) => {
    const s = String(vals[i] === null || vals[i] === undefined ? '' : vals[i]).substring(0, w);
    return rightAlignSet.has(i) ? ` ${s.padStart(w)} ` : ` ${s.padEnd(w)} `;
  }).join('|') + '|';
}

function fmtPts(v) {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

const RIGHT_COLS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10]);

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const tourSnap = await db.collection('tournaments').where('slug', '==', 'pdl').limit(1).get();
  if (tourSnap.empty) { console.error('No PDL tournament found'); process.exit(1); }
  const tourId = tourSnap.docs[0].id;

  // Build player map
  const teamsSnap = await db.collection('tournaments').doc(tourId).collection('teams').get();
  const teamMap = {}, playerMap = {};
  for (const t of teamsSnap.docs) {
    teamMap[t.id] = t.data().name;
    const ps = await db.collection('tournaments').doc(tourId).collection('teams').doc(t.id).collection('players').get();
    for (const p of ps.docs) {
      const pd = p.data();
      playerMap[p.id] = { nickname: pd.nickname, role: pd.role, teamId: t.id };
    }
  }

  // Phase 1 - collect raw performance data with game durations from game docs
  const rawPerfs = [];
  const matchesSnap = await db.collection('tournaments').doc(tourId).collection('matches')
    .where('status', '==', 'completed').get();

  for (const m of matchesSnap.docs) {
    const gamesSnap = await db.collection('tournaments').doc(tourId)
      .collection('matches').doc(m.id).collection('games').get();

    for (const g of gamesSnap.docs) {
      const gd = g.data();
      const gameMins = (gd.duration > 0 ? gd.duration : 2400) / 60;

      const perfSnap = await db.collection('tournaments').doc(tourId)
        .collection('matches').doc(m.id)
        .collection('games').doc(g.id)
        .collection('performances').get();

      for (const perf of perfSnap.docs) {
        const pd = perf.data();
        const pInfo = playerMap[pd.steamId] || playerMap[perf.id];
        if (!pInfo || !ROLES.includes(pInfo.role)) continue;
        rawPerfs.push({ pInfo, pd, gameMins });
      }
    }
  }

  // Average game duration = normalization reference
  const avgGameMins = rawPerfs.reduce((s, x) => s + x.gameMins, 0) / rawPerfs.length;

  // Phase 2 - score accumulation
  const roleAcc = {};
  for (const r of ROLES) {
    roleAcc[r] = { games: 0, total: 0, kad: 0, farm: 0, dmg: 0, ward: 0, dwd: 0, camp: 0, misc: 0 };
  }
  const playerAcc = {};

  for (const { pInfo, pd, gameMins } of rawPerfs) {
    const bd = calcBreakdown(pInfo.role, pd, gameMins, avgGameMins);
    const ra = roleAcc[pInfo.role];
    ra.games++; ra.total += bd.total; ra.kad += bd.kadPts; ra.farm += bd.farmPts;
    ra.dmg += bd.dmgPts; ra.ward += bd.wardPts; ra.dwd += bd.dewardPts;
    ra.camp += bd.campPts; ra.misc += bd.miscPts;

    const key = pInfo.nickname;
    if (!playerAcc[key]) {
      playerAcc[key] = {
        role: pInfo.role, team: teamMap[pInfo.teamId] || '---',
        games: 0, total: 0, kad: 0, farm: 0, dmg: 0, ward: 0, dwd: 0, camp: 0, misc: 0
      };
    }
    const pa = playerAcc[key];
    pa.games++; pa.total += bd.total; pa.kad += bd.kadPts; pa.farm += bd.farmPts;
    pa.dmg += bd.dmgPts; pa.ward += bd.wardPts; pa.dwd += bd.dewardPts;
    pa.camp += bd.campPts; pa.misc += bd.miscPts;
  }

  // --- FORMULA SUMMARY ----------------------------------------------------
  console.log('\n=== PDL PERFORMANCE SCORE v2 - FORMULA SUMMARY ===\n');
  console.log('  Games analyzed      : ' + rawPerfs.length);
  console.log('  Avg game duration   : ' + avgGameMins.toFixed(1) + ' min  (normalization reference)');
  console.log('  stat_norm = stat_raw * ' + avgGameMins.toFixed(1) + ' / game_duration_min');
  console.log('  GPM and XPM are NOT normalized (already per-minute rates)\n');

  const fLines = [
    ['CARRY',        'K*0.29  A*0.13  D*(-0.38)  +(GPM-300)/150  +LH/150  +HeroDmg/14000  +TwrDmg/4000'],
    ['MID',          'K*0.38  A*0.12  D*(-0.34)  +(XPM-300)/144  +LH/220  +HeroDmg/12000  +TwrDmg/3500'],
    ['OFFLANE',      'K*0.43  A*0.23  D*(-0.30)  +(GPM-250)/175  +HeroDmg/9000  +TwrDmg/2000  +Obs*0.20  +Sen*0.20'],
    ['SOFT SUPPORT', 'K*0.35  A*0.20  D*(-0.25)  +(GPM-200)/130  +HeroDmg/13000  +TwrDmg/1300  +Obs*0.22  +Sen*0.15'],
    ['HARD SUPPORT', 'K*0.23  A*0.20  D*(-0.21)  +(GPM-200)/200  +HeroDmg/11500  +TwrDmg/2000  +Obs*0.18  +Sen*0.12'],
  ];
  for (const [role, formula] of fLines) {
    console.log('  ' + role.padEnd(14) + ': ' + formula);
  }
  console.log('\n  Universal bonuses (all roles, count stats normalized):');
  console.log('    +obsKills*' + OBS_KILL_W + '  +senKills*' + SEN_KILL_W + '   [deward: obs kill more valuable than sen kill]');
  console.log('    +campsStacked*' + CAMP_W + '             [camp stacking]');
  console.log('    +firstBlood*' + FB_W + '               [first blood]');
  console.log('  Mid bonus only:');
  console.log('    +runesPickedUp*' + RUNE_W + '            [rune control]\n');

  // --- ROLE BALANCE CHECK --------------------------------------------------
  console.log('  ROLE BALANCE:');
  const avgVals = ROLES.map(r => roleAcc[r].games > 0 ? roleAcc[r].total / roleAcc[r].games : 0);
  const maxA = Math.max(...avgVals), minA = Math.min(...avgVals);
  for (let i = 0; i < ROLES.length; i++) {
    const avg = avgVals[i];
    console.log('    ' + ROLES[i].padEnd(14) + ' ' + avg.toFixed(2).padStart(5) + ' pts   ' + '#'.repeat(Math.round(avg)));
  }
  console.log('\n  Imbalance: ' + ((maxA / minA - 1) * 100).toFixed(1) + '%  (target < 10%)\n');

  // --- COLUMN LEGEND -------------------------------------------------------
  console.log('=== PLAYER PERFORMANCE TABLES ===\n');
  console.log('  KAD  = kills + assists + deaths combined (deaths are negative)');
  console.log('  Farm = GPM/XPM floor surplus + last hits');
  console.log('  Dmg  = hero damage + tower damage');
  console.log('  Ward = observer wards placed + sentry wards placed');
  console.log('  Dwd  = observer kills*0.25 + sentry kills*0.10  (dewards)');
  console.log('  Camp = camps stacked*0.20');
  console.log('  Misc = first blood*0.75  (+ runes*0.07 for Mid)\n');

  // --- PLAYER TABLES -------------------------------------------------------
  for (const role of ROLES) {
    const ra = roleAcc[role];
    const roleAvg = ra.games > 0 ? ra.total / ra.games : 0;

    const players = Object.entries(playerAcc)
      .filter(([, s]) => s.role === role && s.games > 0)
      .map(([name, s]) => ({
        name, team: s.team.substring(0, 16), games: s.games,
        avg:  s.total / s.games, kad:  s.kad  / s.games, farm: s.farm / s.games,
        dmg:  s.dmg   / s.games, ward: s.ward / s.games, dwd:  s.dwd  / s.games,
        camp: s.camp  / s.games, misc: s.misc / s.games,
      }))
      .sort((a, b) => b.avg - a.avg);

    const hdr = '  ' + role.toUpperCase() + '  --  avg ' + roleAvg.toFixed(2) + ' pts/game  |  '
              + players.length + ' players  |  ' + ra.games + ' games';

    console.log(sepLine());
    console.log(tableRow([hdr, ...Array(10).fill('')], new Set()));
    console.log(sepLine());
    console.log(tableRow(HDRS, RIGHT_COLS));
    console.log(sepLine());

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const medal = i === 0 ? '1.' : i === 1 ? '2.' : i === 2 ? '3.' : (i + 1) + '.';
      const nameStr = (medal + ' ' + p.name).substring(0, 18);
      console.log(tableRow([
        nameStr, p.team, p.games,
        fmtPts(p.avg), fmtPts(p.kad),
        p.farm.toFixed(2), p.dmg.toFixed(2), p.ward.toFixed(2),
        p.dwd.toFixed(2), p.camp.toFixed(2), p.misc.toFixed(2),
      ], RIGHT_COLS));
    }

    console.log(sepLine());
    console.log(tableRow([
      '  ROLE AVG', '', ra.games,
      fmtPts(ra.total / ra.games), fmtPts(ra.kad / ra.games),
      (ra.farm / ra.games).toFixed(2), (ra.dmg / ra.games).toFixed(2),
      (ra.ward / ra.games).toFixed(2), (ra.dwd / ra.games).toFixed(2),
      (ra.camp / ra.games).toFixed(2), (ra.misc / ra.games).toFixed(2),
    ], RIGHT_COLS));
    console.log(sepLine());
    console.log();
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
