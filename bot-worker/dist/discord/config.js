"use strict";
// src/discord/config.ts
//
// Everything the Discord gateway needs, read once at boot.
//
// Missing configuration disables the gateway rather than crashing the process:
// the Conductor forks this alongside the lobby runners, and a server without
// Discord set up must still run tournaments and inhouses exactly as before.
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadGatewayConfig = loadGatewayConfig;
const logger_1 = require("../logger");
function loadGatewayConfig() {
    const token = process.env.DISCORD_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const channelId = process.env.INHOUSE_DISCORD_CHANNEL_ID;
    const siteSecret = process.env.INHOUSE_BOT_WEBHOOK_SECRET;
    const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://dota2inhouse.pl')
        .replace(/\/+$/, '');
    const missing = [
        !token && 'DISCORD_TOKEN',
        !guildId && 'DISCORD_GUILD_ID',
        !channelId && 'INHOUSE_DISCORD_CHANNEL_ID',
        !siteSecret && 'INHOUSE_BOT_WEBHOOK_SECRET',
    ].filter(Boolean);
    if (missing.length) {
        logger_1.logger.warn(`[Discord] Gateway disabled — missing ${missing.join(', ')}. ` +
            `Lobby runners are unaffected.`);
        return null;
    }
    return {
        token: token,
        guildId: guildId,
        channelId: channelId,
        siteUrl,
        siteSecret: siteSecret,
    };
}
