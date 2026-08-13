"use strict";
// src/discord/poster.ts
//
// The channel's one permanent message: what this is, and the three buttons.
//
// Its id is remembered in Firestore (`inhouseConfig/discord`) rather than found
// by scanning the channel, because the scan gets less reliable exactly as the
// channel gets busier — which is when a duplicate poster is most annoying. It
// is also pinned, so it stays reachable once lobby cards push it up.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePoster = ensurePoster;
const discord_js_1 = require("discord.js");
const logger_1 = require("../logger");
const render_1 = require("./render");
const CONFIG_DOC = 'inhouseConfig/discord';
async function ensurePoster(db, client, config) {
    const channel = await client.channels.fetch(config.channelId).catch(() => null);
    if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
        logger_1.logger.error(`[Discord] INHOUSE_DISCORD_CHANNEL_ID (${config.channelId}) is not a text channel I can see — ` +
            `no poster and no lobby cards. Check the id and that the bot can view the channel.`);
        return;
    }
    const text = channel;
    const ref = db.doc(CONFIG_DOC);
    const embeds = [(0, render_1.posterEmbed)()];
    const components = (0, render_1.posterComponents)(config.siteUrl);
    // Adopt the existing poster where there is one. Editing keeps the same
    // message — and therefore its pin and its place in the channel — across
    // every redeploy and every copy change.
    try {
        const snap = await ref.get();
        const known = snap.data();
        if (known?.posterMessageId && known.posterChannelId === text.id) {
            const existing = await text.messages.fetch(known.posterMessageId).catch(() => null);
            if (existing) {
                await existing.edit({ embeds, components });
                logger_1.logger.info('[Discord] Poster is in place');
                return;
            }
            logger_1.logger.warn('[Discord] The remembered poster is gone — posting a new one');
        }
    }
    catch (error) {
        logger_1.logger.warn('[Discord] Could not read the remembered poster id', error);
    }
    const sent = await text.send({ embeds, components });
    await sent.pin().catch(() => logger_1.logger.warn('[Discord] Could not pin the poster (missing permission?)'));
    try {
        await ref.set({ posterMessageId: sent.id, posterChannelId: text.id }, { merge: true });
    }
    catch (error) {
        logger_1.logger.error('[Discord] Could not remember the poster id — a restart may post a second one', error);
    }
    logger_1.logger.info('[Discord] Posted the channel poster');
}
