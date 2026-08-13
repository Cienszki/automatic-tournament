// src/discord/poster.ts
//
// The channel's one permanent message: what this is, and the three buttons.
//
// Its id is remembered in Firestore (`inhouseConfig/discord`) rather than found
// by scanning the channel, because the scan gets less reliable exactly as the
// channel gets busier — which is when a duplicate poster is most annoying. It
// is also pinned, so it stays reachable once lobby cards push it up.

import { ChannelType, type Client, type TextChannel } from 'discord.js';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logger';
import { posterComponents, posterEmbed } from './render';
import type { GatewayConfig } from './config';

const CONFIG_DOC = 'inhouseConfig/discord';

export async function ensurePoster(
  db: Firestore,
  client: Client,
  config: GatewayConfig
): Promise<void> {
  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    logger.error(
      `[Discord] INHOUSE_DISCORD_CHANNEL_ID (${config.channelId}) is not a text channel I can see — ` +
        `no poster and no lobby cards. Check the id and that the bot can view the channel.`
    );
    return;
  }
  const text = channel as TextChannel;
  const ref = db.doc(CONFIG_DOC);

  const embeds = [posterEmbed()];
  const components = posterComponents(config.siteUrl);

  // Adopt the existing poster where there is one. Editing keeps the same
  // message — and therefore its pin and its place in the channel — across
  // every redeploy and every copy change.
  try {
    const snap = await ref.get();
    const known = snap.data() as { posterMessageId?: string; posterChannelId?: string } | undefined;

    if (known?.posterMessageId && known.posterChannelId === text.id) {
      const existing = await text.messages.fetch(known.posterMessageId).catch(() => null);
      if (existing) {
        await existing.edit({ embeds, components });
        logger.info('[Discord] Poster is in place');
        return;
      }
      logger.warn('[Discord] The remembered poster is gone — posting a new one');
    }
  } catch (error) {
    logger.warn('[Discord] Could not read the remembered poster id', error);
  }

  const sent = await text.send({ embeds, components });
  await sent.pin().catch(() => logger.warn('[Discord] Could not pin the poster (missing permission?)'));

  try {
    await ref.set({ posterMessageId: sent.id, posterChannelId: text.id }, { merge: true });
  } catch (error) {
    logger.error('[Discord] Could not remember the poster id — a restart may post a second one', error);
  }
  logger.info('[Discord] Posted the channel poster');
}
