"use strict";
// bot-worker/dist/conductor.js
// Conductor — the thin, always-on supervisor of the meepow-style rebuild.
//
// Replaces the old manager.js (which kept one persistent worker per account) AND the
// bot-spawning steps of the Next.js orchestrate cron (schedule + assign + drive + events).
//
// Responsibilities (and NOTHING else — it never touches lobby events):
//   1. SCHEDULE  — watch bot-enabled tournaments; create one botLobbySessions doc per
//                  match entering the pre-warm window (scheduling.js).
//   2. ASSIGN    — claim an idle bot account (respecting a post-use cooldown) for each
//                  pending session; mark it bot_assigned.
//   3. SPAWN     — fork ONE Lobby Runner per active session that has an account but no
//                  live child. Covers both fresh assignments and rediscovery on restart.
//   4. SUPERVISE — on a runner exit: clean (session terminal) → release the account with
//                  a cooldown; crash (session still active) → respawn (the runner reattaches
//                  to its live lobby from the GC cache).
//   5. PENDING TIMEOUT — cancel sessions that never got an account in time.
//
// The result-sync path (botSyncTasks → OpenDota import → standings) stays in the Next.js
// app; the Runner writes botSyncTasks on game-end and the existing executor consumes them.

const path = require('path');
const { fork } = require('child_process');
const dotenv = require('dotenv');
dotenv.config();
const { initFirebase } = require('./firebase.js');
const { logger } = require('./logger.js');
const { scheduleUpcomingMatches } = require('./scheduling.js');

const RUNNER_SCRIPT = path.resolve(__dirname, 'runner.js');
const TERMINAL_STATES = ['completed', 'cancelled', 'error'];
const ACTIVE_STATES = ['bot_assigned', 'lobby_creating', 'lobby_open', 'ready_check', 'requirements_met', 'coin_toss', 'in_game', 'post_game', 'syncing'];

const WORK_TICK_MS = 20000;       // assign + spawn + pending-timeout
const SCHEDULE_TICK_MS = 60000;   // scan tournaments + create sessions
const ACCOUNT_COOLDOWN_MS = 2 * 60 * 1000; // space out lobby creates per account (Valve throttles)
const MAX_RESPAWNS = 5;           // crash respawns before giving up on a session
const RESPAWN_RESET_MS = 60 * 60 * 1000;

// Result-sync trigger: the post-match OpenDota import + standings recalc lives in the
// Next.js app (forceImportGameAdmin), so the Conductor drains botSyncTasks by POSTing to
// the web app's sync-only /orchestrate endpoint on a timer — replacing Cloud Scheduler.
// GATED: stays OFF unless BOTH env vars are set, so we never trigger the (still-deployed)
// OLD full /orchestrate before the slimmed version is live (it would fight the Conductor).
const SYNC_TICK_MS = 5 * 60 * 1000;
const WEB_SYNC_URL = process.env.WEB_SYNC_URL || '';     // e.g. https://<app>/api/admin/bot/orchestrate
const CRON_SECRET = process.env.CRON_SECRET || '';

function nowIso() { return new Date().toISOString(); }

/** sessionId → supervised runner state */
const runners = new Map();
let shuttingDown = false;
let db;

// ─── Per-tournament bot config cache (for pending timeouts) ──────────────────
const configCache = new Map(); // tournamentId → { cfg, at }
async function getBotConfig(tournamentId) {
    const cached = configCache.get(tournamentId);
    if (cached && Date.now() - cached.at < 60000) return cached.cfg;
    let cfg = null;
    try {
        const doc = await db.collection('tournaments').doc(tournamentId).collection('config').doc('bot').get();
        cfg = doc.exists ? doc.data() : null;
    } catch { /* ignore */ }
    configCache.set(tournamentId, { cfg, at: Date.now() });
    return cfg;
}

