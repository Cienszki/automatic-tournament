#!/usr/bin/env node
/**
 * backfill-approved-standins.js
 *
 * One-time script: reads all approved/appeal_approved standinRequests from
 * tournaments/{tournamentId}/standinRequests and writes the matching entry
 * into the match document's `approvedStandins` map — for matches that were
 * played before the new field was introduced.
 *
 * Usage:
 *   node scripts/backfill-approved-standins.js                  ← dry-run (safe, no writes)
 *   node scripts/backfill-approved-standins.js --apply          ← actually write to Firestore
 *   node scripts/backfill-approved-standins.js --tournament pdl ← limit to one tournament slug
 *
 * Steam ID resolution:
 *   /profiles/<steam64> URLs are resolved purely mathematically (no API call).
 *   /id/<customUrl>     URLs cannot be resolved without the Steam API and will
 *                       be skipped with a warning.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');
const https = require('https');

// ─── Firebase init ────────────────────────────────────────────────────────────

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (serviceAccountBase64) {
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✓ Firebase: service account from env');
} else {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'tournament-tracker-f35tb',
        });
        console.log('✓ Firebase: application default credentials');
    } catch (e) {
        console.error('✗ Firebase init failed:', e.message);
        process.exit(1);
    }
}

const db = admin.firestore();

// ─── Args ─────────────────────────────────────────────────────────────────────

const DRY_RUN  = !process.argv.includes('--apply');
const LIMIT_SLUG_IDX = process.argv.indexOf('--tournament');
const LIMIT_SLUG = LIMIT_SLUG_IDX !== -1 ? process.argv[LIMIT_SLUG_IDX + 1] : null;

// ─── Steam ID helpers ─────────────────────────────────────────────────────────

const STEAM_BASE = BigInt('76561197960265728');
const STEAM_API_KEY = process.env.STEAM_API_KEY || process.env.NEXT_PUBLIC_STEAM_API_KEY;

/** Resolves a Steam vanity URL to steamId32 via the Steam Web API. */
function resolveVanityUrl(vanityUrl) {
    return new Promise((resolve) => {
        if (!STEAM_API_KEY) { resolve(null); return; }
        const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanityUrl)}`;
        https.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json?.response?.success === 1 && json.response.steamid) {
                        const steam64 = json.response.steamid;
                        resolve((BigInt(steam64) - STEAM_BASE).toString());
                    } else {
                        resolve(null);
                    }
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

/** Returns steamId32 string or null. Resolves both /profiles/ and /id/ URLs. */
async function resolveSteamId32FromUrl(url) {
    if (!url) return null;
    // Reject obviously non-Steam URLs (e.g. Discord)
    if (!url.includes('steamcommunity.com')) return null;
    // /profiles/<steam64>  (17-digit number)
    const profileMatch = url.match(/\/profiles\/(\d{17})/);
    if (profileMatch) {
        try { return (BigInt(profileMatch[1]) - STEAM_BASE).toString(); } catch { return null; }
    }
    // /id/<vanityUrl>
    const vanityMatch = url.match(/\/id\/([^/?&#]+)/);
    if (vanityMatch) {
        return await resolveVanityUrl(vanityMatch[1]);
    }
    return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Backfill: approvedStandins → match documents');
    console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✏️  APPLY (writing to Firestore)'}`);
    if (LIMIT_SLUG) console.log(`  Limit: tournament slug = "${LIMIT_SLUG}"`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // 1. Load tournaments
    const tournamentsSnap = await db.collection('tournaments').get();
    const tournaments = tournamentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => !LIMIT_SLUG || t.slug === LIMIT_SLUG);

    if (tournaments.length === 0) {
        console.error('No matching tournaments found.');
        process.exit(1);
    }

    let totalRequests = 0;
    let totalSkippedAlreadySet = 0;
    let totalSkippedNoSteamId = 0;
    let totalWrites = 0;

    for (const tournament of tournaments) {
        console.log(`\n▶ Tournament: ${tournament.name || tournament.id} (${tournament.id})`);

        const reqsSnap = await db
            .collection('tournaments')
            .doc(tournament.id)
            .collection('standinRequests')
            .get();

        const approved = reqsSnap.docs.filter(d =>
            ['approved', 'appeal_approved'].includes(d.data().status)
        );

        console.log(`  Found ${approved.length} approved standin requests (out of ${reqsSnap.size} total)`);

        // Group by matchId so we can batch updates per match
        const byMatch = new Map(); // matchId → [{ requestId, data }]
        for (const docSnap of approved) {
            const data = docSnap.data();
            if (!data.matchId) { continue; }
            if (!byMatch.has(data.matchId)) byMatch.set(data.matchId, []);
            byMatch.get(data.matchId).push({ requestId: docSnap.id, data });
        }

        for (const [matchId, requests] of byMatch) {
            const matchRef = db
                .collection('tournaments')
                .doc(tournament.id)
                .collection('matches')
                .doc(matchId);

            const matchSnap = await matchRef.get();
            if (!matchSnap.exists) {
                console.log(`  ⚠  Match ${matchId} not found — skipping`);
                continue;
            }

            const matchData = matchSnap.data();
            const existingApproved = matchData.approvedStandins || {};
            const updates = {};

            for (const { requestId, data } of requests) {
                totalRequests++;

                // Skip if already written
                if (existingApproved[requestId]) {
                    console.log(`  ↷  [${matchId}] ${data.standinNickname} — already in approvedStandins, skip`);
                    totalSkippedAlreadySet++;
                    continue;
                }

                const steamId32 = await resolveSteamId32FromUrl(data.standinSteamProfileUrl);
                if (!steamId32) {
                    const reason = !data.standinSteamProfileUrl
                        ? 'no URL'
                        : !data.standinSteamProfileUrl.includes('steamcommunity.com')
                            ? 'not a Steam URL'
                            : 'Steam API lookup failed';
                    console.log(`  ⚠  [${matchId}] ${data.standinNickname} — cannot resolve steamId32 (${reason}): ${data.standinSteamProfileUrl}`);
                    totalSkippedNoSteamId++;
                    continue;
                }

                updates[`approvedStandins.${requestId}`] = {
                    steamId32,
                    nickname: data.standinNickname || '',
                    replacedPlayerId: data.replacedPlayerId || '',
                    replacedPlayerNickname: data.replacedPlayerNickname || '',
                    teamId: data.teamId || '',
                    approvedAt: data.respondedAt || data.appealResolvedAt || data.updatedAt || new Date().toISOString(),
                };

                console.log(`  ✓  [${matchId}] ${data.standinNickname} (steamId32=${steamId32}) za ${data.replacedPlayerNickname}`);
                totalWrites++;
            }

            if (Object.keys(updates).length > 0) {
                if (!DRY_RUN) {
                    await matchRef.update(updates);
                } else {
                    console.log(`     → Would write ${Object.keys(updates).length} field(s) to match ${matchId}`);
                }
            }
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Approved requests found  : ${totalRequests}`);
    console.log(`  Already set (skipped)    : ${totalSkippedAlreadySet}`);
    console.log(`  No steamId (skipped)     : ${totalSkippedNoSteamId}`);
    console.log(`  ${DRY_RUN ? 'Would write' : 'Written'}                  : ${totalWrites}`);
    if (DRY_RUN && totalWrites > 0) {
        console.log('');
        console.log('  Run with --apply to commit these changes.');
    }
    console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => {
    console.error('\n✗ Fatal error:', err);
    process.exit(1);
});
