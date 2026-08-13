// src/discord/commands.ts
//
// Slash command definitions and registration.
//
// Slash commands rather than `!`-prefixed ones on purpose: they work in every
// channel without the privileged Message Content intent, which a prefix parser
// would need before it could read a single message. The aliases the community
// asked for (`ih`, `medals`) are registered as their own commands, because
// Discord has no notion of an alias.

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { logger } from '../logger';

export const COMMANDS = [
  new SlashCommandBuilder().setName('inhouse').setDescription('Otwórz nowe lobby inhouse'),
  new SlashCommandBuilder().setName('ih').setDescription('Otwórz nowe lobby inhouse (skrót)'),
  new SlashCommandBuilder().setName('link').setDescription('Połącz swoje konto Steam'),
  new SlashCommandBuilder().setName('unlink').setDescription('Odłącz wszystkie swoje konta Steam'),
  new SlashCommandBuilder().setName('ranking').setDescription('Top 10 graczy i gracz tygodnia'),
  new SlashCommandBuilder().setName('medale').setDescription('Pokaż swoje medale'),
  new SlashCommandBuilder().setName('medals').setDescription('Pokaż swoje medale (skrót)'),
  new SlashCommandBuilder()
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
export async function registerCommands(token: string, clientId: string, guildId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: COMMANDS });
    logger.info(`[Discord] Registered ${COMMANDS.length} slash command(s) for guild ${guildId}`);
  } catch (error) {
    logger.error('[Discord] Failed to register slash commands', error);
  }
}
