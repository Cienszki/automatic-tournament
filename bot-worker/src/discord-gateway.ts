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

import dotenv from 'dotenv';

dotenv.config();

import { Client, Events, GatewayIntentBits } from 'discord.js';
import { initFirebase } from './firebase';
import { logger } from './logger';
import { loadGatewayConfig } from './discord/config';
import { SiteClient } from './discord/site';
import { InteractionRouter } from './discord/interactions';
import { LobbyBoard } from './discord/board';
import { ensurePoster } from './discord/poster';
import { registerCommands } from './discord/commands';

async function main(): Promise<number> {
  const config = loadGatewayConfig();
  if (!config) return 0; // not configured — nothing to run, and not an error

  const db = initFirebase();
  const site = new SiteClient(config);

  // Guilds only. Reading messages would need the privileged Message Content
  // intent, and members are fetched over REST where they are actually needed —
  // so this asks for the least Discord will give.
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  const router = new InteractionRouter(site, config);
  const board = new LobbyBoard(db, client, config);

  client.on(Events.InteractionCreate, (interaction) => void router.handle(interaction));
  client.on(Events.Error, (error) => logger.error('[Discord] Client error', error));
  client.on(Events.Warn, (message) => logger.warn(`[Discord] ${message}`));

  client.once(Events.ClientReady, (ready) => {
    void (async () => {
      logger.info(`[Discord] Logged in as ${ready.user.tag}`);
      // The application id comes from the session rather than from another env
      // var to get wrong.
      await registerCommands(config.token, ready.application.id, config.guildId);
      await ensurePoster(db, client, config);
      await board.start();
      logger.info('[Discord] Gateway is running');
    })().catch((error) => logger.error('[Discord] Startup failed', error));
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[Discord] ${signal} — shutting down`);
    board.stop();
    try {
      await client.destroy();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('[Discord] Unhandled rejection', reason));

  await client.login(config.token);
  return new Promise<number>(() => {
    /* runs until a signal arrives */
  });
}

main()
  .then((code) => {
    if (code === 0) process.exit(0);
  })
  .catch((error) => {
    logger.error('[Discord] Fatal error', error);
    process.exit(1);
  });
