#!/usr/bin/env node
/**
 * Average game time (excluding forfeits) per team in the "wiosenna" tournament.
 *
 * A game is excluded when:
 *   - its parent match is not completed, or is a ban-forfeit (match.isBanForfeit), or
 *   - the game itself is flagged game.is_forfeit.
 * Each counted game contributes its `duration` (seconds) to BOTH participating teams
 * (teamA and teamB of the match).
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  require('dotenv').config({ path: '.env.local' });
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) { console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 not set'); process.exit(1); }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))),
  });
}
const db = admin.firestore();

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function main() {
  // Resolve the wiosenna tournament id
  const tSnap = await db.collection('tournaments').where('slug', '==', 'wiosenna').get();
  let matchesRef;
  if (!tSnap.empty) {
    const tid = tSnap.docs[0].id;
    const scoped = db.collection('tournaments').doc(tid).collection('matches');
    const probe = await scoped.limit(1).get();
    if (!probe.empty) {
      matchesRef = scoped;
      console.log(`Using scoped matches: tournaments/${tid}/matches`);
    }
  }
  if (!matchesRef) {
    matchesRef = db.collection('matches');
    console.log('Using legacy top-level matches collection');
  }

  const matchesSnap = await matchesRef.get();
  const completed = matchesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.status === 'completed' && !m.isBanForfeit);

  console.log(`Completed (non-ban-forfeit) matches: ${completed.length} / ${matchesSnap.size}\n`);

  // teamId -> { name, totalSec, games }
  const stats = new Map();
  const bump = (team, dur) => {
    if (!team || !team.id) return;
    const cur = stats.get(team.id) || { name: team.name || team.id, totalSec: 0, games: 0 };
    cur.totalSec += dur;
    cur.games += 1;
    cur.name = team.name || cur.name;
    stats.set(team.id, cur);
  };

  let countedGames = 0, skippedForfeitGames = 0;

  await Promise.all(completed.map(async (m) => {
    const gamesSnap = await matchesRef.doc(m.id).collection('games').get();
    for (const g of gamesSnap.docs) {
      const game = g.data();
      if (game.is_forfeit) { skippedForfeitGames++; continue; }
      const dur = Number(game.duration);
      if (!dur || !isFinite(dur) || dur <= 0) continue;
      bump(m.teamA, dur);
      bump(m.teamB, dur);
      countedGames++;
    }
  }));

  const rows = [...stats.values()]
    .map((r) => ({ ...r, avgSec: r.totalSec / r.games }))
    .sort((a, b) => a.avgSec - b.avgSec);

  console.log(`Counted games: ${countedGames}  |  skipped forfeit games: ${skippedForfeitGames}\n`);
  console.log('Team'.padEnd(28), 'Games', ' AvgTime');
  console.log('-'.repeat(48));
  for (const r of rows) {
    console.log(r.name.padEnd(28), String(r.games).padStart(5), '  ', fmt(r.avgSec));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
