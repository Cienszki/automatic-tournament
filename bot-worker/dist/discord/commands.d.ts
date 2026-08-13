export declare const COMMANDS: import("discord.js").RESTPostAPIChatInputApplicationCommandsJSONBody[];
/**
 * Register against a single guild.
 *
 * Guild-scoped rather than global on purpose: guild commands propagate
 * instantly, whereas global ones can take an hour, which makes iterating on the
 * command surface miserable.
 */
export declare function registerCommands(token: string, clientId: string, guildId: string): Promise<void>;
