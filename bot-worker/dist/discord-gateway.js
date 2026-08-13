"use strict";
// src/discord-gateway.ts
//
// Entry point for the Discord gateway.
//
// ONE process, forked and supervised by the Conductor exactly like a lobby
// runner (see inhouse/conductor-hook.ts). One is not a detail: every gateway
// connection receives every interaction, so a second process would answer the
// same button press twice.
//
// It never talks to Steam and never writes game state. Buttons call the
// website's endpoints; cards are rendered from what the workers write to
// Firestore. That is what lets this be restarted at any moment — mid-lobby,
// mid-match — without anything being lost.
//
//   node dist/discord-gateway.js
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const discord_js_1 = require("discord.js");
const firebase_1 = require("./firebase");
const logger_1 = require("./logger");
const config_1 = require("./discord/config");
const site_1 = require("./discord/site");
const interactions_1 = require("./discord/interactions");
const board_1 = require("./discord/board");
const poster_1 = require("./discord/poster");
const commands_1 = require("./discord/commands");
async function main() {
    const config = (0, config_1.loadGatewayConfig)();
    if (!config)
        return 0; // not configured — nothing to run, and not an error
    const db = (0, firebase_1.initFirebase)();
    const site = new site_1.SiteClient(config);
    // Guilds only. Reading messages would need the privileged Message Content
    // intent, and members are fetched over REST where they are actually needed —
    // so this asks for the least Discord will give.
    const client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds] });
    const router = new interactions_1.InteractionRouter(site, config);
    const board = new board_1.LobbyBoard(db, client, config);
    client.on(discord_js_1.Events.InteractionCreate, (interaction) => void router.handle(interaction));
    client.on(discord_js_1.Events.Error, (error) => logger_1.logger.error('[Discord] Client error', error));
    client.on(discord_js_1.Events.Warn, (message) => logger_1.logger.warn(`[Discord] ${message}`));
    client.once(discord_js_1.Events.ClientReady, (ready) => {
        void (async () => {
            logger_1.logger.info(`[Discord] Logged in as ${ready.user.tag}`);
            // The application id comes from the session rather than from another env
            // var to get wrong.
            await (0, commands_1.registerCommands)(config.token, ready.application.id, config.guildId);
            await (0, poster_1.ensurePoster)(db, client, config);
            await board.start();
            logger_1.logger.info('[Discord] Gateway is running');
        })().catch((error) => logger_1.logger.error('[Discord] Startup failed', error));
    });
    const shutdown = async (signal) => {
        logger_1.logger.info(`[Discord] ${signal} — shutting down`);
        board.stop();
        try {
            await client.destroy();
        }
        catch {
            /* ignore */
        }
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => logger_1.logger.error('[Discord] Unhandled rejection', reason));
    await client.login(config.token);
    return new Promise(() => {
        /* runs until a signal arrives */
    });
}
main()
    .then((code) => {
    if (code === 0)
        process.exit(0);
})
    .catch((error) => {
    logger_1.logger.error('[Discord] Fatal error', error);
    process.exit(1);
});
