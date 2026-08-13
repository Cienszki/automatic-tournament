"use strict";
// src/discord/site.ts
//
// The website's bot API, as a typed client.
//
// Every action a button performs — opening a lobby, joining one, linking a
// Steam account — is an HTTP call to the site rather than a Firestore write
// made here. That is the whole design: the open-lobby cap, the lobby-name
// table, the reservation transaction, the waitlist and the Steam invite are
// implemented once, on the website, and Discord is a second face on the same
// code. A gateway that wrote Firestore directly would be a second
// implementation of rules that are already subtle, and it would drift.
//
// See the website's src/app/api/inhouse/bot/* for the other end.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteClient = void 0;
const logger_1 = require("../logger");
const REQUEST_TIMEOUT_MS = 15_000;
class SiteClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async call(path, init) {
        const url = `${this.config.siteUrl}${path}`;
        try {
            const response = await fetch(url, {
                ...init,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.config.siteSecret}`,
                    ...(init.headers ?? {}),
                },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (!response.ok) {
                logger_1.logger.error(`[Discord] ${init.method ?? 'GET'} ${path} → ${response.status}`);
                return null;
            }
            return (await response.json());
        }
        catch (error) {
            logger_1.logger.error(`[Discord] ${init.method ?? 'GET'} ${path} failed`, error);
            return null;
        }
    }
    async openLobby(opts) {
        const result = await this.call('/api/inhouse/bot/lobby', {
            method: 'POST',
            body: JSON.stringify({ ...opts, newcomerFriendly: false }),
        });
        return result ?? { status: 'error' };
    }
    async joinInfo(gameId, discordId, discordName) {
        const params = new URLSearchParams({ gameId, discordId });
        if (discordName)
            params.set('discordName', discordName);
        const result = await this.call(`/api/inhouse/bot/join?${params}`, { method: 'GET' });
        return result ?? { status: 'unavailable' };
    }
    async join(gameId, discordId, discordName) {
        const result = await this.call('/api/inhouse/bot/join', {
            method: 'POST',
            body: JSON.stringify({ gameId, discordId, discordName }),
        });
        return result ?? { status: 'error' };
    }
    async link(discordId, discordName, steam) {
        const result = await this.call('/api/inhouse/bot/identity', {
            method: 'POST',
            body: JSON.stringify({ action: 'link', discordId, discordName, steam }),
        });
        return result ?? { status: 'error' };
    }
    async unlink(discordId) {
        return this.call('/api/inhouse/bot/identity', {
            method: 'POST',
            body: JSON.stringify({ action: 'unlink', discordId }),
        });
    }
    async identity(discordId) {
        return this.call(`/api/inhouse/bot/identity?discordId=${encodeURIComponent(discordId)}`, { method: 'GET' });
    }
    async ranking() {
        return this.call('/api/inhouse/bot/stats?view=ranking', { method: 'GET' });
    }
    async medals(discordId) {
        return this.call(`/api/inhouse/bot/stats?view=medals&discordId=${encodeURIComponent(discordId)}`, { method: 'GET' });
    }
}
exports.SiteClient = SiteClient;
