"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/inhouse-runner.ts
//
// Entry point for one inhouse lobby, spawned manually for M1 testing:
//   node dist/inhouse-runner.js --game-id=<id> --bot-id=<id>
// M3 wires the Conductor to spawn this the same way it already spawns
// dist/runner.js children for tournament matches.
//
// The visibility proto-patch must run before anything creates a lobby, so it
// is imported first, for-side-effect, exactly like dota-client.js patches
// itself at module-load time rather than lazily.
require("./inhouse/proto-patch");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const firebase_1 = require("./firebase");
const logger_1 = require("./logger");
const runner_1 = require("./inhouse/runner");
function argVal(flag) {
    const a = process.argv.find((x) => x.startsWith(`${flag}=`));
    return a ? a.split('=')[1] : undefined;
}
async function main() {
    const gameId = argVal('--game-id') || process.env.INHOUSE_GAME_ID;
    const botAccountId = argVal('--bot-id') || process.env.BOT_ACCOUNT_ID;
    if (!gameId || !botAccountId) {
        logger_1.logger.error('[InhouseRunner] Usage: node dist/inhouse-runner.js --game-id=<id> --bot-id=<id>');
        process.exit(2);
    }
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        logger_1.logger.error('[InhouseRunner] FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
        process.exit(1);
    }
    const db = (0, firebase_1.initFirebase)();
    const runner = new runner_1.InhouseRunner(db, gameId, botAccountId);
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        logger_1.logger.info(`[InhouseRunner] Received ${signal} — leaving lobby (will reattach on respawn)`);
        // Not marked terminal: a SIGTERM is usually a redeploy/restart, and the
        // lobby may still be filling or the match still live — just disconnect
        // cleanly, same reasoning as dist/runner.js's own shutdown.
        try {
            await runner.shutdown();
        }
        catch {
            /* ignore */
        }
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    try {
        const code = await runner.run();
        process.exit(code || 0);
    }
    catch (err) {
        logger_1.logger.error('[InhouseRunner] Fatal error', err);
        process.exit(1);
    }
}
main();
