"use strict";
// bot-worker/setup-local.js
// ─────────────────────────────────────────────────────────────────────────────
// Reproduce, for LOCAL development/testing, the steam-resources proto surgery that
// the Dockerfile does on Railway. Plain `npm install` is NOT enough: node-dota2 +
// steam need protobufjs@4 nested in two places, and steam's bundled steam-resources
// 1.2.0 CSODOTALobby has no member list, so lobby.all_members decodes empty and the
// bot can't see who's in a lobby. This script fixes all of that so the local harnesses
// (dist/diagnose.js, dist/_score-change-test.js) decode lobbies correctly.
//
// Run it AFTER `npm install`, from the bot-worker/ directory:
//     npm install
//     node setup-local.js
//
// Cross-platform (uses Node fs, not shell `cp`). Requires Node >= 16.7 (fs.cpSync);
// package.json pins node >= 20. Idempotent — safe to re-run.
//
// NOTE: none of this is needed to DEPLOY the bot — Railway's Dockerfile does the same
// steps at build time. This is only for running the bot/harnesses locally.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const NM = path.join(ROOT, 'node_modules');
const exists = (p) => fs.existsSync(p);
const cp = (src, dst) => fs.cpSync(src, dst, { recursive: true, force: true });

function main() {
    if (typeof fs.cpSync !== 'function') {
        console.error('This script needs Node >= 16.7 (fs.cpSync). You are on ' + process.version + '.');
        process.exit(1);
    }
    if (!exists(NM)) {
        console.error('node_modules/ not found — run `npm install` in bot-worker/ first.');
        process.exit(1);
    }
    const steamSR = path.join(NM, 'steam', 'node_modules', 'steam-resources');
    if (!exists(steamSR)) {
        console.error('node_modules/steam/node_modules/steam-resources not found — did `npm install` succeed?');
        process.exit(1);
    }

    // 1) Install protobufjs@4 (+bytebuffer/long) into a temp dir WITHOUT its svn prepare
    //    script (which fetches proto defs over dead SVN and would fail).
    const tmp = path.join(ROOT, '.pbjs4-tmp');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'package.json'), '{}');
    console.log('Installing protobufjs@4 into a temp dir...');
    execSync('npm install --no-package-lock --no-audit --no-fund --ignore-scripts "protobufjs@>=4.1.3 <5"',
        { cwd: tmp, stdio: 'inherit', shell: true });
    const tnm = path.join(tmp, 'node_modules');

    // 2) Fix 1 — nest protobufjs@4 (+bytebuffer/long) inside steam's steam-resources so its
    //    require('protobufjs') resolves v4 before walking up to the root v7.
    const steamSRnm = path.join(steamSR, 'node_modules');
    fs.mkdirSync(steamSRnm, { recursive: true });
    cp(path.join(tnm, 'protobufjs'), path.join(steamSRnm, 'protobufjs'));
    const pbNM = path.join(steamSRnm, 'protobufjs', 'node_modules');
    fs.mkdirSync(pbNM, { recursive: true });
    cp(path.join(tnm, 'bytebuffer'), path.join(pbNM, 'bytebuffer'));
    if (exists(path.join(tnm, 'long'))) cp(path.join(tnm, 'long'), path.join(pbNM, 'long'));
    console.log('Fix 1: nested protobufjs@4 in steam/node_modules/steam-resources');

    // 3) Fix 2 — node-dota2 does require('steam-resources') and resolves at ROOT, where npm
    //    put none. Copy steam's (now protobufjs@4-patched) steam-resources to the root, and
    //    nest csv-parse/bytebuffer/long (bundled with steam, not at root).
    const rootSR = path.join(NM, 'steam-resources');
    fs.rmSync(rootSR, { recursive: true, force: true });
    cp(steamSR, rootSR);
    const rootSRnm = path.join(rootSR, 'node_modules');
    fs.mkdirSync(rootSRnm, { recursive: true });
    for (const dep of ['csv-parse', 'bytebuffer', 'long']) {
        const src = path.join(NM, 'steam', 'node_modules', dep);
        if (exists(src)) cp(src, path.join(rootSRnm, dep));
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('Fix 2: copied steam-resources to root node_modules');

    // 4) Fix 3 — inject a minimal, import-free CSODOTALobbyMember + `all_members = 120` into
    //    1.2.0's lobby proto (getCurrentLobbyPlayers only reads id/team/slot). We keep 1.2.0
    //    (not newer protobufs) because newer ones drop DOTAGameVersion, which createPracticeLobby
    //    needs. Idempotent.
    const proto = path.join(rootSR, 'protobufs', 'dota2', 'dota_gcmessages_common_match_management.proto');
    let s = fs.readFileSync(proto, 'utf8');
    if (!s.includes('message CSODOTALobbyMember')) {
        s = s.replace('message CSODOTALobby {',
            'message CSODOTALobbyMember { optional fixed64 id = 1; optional uint32 team = 3; optional uint32 slot = 7; } message CSODOTALobby { repeated .CSODOTALobbyMember all_members = 120;');
        fs.writeFileSync(proto, s);
        console.log('Fix 3: patched CSODOTALobby with all_members');
    } else {
        console.log('Fix 3: CSODOTALobbyMember already present');
    }

    // 5) Assertion — load the schema the way node-dota2 does and fail loudly if the lobby
    //    member type or the game-version enum is missing.
    const D = require(rootSR).GC.Dota.Internal;
    if (!D || !D.CSODOTALobbyMember) {
        console.error('FATAL: CSODOTALobbyMember missing after patch');
        process.exit(1);
    }
    if (!D.DOTAGameVersion || D.DOTAGameVersion.GAME_VERSION_STABLE === undefined) {
        console.error('FATAL: DOTAGameVersion.GAME_VERSION_STABLE missing (createLobby would break)');
        process.exit(1);
    }
    console.log('OK: CSODOTALobbyMember + DOTAGameVersion both present — local node_modules ready.');
    console.log('You can now run:  node dist/diagnose.js --bot-id=<id>   or   node dist/_score-change-test.js --bot-id=<id>');
}

main();
