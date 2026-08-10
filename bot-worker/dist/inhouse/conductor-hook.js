"use strict";
// src/inhouse/conductor-hook.ts
//
// Lets the Conductor supervise Inhouse Runners the same way it already
// supervises tournament ones — so pressing "Otwórz lobby" on the website
// actually opens a lobby, instead of leaving a game stuck in `lobby_creating`
// forever waiting for a process nobody started.
//
// Deliberately self-contained. conductor.js has no TypeScript source (see
// src/inhouse/core/VENDORED.md), so every edit there is a hand-verified patch
// to compiled output; keeping all the real logic here means that patch is four
// additive lines rather than a rewrite of a file running live tournaments.
//
// The shapes below intentionally mirror conductor.js's own `runners` Map,
// spawnRunner and onRunnerExit — same state object, same crash backoff, same
// "one live child per key" guard, same "re-read the doc to tell a clean finish
// from a crash" decision. Two runner kinds, one supervision model.
//
// Scheduling has no analogue here and must not grow one: tournament sessions
// are created by the Conductor from a pre-warm window, whereas an inhouse game
// is created by the website the instant a human presses a button, with the
// account already leased. The Conductor's only job for inhouses is to notice a
// game that holds an account and has no runner, and fork one.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnInhouseRunnersTick = spawnInhouseRunnersTick;
exports.stopInhouseRunners = stopInhouseRunners;
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const logger_1 = require("../logger");
const types_1 = require("./core/types");
const lease_1 = require("./core/lease");
const INHOUSE_RUNNER_SCRIPT = path_1.default.resolve(__dirname, '..', 'inhouse-runner.js');
/** Matches conductor.js's own crash policy so both runner kinds behave alike. */
const MAX_RESPAWNS = 5;
const RESPAWN_RESET_MS = 60 * 60 * 1000;
/**
 * Fork a runner for every game that holds an account and has no live child.
 *
 * This is both the normal spawn path and the crash-respawn/cold-start
 * rediscovery path, exactly as `ensureRunners` is for tournaments: after a
 * Conductor redeploy this re-finds every live inhouse and restarts its runner,
 * which reattaches to the lobby from the GC cache rather than opening a second
 * one.
 *
 * Crash bookkeeping (restartCount, notBefore) lives only in this Map, never on
 * the game document. The website holds an onSnapshot listener on inhouseGames
 * and fans changes out to browsers over SSE, so persisting backoff counters
 * would push a pointless frame to every connected viewer on every failed
 * attempt. conductor.js keeps tournament backoff in memory for the same
 * reason, and accepts the same limitation: counters reset on redeploy.
 */
async function spawnInhouseRunnersTick(db, runners, isShuttingDown) {
    if (isShuttingDown())
        return;
    let games;
    try {
        const snap = await db
            .collection('inhouseGames')
            .where('state', 'in', types_1.ACCOUNT_HOLDING_STATES)
            .get();
        games = snap.docs.map((d) => d.data());
    }
    catch (error) {
        logger_1.logger.error('[Conductor] Failed to scan inhouseGames for runners', error);
        return;
    }
    const now = Date.now();
    // Accounts already driven by a live child, across ALL games. The contended
    // resource is the Steam account, not the game: a per-game guard alone lets
    // two games that name the same botAccountId each spawn a runner, and the
    // second login triggers LogonSessionReplaced — Steam kicks the first, the
    // first reconnects and kicks the second, and both crash-loop until something
    // gives up. leaseAccount is supposed to make that impossible, but a game
    // left non-terminal with a stale botAccountId (a session ended without the
    // website transitioning it) is enough to reintroduce it, and the cost is too
    // high to rely on an invariant held in another codebase.
    const busyAccounts = new Set();
    for (const [, s] of runners) {
        if (s.child && s.child.exitCode === null)
            busyAccounts.add(s.botAccountId);
    }
    // Oldest first, so when two games do contend for one account the one that
    // has been waiting longest wins rather than whichever Firestore returned first.
    const ordered = [...games].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    for (const game of ordered) {
        // No account yet means the website's lease failed and it already moved the
        // game to `failed`; nothing to run and nothing to fix from here.
        if (!game.botAccountId)
            continue;
        // The match already happened. `in_progress` is deliberately NOT terminal on
        // the website's side — its ingest cron treats it as a played state and only
        // moves the game to `finished` once OpenDota serves the match, which can
        // take minutes. Without this check the Conductor sees a non-terminal,
        // account-holding game the instant the runner exits and starts a fresh
        // runner, which finds no lobby in the GC cache and opens a BRAND NEW lobby
        // for a game that is already over — re-leasing an account for it too.
        // A dotaMatchId is the unambiguous marker that a lobby is no longer wanted.
        if (game.dotaMatchId)
            continue;
        const existing = runners.get(game.id);
        if (existing) {
            if (existing.child && existing.child.exitCode === null)
                continue; // already running
            if (existing.notBefore && now < existing.notBefore)
                continue; // in crash backoff
        }
        if (busyAccounts.has(game.botAccountId)) {
            logger_1.logger.warn(`[Conductor] Game ${game.id} names bot ${game.botAccountId}, which is already hosting ` +
                `another inhouse — not spawning a second runner on it (would replace the Steam session)`);
            continue;
        }
        spawnInhouseRunner(db, runners, game.id, game.botAccountId, isShuttingDown);
        busyAccounts.add(game.botAccountId);
    }
}
function spawnInhouseRunner(db, runners, gameId, botAccountId, isShuttingDown) {
    if (isShuttingDown())
        return;
    const state = runners.get(gameId) ?? {
        child: null,
        botAccountId,
        restartCount: 0,
        lastStart: 0,
        stopping: false,
        notBefore: 0,
    };
    // A Steam account can host exactly one lobby, and a duplicate login triggers
    // LogonSessionReplaced — which crash-loops both processes. Same hard guard
    // conductor.js uses before forking a tournament runner.
    if (state.child && state.child.exitCode === null)
        return;
    state.botAccountId = botAccountId;
    state.lastStart = Date.now();
    state.notBefore = 0;
    runners.set(gameId, state);
    logger_1.logger.info(`[Conductor] Spawning inhouse runner for game ${gameId} (bot ${botAccountId})`);
    const child = (0, child_process_1.fork)(INHOUSE_RUNNER_SCRIPT, [`--game-id=${gameId}`, `--bot-id=${botAccountId}`], {
        env: { ...process.env },
        cwd: path_1.default.resolve(__dirname, '..', '..'),
        stdio: 'inherit',
    });
    state.child = child;
    child.on('error', (err) => logger_1.logger.error(`[Conductor] Inhouse runner process error for game ${gameId}`, err));
    child.on('exit', (code, signal) => {
        void onInhouseRunnerExit(db, runners, gameId, code, signal, isShuttingDown).catch((e) => logger_1.logger.error('[Conductor] onInhouseRunnerExit', e));
    });
}
/**
 * Decide whether an exit was a finish or a crash, by re-reading the game.
 *
 * A terminal state means the runner did its job and already released the
 * account — releasing again is harmless and covers the case where it died
 * before it could. A non-terminal state means the lobby is still live and the
 * process died under it, so respawn: the new runner reattaches to the existing
 * GC lobby rather than creating a second one.
 */
