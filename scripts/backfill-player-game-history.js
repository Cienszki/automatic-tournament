#!/usr/bin/env node
/**
 * backfill-player-game-history.js
 *
 * Populates the `playerGameHistory/{steamId64}/games/{gameId}` subcollection
 * for all existing PDL games so that the player profile can display them
 * without deep-reading the performances subcollection.
 *
 * Handles two performance doc formats:
 *   - NEW (post March 2026): doc ID = steamId64 (17-digit number)
 *   - OLD (pre March 2026): doc ID = Firestore auto-ID, no steamId field
 *     → falls back to re-fetching the game from OpenDota and matching players
 *       by heroId + kills + deaths + assists + gpm (unique per game)
 *
 * Usage:
 *   node scripts/backfill-player-game-history.js              # dry-run
 *   node scripts/backfill-player-game-history.js --apply      # write to Firestore
 *   node scripts/backfill-player-game-history.js --tournament pdl-s1 --apply
 *   node scripts/backfill-player-game-history.js --match <matchId> --apply   # single match
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const https = require('https');

// ─── Firebase init ─────────────────────────────────────────────────────────

if (!admin.apps.length) {
  const sa = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
  );
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

// ─── Args ──────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const TOURNAMENT_ID = argv.includes('--tournament')
  ? argv[argv.indexOf('--tournament') + 1]
  : 'pdl-s1';
const SINGLE_MATCH = argv.includes('--match')
  ? argv[argv.indexOf('--match') + 1]
  : null;

if (DRY_RUN) console.log('=== DRY RUN — pass --apply to write ===\n');
console.log(`Tournament: ${TOURNAMENT_ID}${SINGLE_MATCH ? ` | Match: ${SINGLE_MATCH}` : ''}\n`);

// ─── Steam helpers ──────────────────────────────────────────────────────────

const STEAM_BASE = BigInt('76561197960265728');
function steam64FromAccountId(accountId) {
  return String(BigInt(accountId) + STEAM_BASE);
}
function isSteamId64(str) {
  return /^\d{17}$/.test(String(str));
}

// ─── OpenDota fetch ─────────────────────────────────────────────────────────

function fetchOpenDota(path) {
  return new Promise((resolve, reject) => {
    const url = `https://api.opendota.com/api${path}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Failed to parse OpenDota response: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

// Rate-limit OpenDota calls — max 1 per second to stay within free tier
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Build playerGameHistory entry from known data ──────────────────────────

function buildHistoryEntry(gameId, matchId, perfData, gameDoc) {
  const isRadiant = perfData.teamId === gameDoc.radiant_team?.id;
  const won = isRadiant ? gameDoc.radiant_win : !gameDoc.radiant_win;
  const enemyTeam = isRadiant ? gameDoc.dire_team : gameDoc.radiant_team;
  return {
    gameId: String(gameId),
    matchId,
    heroId: perfData.heroId ?? 0,
    kills: perfData.kills ?? 0,
    deaths: perfData.deaths ?? 0,
    assists: perfData.assists ?? 0,
    won,
    teamId: perfData.teamId ?? '',
    enemyTeamId: enemyTeam?.id ?? '',
    enemyTeamName: enemyTeam?.name ?? '',
    gpm: perfData.gpm ?? 0,
    xpm: perfData.xpm ?? 0,
    fantasyPoints: perfData.fantasyPoints ?? 0,
    gameDuration: gameDoc.duration ?? 0,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // Load all matches
  let matchQuery = db.collection('tournaments').doc(TOURNAMENT_ID).collection('matches');
  if (SINGLE_MATCH) {
    matchQuery = matchQuery.where(admin.firestore.FieldPath.documentId(), '==', SINGLE_MATCH);
  }
  const matchesSnap = await matchQuery.get();
  console.log(`Found ${matchesSnap.size} match(es)\n`);

  let totalGames = 0;
  let totalWritten = 0;
  let totalSkipped = 0;
  let totalOldFormat = 0;
  let totalOldFormatResolved = 0;

  for (const matchDoc of matchesSnap.docs) {
    const matchId = matchDoc.id;
    const matchData = matchDoc.data();
    const gamesSnap = await db
      .collection('tournaments').doc(TOURNAMENT_ID)
      .collection('matches').doc(matchId)
      .collection('games').get();

    if (gamesSnap.empty) continue;

    for (const gameDoc of gamesSnap.docs) {
      const gameId = gameDoc.id;
      const gameData = gameDoc.data();
      totalGames++;

      const perfsSnap = await db
        .collection('tournaments').doc(TOURNAMENT_ID)
        .collection('matches').doc(matchId)
        .collection('games').doc(gameId)
        .collection('performances').get();

      if (perfsSnap.empty) {
        console.log(`  [SKIP] match=${matchId} game=${gameId} — no performances`);
        totalSkipped++;
        continue;
      }

      // Classify: new format (steamId64 doc IDs) vs old format (auto-IDs)
      const newFormatPerfs = [];
      const oldFormatPerfs = [];
      for (const perfDoc of perfsSnap.docs) {
        if (isSteamId64(perfDoc.id)) {
          newFormatPerfs.push(perfDoc);
        } else {
          oldFormatPerfs.push(perfDoc);
        }
      }

      const batch = db.batch();
      let batchCount = 0;

      // ── New-format: use performance data directly ──────────────────────
      for (const perfDoc of newFormatPerfs) {
        const steamId64 = perfDoc.id;
        const entry = buildHistoryEntry(gameId, matchId, perfDoc.data(), gameData);
        const ref = db
          .collection('tournaments').doc(TOURNAMENT_ID)
          .collection('playerGameHistory').doc(steamId64)
          .collection('games').doc(String(gameId));
        batch.set(ref, entry);
        batchCount++;
      }

      // ── Old-format: re-fetch from OpenDota to identify players ─────────
      if (oldFormatPerfs.length > 0) {
        totalOldFormat += oldFormatPerfs.length;
        console.log(`  [OLD] match=${matchId} game=${gameId} — ${oldFormatPerfs.length} unidentified performance(s), fetching from OpenDota...`);

        try {
          await sleep(1100); // respect OpenDota rate limit
          const odMatch = await fetchOpenDota(`/matches/${gameId}`);
          if (!odMatch || !Array.isArray(odMatch.players)) {
            console.log(`    [WARN] OpenDota returned no player data for game ${gameId}`);
          } else {
            for (const perfDoc of oldFormatPerfs) {
              const perfData = perfDoc.data();
              // Match by heroId + kills + deaths + assists (unique combination per game)
              const odPlayer = odMatch.players.find(p =>
                p.hero_id === perfData.heroId &&
                p.kills === perfData.kills &&
                p.deaths === perfData.deaths &&
                p.assists === perfData.assists
              );
              if (!odPlayer || !odPlayer.account_id) {
                console.log(`    [WARN] Could not identify player for perf doc ${perfDoc.id} in game ${gameId}`);
                continue;
              }

              const steamId64 = steam64FromAccountId(odPlayer.account_id);
              const entry = buildHistoryEntry(gameId, matchId, perfData, gameData);
              const ref = db
                .collection('tournaments').doc(TOURNAMENT_ID)
                .collection('playerGameHistory').doc(steamId64)
                .collection('games').doc(String(gameId));
              batch.set(ref, entry);
              batchCount++;
              totalOldFormatResolved++;
              console.log(`    [MATCH] doc ${perfDoc.id} → steamId64=${steamId64} (hero=${perfData.heroId} k/d/a=${perfData.kills}/${perfData.deaths}/${perfData.assists})`);
            }
          }
        } catch (err) {
          console.error(`    [ERROR] OpenDota fetch failed for game ${gameId}:`, err.message);
        }
      }

      if (batchCount === 0) {
        totalSkipped++;
        continue;
      }

      console.log(`  game ${gameId} (match ${matchId}): ${batchCount} playerGameHistory writes`);
      if (!DRY_RUN) {
        await batch.commit();
        totalWritten += batchCount;
      } else {
        totalWritten += batchCount; // count for dry-run reporting
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Matches processed : ${matchesSnap.size}`);
  console.log(`Games processed   : ${totalGames}`);
  console.log(`Games skipped     : ${totalSkipped}`);
  console.log(`Old-format perfs  : ${totalOldFormat} (${totalOldFormatResolved} resolved via OpenDota)`);
  console.log(`History entries   : ${totalWritten} ${DRY_RUN ? '(dry-run, not written)' : 'written'}`);
  if (DRY_RUN) console.log('\nRun with --apply to commit changes.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
