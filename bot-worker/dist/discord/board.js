"use strict";
// src/discord/board.ts
//
// The live lobby cards: one Discord message per published game, kept in step
// with Firestore for as long as the game is on the board, and deleted when it
// leaves.
//
// Driven by a single `onSnapshot` over the same query the website's live board
// uses, so both surfaces change at the same moment and neither polls. The
// message id lives on the game document (`discord.cardMessageId`), which is
// where the shared data model already reserves space for it — so a gateway
// restart adopts the cards it left behind instead of posting duplicates.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyBoard = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../logger");
const store_1 = require("../inhouse/core/store");
const render_1 = require("./render");
/**
 * States a game is shown for. Identical to the website's BOARD_STATES — a card
 * that vanished between "filling" and "finished" would look like a crash.
 */
const BOARD_STATES = ['lobby_creating', 'open', 'ready', 'in_progress'];
/** How far back to look for cards left behind by games that ended while we were down. */
const STALE_CARD_SCAN_LIMIT = 25;
class LobbyBoard {
    db;
    client;
    config;
    cards = new Map();
    unsubscribe = null;
    store;
    constructor(db, client, config) {
        this.db = db;
        this.client = client;
        this.config = config;
        this.store = new store_1.InhouseStore(db);
    }
    async start() {
        await this.removeStaleCards();
        this.unsubscribe = this.db
            .collection('inhouseGames')
            .where('published', '==', true)
            .where('state', 'in', [...BOARD_STATES])
            .onSnapshot((snap) => {
            for (const change of snap.docChanges()) {
                const game = change.doc.data();
                if (change.type === 'removed') {
                    // The game left the board — finished, cancelled or expired.
                    void this.retire(game);
                }
                else {
                    void this.upsert(game);
                }
            }
        }, (error) => logger_1.logger.error('[Discord] Lobby board listener failed', error));
        logger_1.logger.info('[Discord] Lobby board watching published games');
    }
    stop() {
        if (this.unsubscribe)
            this.unsubscribe();
        this.unsubscribe = null;
    }
    async channel() {
        try {
            const channel = await this.client.channels.fetch(this.config.channelId);
            if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                logger_1.logger.error('[Discord] INHOUSE_DISCORD_CHANNEL_ID is not a text channel');
                return null;
            }
            return channel;
        }
        catch (error) {
            logger_1.logger.error('[Discord] Could not fetch the inhouse channel', error);
            return null;
        }
    }
    /** Post or edit the card for one game. Serialised per game. */
    upsert(game) {
        const state = this.cards.get(game.id) ?? {
            messageId: game.discord?.cardMessageId ?? null,
            fingerprint: '',
            busy: Promise.resolve(),
        };
        this.cards.set(game.id, state);
        state.busy = state.busy
            .then(() => this.render(game, state))
            .catch((error) => logger_1.logger.error(`[Discord] Card render failed for game ${game.id}`, error));
        return state.busy;
    }
    async render(game, state) {
        const channel = await this.channel();
        if (!channel)
            return;
        const model = await this.buildModel(game);
        const embed = (0, render_1.lobbyCardEmbed)(model);
        const components = (0, render_1.lobbyCardComponents)(game);
        // Only the parts a viewer would notice — the game document also carries
        // heartbeat-ish fields that must not cost a Discord edit.
        const fingerprint = JSON.stringify({
            state: game.state,
            name: game.lobbyName,
            host: game.initiatorName,
            seated: model.seated,
            reserved: model.reserved,
            players: model.players,
        });
        if (fingerprint === state.fingerprint && state.messageId)
            return;
        if (state.messageId) {
            try {
                const message = await channel.messages.fetch(state.messageId);
                await message.edit({ embeds: [embed], components });
                state.fingerprint = fingerprint;
                return;
            }
            catch {
                // Deleted by hand, or lost with an old channel — fall through and repost.
                logger_1.logger.warn(`[Discord] Card ${state.messageId} for game ${game.id} is gone — reposting`);
                state.messageId = null;
            }
        }
        const sent = await channel.send({ embeds: [embed], components });
        state.messageId = sent.id;
        state.fingerprint = fingerprint;
        // Persisted so a restart adopts this card rather than posting a second one.
        try {
            await this.store.updateGame(game.id, {
                'discord.cardMessageId': sent.id,
                'discord.cardChannelId': channel.id,
            });
        }
        catch (error) {
            logger_1.logger.error(`[Discord] Could not record the card id for game ${game.id}`, error);
        }
    }
    /** Delete the card for a game that is no longer on the board. */
    async retire(game) {
        const state = this.cards.get(game.id);
        const messageId = state?.messageId ?? game.discord?.cardMessageId ?? null;
        this.cards.delete(game.id);
        if (!messageId)
            return;
        const channel = await this.channel();
        if (!channel)
            return;
        try {
            const message = await channel.messages.fetch(messageId);
            await message.delete();
            logger_1.logger.info(`[Discord] Removed the card for game #${game.gameNumber}`);
        }
        catch {
            // Already gone — nothing to do, and not worth a warning.
        }
        try {
            await this.store.updateGame(game.id, { 'discord.cardMessageId': null });
        }
        catch {
            /* best-effort */
        }
    }
    /**
     * Delete cards for games that ended while the gateway was down.
     *
     * Without this, a restart leaves a "dołącz!" card for a game that finished
     * hours ago — the snapshot only reports what changed while we were listening,
     * and a game that left the query in the meantime is simply absent rather than
     * reported as removed.
     */
    async removeStaleCards() {
        let games;
        try {
            // Ordering by endedAt alone needs no composite index, and live games
            // (endedAt null) sort to the far end of a descending scan.
            const snap = await this.db
                .collection('inhouseGames')
                .orderBy('endedAt', 'desc')
                .limit(STALE_CARD_SCAN_LIMIT)
                .get();
            games = snap.docs.map((d) => d.data());
        }
        catch (error) {
            logger_1.logger.error('[Discord] Could not scan for stale cards', error);
            return;
        }
        const stale = games.filter((g) => g.discord?.cardMessageId && !BOARD_STATES.includes(g.state));
        for (const game of stale)
            await this.retire(game);
        if (stale.length)
            logger_1.logger.info(`[Discord] Cleaned up ${stale.length} stale card(s)`);
    }
    /** Names come from memberships; counts come from the snapshot the worker writes. */
    async buildModel(game) {
        const snapshot = game.slotSnapshot;
        const seated = snapshot?.inLobby.length ?? 0;
        const reserved = snapshot?.reserved.length ?? 0;
        let players = [];
        if (seated > 0) {
            try {
                const members = await this.store.listMemberships(game.id, true);
                const inLobby = new Set(snapshot?.inLobby ?? []);
                players = members
                    .filter((m) => inLobby.has(m.steamId32))
                    .sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt))
                    .map(displayNameFor);
            }
            catch (error) {
                logger_1.logger.warn(`[Discord] Could not read the roster for game ${game.id}`, error);
            }
        }
        return { game, players, seated, reserved };
    }
}
exports.LobbyBoard = LobbyBoard;
/** Server nickname first — it is the name people know each other by. */
function displayNameFor(member) {
    return member.displayName || member.playerName || `Gracz ${member.steamId32}`;
}