async function onInhouseRunnerExit(db, runners, gameId, code, signal, isShuttingDown) {
    const state = runners.get(gameId);
    if (!state)
        return;
    state.child = null;
    if (isShuttingDown() || state.stopping) {
        runners.delete(gameId);
        return;
    }
    let game = null;
    try {
        const snap = await db.collection('inhouseGames').doc(gameId).get();
        game = snap.exists ? snap.data() : null;
    }
    catch (error) {
        logger_1.logger.error('[Conductor] Failed to read inhouse game on runner exit', error);
    }
    if (!game || (0, types_1.isTerminal)(game.state)) {
        logger_1.logger.info(`[Conductor] Inhouse runner for game ${gameId} exited cleanly ` +
            `(state=${game?.state ?? 'gone'}, code=${code})`);
        await (0, lease_1.releaseAccount)(db, state.botAccountId);
        runners.delete(gameId);
        return;
    }
    // The game was handed to a different account while this runner was dying —
    // don't respawn on ours, the next tick picks it up under the new one.
    if (game.botAccountId && game.botAccountId !== state.botAccountId) {
        logger_1.logger.info(`[Conductor] Game ${gameId} moved to bot ${game.botAccountId} — not respawning ${state.botAccountId}`);
        runners.delete(gameId);
        return;
    }
    if (Date.now() - state.lastStart > RESPAWN_RESET_MS)
        state.restartCount = 0;
    if (state.restartCount >= MAX_RESPAWNS) {
        logger_1.logger.error(`[Conductor] Inhouse runner for game ${gameId} crashed ${MAX_RESPAWNS}× — marking failed`);
        try {
            await db.collection('inhouseGames').doc(gameId).update({
                state: 'failed',
                endedAt: new Date().toISOString(),
                endReason: `Runner crashed ${MAX_RESPAWNS} times`,
                updatedAt: new Date().toISOString(),
            });
        }
        catch {
            /* ignore — releasing the account below matters more */
        }
        await (0, lease_1.releaseAccount)(db, state.botAccountId);
        runners.delete(gameId);
        return;
    }
    const backoffMs = Math.min(2000 * Math.pow(2, state.restartCount), 32000);
    state.restartCount += 1;
    state.notBefore = Date.now() + backoffMs;
    logger_1.logger.warn(`[Conductor] Inhouse runner for game ${gameId} crashed (code=${code} signal=${signal}) — ` +
        `respawning in ~${Math.round(backoffMs / 1000)}s (attempt ${state.restartCount}/${MAX_RESPAWNS})`);
}
/** SIGTERM every live inhouse child, so a Conductor redeploy doesn't strand them. */
function stopInhouseRunners(runners) {
    for (const state of runners.values()) {
        state.stopping = true;
        if (state.child && state.child.exitCode === null)
            state.child.kill('SIGTERM');
    }
}