// ─── 1. SCHEDULE ─────────────────────────────────────────────────────────────
async function scheduleLoop() {
    if (shuttingDown) return;
    try {
        const tournaments = await db.collection('tournaments').get();
        for (const doc of tournaments.docs) {
            const cfg = await getBotConfig(doc.id);
            if (!cfg?.enabled) continue;
            try {
                await scheduleUpcomingMatches(db, doc.id, cfg, doc.data());
            } catch (e) {
                logger.error(`[Conductor] scheduleUpcomingMatches failed for ${doc.id}`, e);
            }
        }
    } catch (e) {
        logger.error('[Conductor] schedule loop error', e);
    }
}

// ─── Result-sync trigger (replaces Cloud Scheduler) ──────────────────────────
async function syncLoop() {
    if (shuttingDown || !WEB_SYNC_URL || !CRON_SECRET) return;
    try {
        const res = await fetch(WEB_SYNC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CRON_SECRET}` },
            body: '{}',
        });
        const text = await res.text();
        if (!res.ok) {
            logger.warn(`[Conductor] sync trigger HTTP ${res.status}: ${text.slice(0, 200)}`);
            return;
        }
        let executed; try { executed = JSON.parse(text).syncTasksExecuted; } catch { /* ignore */ }
        if (executed) logger.info(`[Conductor] sync trigger ok — ${executed} task(s) executed`);
    } catch (e) {
        logger.warn('[Conductor] sync trigger failed', e);
    }
}

// ─── 2. ASSIGN ───────────────────────────────────────────────────────────────
async function assignPendingSessions() {
    const pendingSnap = await db.collection('botLobbySessions')
        .where('state', '==', 'pending').orderBy('createdAt', 'asc').get();
    if (pendingSnap.empty) return;

    // Available accounts: enabled + idle + not in cooldown + not already driving a runner.
    const acctSnap = await db.collection('botAccounts')
        .where('enabled', '==', true).where('status', '==', 'idle').get();
    const busy = new Set([...runners.values()].map((r) => r.botAccountId));
    const ts = Date.now();
    const available = acctSnap.docs.filter((d) => {
        const a = d.data();
        if (busy.has(d.id)) return false;
        if (a.cooldownUntil && new Date(a.cooldownUntil).getTime() > ts) return false;
        return true;
    });

    if (available.length === 0) {
        if (!pendingSnap.empty) logger.warn(`[Conductor] ${pendingSnap.size} pending session(s) but no available bot accounts`);
        return;
    }

    let i = 0;
    for (const sessionDoc of pendingSnap.docs) {
        if (i >= available.length) break;
        const session = sessionDoc.data();
        const cfg = await getBotConfig(session.tournamentId);
        if (!cfg?.enabled) continue;

        const botDoc = available[i++];
        try {
            await db.collection('botAccounts').doc(botDoc.id).update({
                status: 'starting', busyWithSessionId: sessionDoc.id, currentSessionId: sessionDoc.id,
                currentMatchId: session.matchId, currentTournamentId: session.tournamentId, updatedAt: nowIso(),
            });
            await sessionDoc.ref.update({ state: 'bot_assigned', botAccountId: botDoc.id, updatedAt: nowIso() });
            logger.info(`[Conductor] Assigned bot ${botDoc.data().displayName || botDoc.id} to session ${sessionDoc.id} (match ${session.matchId})`);
        } catch (e) {
            logger.error(`[Conductor] Failed to assign bot ${botDoc.id} to session ${sessionDoc.id}`, e);
            i--; // let this account be retried next round
        }
    }
}

// ─── 3. SPAWN / rediscover ───────────────────────────────────────────────────
// ensureRunners is the SINGLE place that spawns runners — both for fresh assignments and
// for respawning after a crash (gated by `notBefore`). onRunnerExit never spawns directly;
// it only records a backoff. This prevents the double-spawn storm where a setTimeout respawn
// and this tick both launched a runner for the same bot, causing LogonSessionReplaced churn.
async function ensureRunners() {
    const snap = await db.collection('botLobbySessions').where('state', 'in', ACTIVE_STATES).get();
    const now = Date.now();
    for (const doc of snap.docs) {
        const session = doc.data();
        if (!session.botAccountId) continue;
        const existing = runners.get(doc.id);
        if (existing) {
            if (existing.child && existing.child.exitCode === null) continue; // already running
            if (existing.notBefore && now < existing.notBefore) continue;     // in crash backoff
        }
        spawnRunner(doc.id, session.botAccountId);
    }
}

function spawnRunner(sessionId, botAccountId) {
    if (shuttingDown) return;
    const state = runners.get(sessionId) ?? { child: null, botAccountId, restartCount: 0, lastStart: 0, stopping: false, notBefore: 0 };
    // Hard guard: never launch a second runner while one is alive (a bot can host only one
    // session — a duplicate login triggers LogonSessionReplaced and crash-loops both).
    if (state.child && state.child.exitCode === null) return;
    state.botAccountId = botAccountId;
    state.lastStart = Date.now();
    state.notBefore = 0;
    runners.set(sessionId, state);

    logger.info(`[Conductor] Spawning runner for session ${sessionId} (bot ${botAccountId})`);
    const child = fork(RUNNER_SCRIPT, [`--session-id=${sessionId}`, `--bot-id=${botAccountId}`], {
        env: { ...process.env },
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
    });
    state.child = child;

    child.on('error', (err) => logger.error(`[Conductor] Runner process error for session ${sessionId}`, err));
    child.on('exit', (code, signal) => onRunnerExit(sessionId, code, signal).catch((e) => logger.error('[Conductor] onRunnerExit', e)));
}

async function onRunnerExit(sessionId, code, signal) {
    const state = runners.get(sessionId);
    if (!state) return;
    state.child = null;

    if (shuttingDown || state.stopping) {
        runners.delete(sessionId);
        return;
    }

    // Re-read the session: terminal → clean finish, else → crash (respawn).
    let session = null;
    try { const d = await db.collection('botLobbySessions').doc(sessionId).get(); session = d.exists ? d.data() : null; }
    catch (e) { logger.error('[Conductor] failed to read session on exit', e); }

    if (!session || TERMINAL_STATES.includes(session.state)) {
        logger.info(`[Conductor] Runner for session ${sessionId} exited cleanly (state=${session?.state ?? 'gone'}, code=${code})`);
        await releaseAccount(state.botAccountId);
        runners.delete(sessionId);
        return;
    }

    // Crash mid-match. Respawn so the runner reattaches to its live lobby.
    if (Date.now() - state.lastStart > RESPAWN_RESET_MS) state.restartCount = 0;
    if (state.restartCount >= MAX_RESPAWNS) {
        logger.error(`[Conductor] Runner for session ${sessionId} crashed ${MAX_RESPAWNS}× — marking session error`);
        try {
            await db.collection('botLobbySessions').doc(sessionId).update({
                state: 'error',
                error: { message: `Runner crashed ${MAX_RESPAWNS} times`, code: 'RUNNER_CRASH_LOOP', timestamp: nowIso() },
                updatedAt: nowIso(),
            });
        } catch { /* ignore */ }
        await releaseAccount(state.botAccountId);
        runners.delete(sessionId);
        return;
    }
    // Schedule a backoff; ensureRunners (the single spawner) will respawn after notBefore.
    const backoffMs = Math.min(2000 * Math.pow(2, state.restartCount), 32000);
    state.restartCount += 1;
    state.notBefore = Date.now() + backoffMs;
    logger.warn(`[Conductor] Runner for session ${sessionId} crashed (code=${code} signal=${signal}) — will respawn after ~${Math.round(backoffMs / 1000)}s (attempt ${state.restartCount}/${MAX_RESPAWNS})`);
}

async function releaseAccount(botAccountId) {
    if (!botAccountId) return;
    try {
        await db.collection('botAccounts').doc(botAccountId).update({
            status: 'idle', busyWithSessionId: null, currentSessionId: null,
            currentMatchId: null, currentTournamentId: null,
            cooldownUntil: new Date(Date.now() + ACCOUNT_COOLDOWN_MS).toISOString(),
            updatedAt: nowIso(),
        });
        logger.info(`[Conductor] Released bot ${botAccountId} (cooldown ${ACCOUNT_COOLDOWN_MS / 60000}min)`);
    } catch (e) { logger.error('[Conductor] failed to release account', e); }
}

// ─── 5. PENDING TIMEOUT ──────────────────────────────────────────────────────
async function cancelStuckPending() {
    const snap = await db.collection('botLobbySessions').where('state', '==', 'pending').get();
    const ts = Date.now();
    for (const doc of snap.docs) {
        const session = doc.data();
        const cfg = await getBotConfig(session.tournamentId);
        const timeoutMin = cfg?.pendingSessionTimeoutMinutes ?? 20;
        const elapsedMin = (ts - new Date(session.createdAt).getTime()) / 60000;
        if (elapsedMin >= timeoutMin) {
            try {
                await doc.ref.update({
                    state: 'cancelled',
                    cancelReason: `No bot was available for ${Math.round(elapsedMin)} minutes`,
                    completedAt: nowIso(), updatedAt: nowIso(),
                });
                logger.warn(`[Conductor] Cancelled stuck-pending session ${doc.id} (no bot for ${Math.round(elapsedMin)}min)`);
            } catch { /* ignore */ }
        }
    }
}

// ─── Loops ───────────────────────────────────────────────────────────────────
let workTickRunning = false;
async function workTick() {
    if (shuttingDown || workTickRunning) return; // never overlap (avoids racing spawns)
    workTickRunning = true;
    try {
        await assignPendingSessions();
        await ensureRunners();
        await cancelStuckPending();
    } catch (e) {
        logger.error('[Conductor] work tick error', e);
    } finally {
        workTickRunning = false;
    }
}

async function main() {
    logger.info('[Conductor] Starting...');
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        logger.error('[Conductor] FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
        process.exit(1);
    }
    db = initFirebase();

    // The first workTick rediscovers active sessions and respawns their runners (which
    // reattach to live lobbies from the GC cache). Routed through workTick so the overlap
    // guard applies and we never double-spawn during startup.
    setInterval(() => void workTick(), WORK_TICK_MS);
    setInterval(() => void scheduleLoop(), SCHEDULE_TICK_MS);
    void scheduleLoop();
    void workTick();

    if (WEB_SYNC_URL && CRON_SECRET) {
        setInterval(() => void syncLoop(), SYNC_TICK_MS);
        void syncLoop();
        logger.info(`[Conductor] Result-sync trigger enabled → ${WEB_SYNC_URL} every ${SYNC_TICK_MS / 60000}min`);
    } else {
        logger.info('[Conductor] Result-sync trigger DISABLED (set WEB_SYNC_URL + CRON_SECRET to enable)');
    }

    logger.info('[Conductor] Running. Watching for sessions to schedule, assign, and supervise.');

    const shutdown = (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info(`[Conductor] Received ${signal} — leaving runners to finish/reattach and exiting`);
        // Runners are forked children; SIGTERM propagates to them. They disconnect cleanly
        // WITHOUT marking their sessions terminal, so on the next Conductor start they are
        // rediscovered and respawned (reattaching to their live lobbies).
        for (const state of runners.values()) {
            state.stopping = true;
            if (state.child && state.child.exitCode === null) state.child.kill('SIGTERM');
        }
        setTimeout(() => process.exit(0), 5000);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => { logger.error('[Conductor] Fatal error', err); process.exit(1); });
