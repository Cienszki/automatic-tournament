"use strict";
// bot-worker/src/index.ts
// Main entry point for the Dota 2 Lobby Bot Worker process
//
// This process:
// 1. Reads its bot account credentials from Firestore
// 2. Connects to Steam + Dota 2
// 3. Polls a Firestore command queue for work
// 4. Emits events back to Firestore for the orchestrator
// 5. Sends periodic heartbeats
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const firebase_js_1 = require("./firebase.js");
const dota_client_js_1 = require("./dota-client.js");
const command_handler_js_1 = require("./command-handler.js");
const event_emitter_js_1 = require("./event-emitter.js");
const logger_js_1 = require("./logger.js");
async function main() {
    const botAccountId = process.argv.find((a) => a.startsWith('--bot-id='))?.split('=')[1] ||
        process.env.BOT_ACCOUNT_ID;
    if (!botAccountId) {
        logger_js_1.logger.error('No bot account ID provided. Use --bot-id=<id> or set BOT_ACCOUNT_ID env var.');
        process.exit(1);
    }
    logger_js_1.logger.info(`Starting bot worker for account: ${botAccountId}`);
    // Initialize Firestore
    const db = (0, firebase_js_1.initFirebase)();
    // Fetch bot account credentials from Firestore
    const botDoc = await db.collection('botAccounts').doc(botAccountId).get();
    if (!botDoc.exists) {
        logger_js_1.logger.error(`Bot account ${botAccountId} not found in Firestore`);
        process.exit(1);
    }
    const botData = botDoc.data();
    if (!botData.enabled) {
        logger_js_1.logger.error(`Bot account ${botAccountId} is disabled`);
        process.exit(1);
    }
    // Decrypt password (simple base64 for now — use proper encryption in production)
    const password = Buffer.from(botData.encryptedPassword, 'base64').toString('utf-8');
    // Override with env vars if provided (useful for local dev)
    const username = process.env.STEAM_USERNAME || botData.username;
    const steamPassword = process.env.STEAM_PASSWORD || password;
    const sharedSecret = process.env.STEAM_GUARD_SHARED_SECRET || botData.steamGuardSharedSecret;
    logger_js_1.logger.info(`Connecting as: ${username} (display: ${botData.displayName})`);
    // Create Dota 2 client
    const dotaClient = new dota_client_js_1.DotaClient({
        username,
        password: steamPassword,
        steamGuardSharedSecret: sharedSecret,
    });
    // Connect to Steam + Dota 2
    try {
        await dotaClient.connect();
        logger_js_1.logger.info('Connected to Steam and Dota 2 GC');
    }
    catch (error) {
        logger_js_1.logger.error('Failed to connect', error);
        await db.collection('botAccounts').doc(botAccountId).update({
            status: 'error',
            lastHeartbeat: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        process.exit(1);
    }
    // Update status to idle (ready for assignment)
    await db.collection('botAccounts').doc(botAccountId).update({
        status: 'idle',
        lastHeartbeat: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    // Initialize command handler and event bridge
    const pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);
    const heartbeatInterval = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10);
    const commandHandler = new command_handler_js_1.CommandHandler(db, botAccountId, dotaClient, pollInterval);
    const eventBridge = new event_emitter_js_1.EventBridge(db, botAccountId, dotaClient, heartbeatInterval);
    // Start processing
    commandHandler.start();
    eventBridge.start();
    logger_js_1.logger.info('Bot worker is running and waiting for commands...');
    // Graceful shutdown
    const shutdown = async (signal) => {
        logger_js_1.logger.info(`Received ${signal}, shutting down gracefully...`);
        commandHandler.stop();
        eventBridge.stop();
        try {
            await dotaClient.disconnect();
        }
        catch {
            // Ignore disconnect errors during shutdown
        }
        await db.collection('botAccounts').doc(botAccountId).update({
            status: 'offline',
            currentMatchId: null,
            currentTournamentId: null,
            lastHeartbeat: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        logger_js_1.logger.info('Shutdown complete');
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', async (error) => {
        logger_js_1.logger.error('Uncaught exception', error);
        await db.collection('botAccounts').doc(botAccountId).update({
            status: 'error',
            lastHeartbeat: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        process.exit(1);
    });
}
main().catch((error) => {
    logger_js_1.logger.error('Fatal error in main', error);
    process.exit(1);
});
