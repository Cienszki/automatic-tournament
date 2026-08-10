"use strict";
// src/inhouse/ban-guard.ts
//
// Ported near-verbatim from dota2-lobby-bot/src/inhouse/ban-guard.ts. Only
// the import path changed (@dota2inhouse/core → ./core, the vendored copy).
//
// Enforcement point #4: the Dota lobby itself. A ban is enforced at multiple
// independent points because any single one is bypassable — this module owns
// the one that works against someone handed the lobby password directly, and
// the only one that works at all for a player who never linked Discord.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BanGuard = void 0;
const logger_1 = require("../logger");
/**
 * Checks arriving players against the ban index and kicks the banned ones.
 *
 * Results are cached per lobby session: a banned player who keeps rejoining
 * would otherwise generate one Firestore read per attempt, and a determined
 * griefer can rejoin fast. The cache is per-instance and cleared between
 * sessions, so an admin's unban takes effect on the next lobby at the latest —
 * and immediately for anyone not already cached.
 */
class BanGuard {
    store;
    hooks;
    cache = new Map();
    static CACHE_TTL_MS = 60_000;
    constructor(store, hooks) {
        this.store = store;
        this.hooks = hooks;
    }
    /** Drop cached decisions. Call when a session ends or an unban is broadcast. */
    reset() {
        this.cache.clear();
    }
    /** Forget one player, so an unban applies without waiting for the TTL. */
    forget(steamId32) {
        this.cache.delete(steamId32);
    }
    /**
     * Returns true when the player was banned and has been kicked.
     *
     * Fails **open** on a Firestore error: a transient outage should not turn
     * every arriving player into a kick. The other enforcement points still
     * apply, and the error is logged loudly.
     */
    async enforce(steamId32, playerName) {
        let status;
        const cached = this.cache.get(steamId32);
        if (cached && Date.now() - cached.at < BanGuard.CACHE_TTL_MS) {
            status = cached;
        }
        else {
            try {
                const discordId = (await this.store.findPlayerBySteamId(steamId32))?.discordId ?? null;
                status = await this.store.checkBan({ steamId32, discordId });
            }
            catch (error) {
                logger_1.logger.error(`[InhouseRunner] Ban check failed for ${steamId32} — failing open, player NOT kicked`, error);
                return false;
            }
            this.cache.set(steamId32, { ...status, at: Date.now() });
        }
        if (!status.banned)
            return false;
        const label = playerName ?? steamId32;
        logger_1.logger.warn(`[InhouseRunner] Banned player ${label} (${steamId32}) joined — kicking`);
        try {
            await this.hooks.kick(steamId32);
        }
        catch (error) {
            logger_1.logger.error(`[InhouseRunner] Failed to kick banned player ${steamId32}`, error);
        }
        // Deliberately terse and non-specific. A moderation trail in a public
        // lobby is its own kind of drama — the record lives on the website.
        if (this.hooks.announce) {
            try {
                await this.hooks.announce(`${label} is not able to join inhouses right now.`);
            }
            catch {
                // Announcement is cosmetic; the kick already happened.
            }
        }
        if (this.hooks.report) {
            try {
                await this.hooks.report({
                    steamId32,
                    moderationId: status.record?.id ?? null,
                    reason: status.record?.reason ?? 'banned',
                });
            }
            catch {
                // Reporting is best-effort.
            }
        }
        return true;
    }
}
exports.BanGuard = BanGuard;
