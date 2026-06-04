"use strict";
// bot-worker/src/manager.ts
// Bot Manager — runs as a single long-lived daemon.
//
// Responsibilities:
// 1. On startup: spawn one worker child process per enabled bot account in Firestore
// 2. Watch Firestore `botAccounts` for changes:
//    - Account enabled  → spawn a new worker for it
//    - Account disabled → kill its worker
//    - New account added (enabled) → spawn worker
// 3. Auto-restart workers that crash (with exponential backoff, max 5 retries/hour)
// 4. Graceful shutdown: stop all workers when SIGINT/SIGTERM received
//
// Usage:
//   node dist/manager.js          (production)
//   tsx src/manager.ts            (dev)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const firebase_js_1 = require("./firebase.js");
const logger_js_1 = require("./logger.js");
// Detect whether we're running compiled JS (dist/) or source via tsx (src/)
const runningAsBuilt = __filename.endsWith('.js');
const workerDir = path_1.default.dirname(__filename); // dist/ or src/
const botWorkerRoot = path_1.default.resolve(workerDir, '..');
const WORKER_SCRIPT = path_1.default.resolve(workerDir, 'index' + (runningAsBuilt ? '.js' : '.ts'));
// Resolve local tsx binary so child spawns work even without a global tsx install
const tsxBin = path_1.default.resolve(botWorkerRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const NODE_CMD = runningAsBuilt ? process.execPath : tsxBin;
const workers = new Map();
let shuttingDown = false;
// ─── Spawn a worker for a bot account ────────────────────────────────────────
function spawnWorker(botId) {
    if (shuttingDown)
        return;
    const existing = workers.get(botId);
    if (existing?.process && existing.process.exitCode === null) {
        logger_js_1.logger.info(`[Manager] Worker for ${botId} already running (PID ${existing.process.pid})`);
        return;
    }
    logger_js_1.logger.info(`[Manager] Spawning worker for bot account: ${botId}`);
    const state = workers.get(botId) ?? {
        process: null,
        botId,
        restartCount: 0,
        lastRestartAt: 0,
        stopping: false,
    };
    const child = (0, child_process_1.spawn)(NODE_CMD, [WORKER_SCRIPT, `--bot-id=${botId}`], {
        stdio: 'inherit',
        env: { ...process.env },
        // Pass same working dir so .env is found
        cwd: botWorkerRoot,
        // On Windows, .cmd shims must be launched through the shell
        shell: process.platform === 'win32' && !runningAsBuilt,
    });
    state.process = child;
    state.stopping = false;
    workers.set(botId, state);
    child.on('error', (err) => {
        logger_js_1.logger.error(`[Manager] Worker process error for ${botId}:`, err);
    });
    child.on('exit', (code, signal) => {
        if (shuttingDown || state.stopping) {
            logger_js_1.logger.info(`[Manager] Worker ${botId} exited (expected): code=${code} signal=${signal}`);
            workers.delete(botId);
            return;
        }
        logger_js_1.logger.warn(`[Manager] Worker ${botId} exited unexpectedly: code=${code} signal=${signal}`);
        // Reset restart count if last crash was more than 1 hour ago
        const now = Date.now();
        if (now - state.lastRestartAt > 60 * 60 * 1000) {
            state.restartCount = 0;
        }
        const MAX_RESTARTS = 5;
        if (state.restartCount >= MAX_RESTARTS) {
            // After exhausting fast retries, schedule a long cooldown retry instead of giving up.
            // This recovers from transient issues like Steam RateLimitExceeded.
            const cooldownMs = 60 * 60 * 1000; // 1 hour
            logger_js_1.logger.error(`[Manager] Worker ${botId} has crashed ${MAX_RESTARTS} times in the last hour. Scheduling cooldown retry in ${cooldownMs / 60000} min...`);
            state.restartCount = 0;
            state.lastRestartAt = 0;
            state.process = null;
            setTimeout(() => spawnWorker(botId), cooldownMs);
            return;
        }
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        const backoffMs = Math.min(2000 * Math.pow(2, state.restartCount), 32000);
        state.restartCount += 1;
        state.lastRestartAt = now;
        state.process = null;
        logger_js_1.logger.info(`[Manager] Restarting worker ${botId} in ${backoffMs / 1000}s (attempt ${state.restartCount}/${MAX_RESTARTS})...`);
        setTimeout(() => spawnWorker(botId), backoffMs);
    });
}
// ─── Stop a worker for a bot account ─────────────────────────────────────────
function stopWorker(botId) {
    const state = workers.get(botId);
    if (!state?.process || state.process.exitCode !== null) {
        workers.delete(botId);
        return;
    }
    logger_js_1.logger.info(`[Manager] Stopping worker for bot account: ${botId}`);
    state.stopping = true;
    state.process.kill('SIGTERM');
    // Force-kill after 10 seconds if it hasn't exited
    setTimeout(() => {
        if (state.process && state.process.exitCode === null) {
            logger_js_1.logger.warn(`[Manager] Force-killing worker ${botId} after timeout`);
            state.process.kill('SIGKILL');
        }
    }, 10000);
}
// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    logger_js_1.logger.info('[Manager] Bot manager starting...');
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        logger_js_1.logger.error('[Manager] FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
        process.exit(1);
    }
    const db = (0, firebase_js_1.initFirebase)();
    // Fetch all currently enabled accounts and spawn workers
    const snapshot = await db
        .collection('botAccounts')
        .where('enabled', '==', true)
        .get();
    if (snapshot.empty) {
        logger_js_1.logger.info('[Manager] No enabled bot accounts found. Watching for changes...');
    }
    else {
        for (const doc of snapshot.docs) {
            spawnWorker(doc.id);
        }
        logger_js_1.logger.info(`[Manager] Spawned ${snapshot.size} worker(s)`);
    }
    // Watch for changes to botAccounts
    db.collection('botAccounts').onSnapshot((snapshot) => {
        for (const change of snapshot.docChanges()) {
            const id = change.doc.id;
            const data = change.doc.data();
            if (change.type === 'added' || change.type === 'modified') {
                if (data.enabled) {
                    const existing = workers.get(id);
                    if (!existing?.process || existing.process.exitCode !== null) {
                        logger_js_1.logger.info(`[Manager] Bot account ${id} is enabled — spawning worker`);
                        spawnWorker(id);
                    }
                }
                else {
                    // Account disabled — stop its worker if running
                    if (workers.has(id)) {
                        logger_js_1.logger.info(`[Manager] Bot account ${id} disabled — stopping worker`);
                        stopWorker(id);
                    }
                }
            }
            if (change.type === 'removed') {
                if (workers.has(id)) {
                    logger_js_1.logger.info(`[Manager] Bot account ${id} removed — stopping worker`);
                    stopWorker(id);
                }
            }
        }
    }, (err) => {
        logger_js_1.logger.error('[Manager] Firestore watch error:', err);
    });
    logger_js_1.logger.info('[Manager] Watching Firestore botAccounts for changes. Running...');
    // ─── Graceful shutdown ──────────────────────────────────────────────────────
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        logger_js_1.logger.info(`[Manager] Received ${signal} — shutting down all workers...`);
        const stopPromises = [...workers.keys()].map((id) => new Promise((resolve) => {
            const state = workers.get(id);
            if (!state?.process || state.process.exitCode !== null) {
                resolve();
                return;
            }
            state.stopping = true;
            state.process.on('exit', () => resolve());
            state.process.kill('SIGTERM');
            // Force after 10s
            setTimeout(() => {
                if (state.process && state.process.exitCode === null) {
                    state.process.kill('SIGKILL');
                }
                resolve();
            }, 10000);
        }));
        await Promise.all(stopPromises);
        logger_js_1.logger.info('[Manager] All workers stopped. Goodbye.');
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
main().catch((err) => {
    logger_js_1.logger.error('[Manager] Fatal error:', err);
    process.exit(1);
});
