"use strict";
// src/discord/commands.ts
//
// Slash command definitions and registration.
//
// Slash commands rather than `!`-prefixed ones on purpose: they work in every
// channel without the privileged Message Content intent, which a prefix parser
// would need before it could read a single message. The aliases the community
// asked for (`ih`, `medals`) are registered as their own commands, because
// Discord has no notion of an alias.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMANDS = void 0;
exports.registerCommands = registerCommands;
const discord_js_1 = require("discord.js");
const logger_1 = require("../logger");
exports.COMMANDS = [
    new discord_js_1.SlashCommandBuilder().setName('inhouse').setDescription('Otwórz nowe lobby inhouse'),
    new discord_js_1.SlashCommandBuilder().setName('ih').setDescription('Otwórz nowe lobby inhouse (skrót)'),
    new discord_js_1.SlashCommandBuilder().setName('link').setDescription('Połącz swoje konto Steam'),
    new discord_js_1.SlashCommandBuilder().setName('unlink').setDescription('Odłącz wszystkie swoje konta Steam'),
    new discord_js_1.SlashCommandBuilder().setName('ranking').setDescription('Top 10 graczy i gracz tygodnia'),
    new discord_js_1.SlashCommandBuilder().setName('medale').setDescription('Pokaż swoje medale'),
    new discord_js_1.SlashCommandBuilder().setName('medals').setDescription('Pokaż swoje medale (skrót)'),
    new discord_js_1.SlashCommandBuilder()
        .setName('poster')
        .setDescription('Wyślij ponownie wiadomość powitalną bota')
        .setDefaultMemberPermissions(0), // admins only — hidden for everyone else
].map((c) => c.toJSON());
/**
 * Register against a single guild.
 *
 * Guild-scoped rather than global on purpose: guild commands propagate
 * instantly, whereas global ones can take an hour, which makes iterating on the
 * command surface miserable.
 */
async function registerCommands(token, clientId, guildId) {
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    try {
        await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guildId), { body: exports.COMMANDS });
        logger_1.logger.info(`[Discord] Registered ${exports.COMMANDS.length} slash command(s) for guild ${guildId}`);
    }
    catch (error) {
        logger_1.logger.error('[Discord] Failed to register slash commands', error);
    }
}
