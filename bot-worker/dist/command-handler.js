"use strict";
// bot-worker/src/command-handler.ts
// Processes commands from the Firestore queue and executes them on the Dota 2 client
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandler = void 0;
const logger_js_1 = require("./logger.js");
/**
 * Watches the Firestore command queue for a specific bot account
 * and executes commands on the Dota 2 client.
 */
class CommandHandler {
    db;
    botAccountId;
    dotaClient;
    pollIntervalMs;
    isProcessing = false;
    pollInterval = null;
    /** Commands older than this (ms) are skipped and marked as expired */
    static MAX_COMMAND_AGE_MS = 5 * 60 * 1000; // 5 minutes
    /** Warn if queue has more than this many pending commands */
    static QUEUE_SIZE_WARNING = 20;
    constructor(db, botAccountId, dotaClient, pollIntervalMs = 2000) {
        this.db = db;
        this.botAccountId = botAccountId;
        this.dotaClient = dotaClient;
        this.pollIntervalMs = pollIntervalMs;
    }
    /**
     * Start polling for commands
     */
    start() {
        logger_js_1.logger.info(`CommandHandler: Starting command polling (${this.pollIntervalMs}ms interval)`);
        this.pollInterval = setInterval(() => this.pollAndProcess(), this.pollIntervalMs);
        // Process immediately on start
        this.pollAndProcess();
    }
    /**
     * Stop polling
     */
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        logger_js_1.logger.info('CommandHandler: Stopped');
    }
    /**
     * Poll for pending commands and process them sequentially
     */
    async pollAndProcess() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            const snapshot = await this.db
                .collection('botCommands')
                .doc(this.botAccountId)
                .collection('queue')
                .where('status', '==', 'pending')
                .orderBy('createdAt', 'asc')
                .limit(CommandHandler.QUEUE_SIZE_WARNING + 1)
                .get();
            if (snapshot.size > CommandHandler.QUEUE_SIZE_WARNING) {
                logger_js_1.logger.warn(`Command queue flood detected: ${snapshot.size}+ pending commands for bot ${this.botAccountId}. ` +
                    `Possible abuse or stuck processing.`);
            }
            // Only process up to 5 commands per poll cycle
            const docsToProcess = snapshot.docs.slice(0, 5);
            for (const doc of docsToProcess) {
                const cmdDoc = {
                    id: doc.id,
                    ...doc.data(),
                };
                // Skip commands that are too old (rate limiting / flood protection)
                const commandAge = Date.now() - new Date(cmdDoc.createdAt).getTime();
                if (commandAge > CommandHandler.MAX_COMMAND_AGE_MS) {
                    await doc.ref.update({
                        status: 'failed',
                        processedAt: new Date().toISOString(),
                        error: `Command expired (age: ${Math.round(commandAge / 1000)}s, max: ${CommandHandler.MAX_COMMAND_AGE_MS / 1000}s)`,
                    });
                    logger_js_1.logger.warn(`Skipped expired command ${cmdDoc.command.type}`, {
                        id: doc.id,
                        ageSeconds: Math.round(commandAge / 1000),
                    });
                    continue;
                }
                // Mark as processing
                await doc.ref.update({ status: 'processing' });
                try {
                    const result = await this.executeCommand(cmdDoc.command);
                    await doc.ref.update({
                        status: 'completed',
                        processedAt: new Date().toISOString(),
                        result: result || {},
                    });
                    logger_js_1.logger.info(`Command ${cmdDoc.command.type} completed`, { id: doc.id });
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    await doc.ref.update({
                        status: 'failed',
                        processedAt: new Date().toISOString(),
                        error: errorMsg,
                    });
                    logger_js_1.logger.error(`Command ${cmdDoc.command.type} failed: ${errorMsg}`);
                }
            }
        }
        catch (error) {
            logger_js_1.logger.error('Command polling error', error);
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Execute a single command on the Dota 2 client
     */
    async executeCommand(command) {
        switch (command.type) {
            case 'create_lobby': {
                const settings = command.settings;
                await this.dotaClient.createLobby({
                    name: command.lobbyName,
                    password: command.lobbyPassword,
                    gameMode: settings.gameMode || 2,
                    serverRegion: settings.serverRegion || 8,
                    visibility: settings.visibility || 2,
                    dotaTvDelay: settings.dotaTvDelay || 120,
                    seriesType: settings.seriesType || 0,
                    leagueId: settings.leagueId,
                    cheatsEnabled: settings.cheatsEnabled || false,
                    fillWithBots: settings.fillWithBots || false,
                    allowSpectators: settings.allowSpectators ?? true,
                    pauseSetting: settings.pauseSetting || 1,
                });
                // Emit lobby_created event
                await this.emitEvent({
                    type: 'lobby_created',
                    sessionId: command.sessionId,
                    dotaLobbyId: 'pending', // Will be updated by lobby update event
                    timestamp: new Date().toISOString(),
                });
                return { lobbyCreated: true };
            }
            case 'invite_players': {
                const steamIds = command.steamIds;
                await this.dotaClient.invitePlayers(steamIds);
                return { invited: steamIds.length };
            }
            case 'send_chat': {
                await this.dotaClient.sendChatMessage(command.message);
                return { messageSent: true };
            }
            case 'kick_player': {
                await this.dotaClient.kickPlayer(command.steamId32);
                return { kicked: command.steamId32 };
            }
            case 'start_game': {
                await this.dotaClient.startGame();
                return { gameStarting: true };
            }
            case 'leave_lobby': {
                await this.dotaClient.leaveLobby();
                return { left: true };
            }
            case 'shutdown': {
                logger_js_1.logger.info('Shutdown command received');
                await this.dotaClient.disconnect();
                process.exit(0);
            }
            default:
                logger_js_1.logger.warn(`Unknown command type: ${command.type}`);
                return null;
        }
    }
    /**
     * Write an event document to Firestore for the orchestrator
     */
    async emitEvent(event) {
        await this.db.collection('botEvents').add({
            botAccountId: this.botAccountId,
            event,
            processed: false,
            createdAt: new Date().toISOString(),
        });
    }
}
exports.CommandHandler = CommandHandler;
