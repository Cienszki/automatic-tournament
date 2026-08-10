"use strict";
// src/inhouse/chat-commands.ts
//
// Ported from dota2-lobby-bot/src/inhouse/chat-commands.ts, trimmed to the M1
// tier only: !status, !start, !cancel, !help. Everything else
// (!publish/!settings/!lock/!host/!mode/!region/!delay, !link/!unlink/!stats/
// !report, !kick/!ban, the fun commands) is out of scope until M2/M4 — see
// the plan's milestone table. `!start` is the load-bearing one: there is
// deliberately no web "start game" button anywhere in the product, so this
// is the only way any inhouse game ever launches.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyCommandRouter = void 0;
exports.formatStatus = formatStatus;
exports.formatCountdown = formatCountdown;
const logger_1 = require("../logger");
const LOBBY_CAPACITY = 10;
/** Per-Steam-ID token bucket — prevents one player spamming the router or flooding the GC. */
class RateLimiter {
    maxPerWindow;
    windowMs;
    buckets = new Map();
    constructor(maxPerWindow, windowMs) {
        this.maxPerWindow = maxPerWindow;
        this.windowMs = windowMs;
    }
    allow(key) {
        const nowMs = Date.now();
        const recent = (this.buckets.get(key) ?? []).filter((t) => nowMs - t < this.windowMs);
        if (recent.length >= this.maxPerWindow) {
            this.buckets.set(key, recent);
            return false;
        }
        recent.push(nowMs);
        this.buckets.set(key, recent);
        return true;
    }
}
class LobbyCommandRouter {
    store;
    hooks;
    limiter = new RateLimiter(6, 60_000);
    commands = new Map();
    constructor(store, hooks) {
        this.store = store;
        this.hooks = hooks;
        this.register();
    }
    /** Returns true when the message was a command the router consumed. */
    async handle(game, steamId32, playerName, message) {
        const trimmed = message.trim();
        if (!trimmed.startsWith('!'))
            return false;
        const [word, ...args] = trimmed.slice(1).split(/\s+/);
        const key = word.toLowerCase();
        const spec = this.commands.get(key);
        if (!spec)
            return false;
        const rest = trimmed.slice(1 + word.length).trim();
        const ctx = { game, steamId32, playerName, args, rest };
        if (!(await this.permitted(spec.tier, ctx))) {
            if (spec.tier === 'initiator')
                await this.hooks.reply(`Only the host can use !${key}.`);
            return true;
        }
        if (!this.limiter.allow(steamId32)) {
            logger_1.logger.debug(`[InhouseRunner] Rate-limited !${key} from ${steamId32}`);
            return true;
        }
        try {
            await spec.handler(ctx);
        }
        catch (error) {
            logger_1.logger.error(`[InhouseRunner] Command !${key} from ${steamId32} failed`, error);
            await this.hooks.reply(`!${key} failed — try again in a moment.`).catch(() => undefined);
        }
        return true;
    }
    async permitted(tier, ctx) {
        if (tier === 'everyone')
            return true;
        if (await this.hooks.isAdmin(ctx.steamId32))
            return true;
        if (tier === 'admin')
            return false;
        return ctx.game.initiatorSteamId32 === ctx.steamId32;
    }
    add(name, spec) {
        this.commands.set(name, spec);
    }
    register() {
        this.add('status', { tier: 'everyone', handler: (c) => this.status(c) });
        this.add('start', { tier: 'everyone', handler: (c) => this.start(c) });
        this.add('cancel', { tier: 'everyone', handler: (c) => this.cancel(c) });
        this.add('help', { tier: 'everyone', handler: (c) => this.help(c) });
    }
    async status(ctx) {
        const slots = await this.store.getSlots(ctx.game.id);
        await this.hooks.reply(formatStatus(slots, ctx.game));
    }
    async start(ctx) {
        // `!start force` is admin-only, for 5v4 tests and salvaging a night one player short.
        const wantsForce = ctx.args[0]?.toLowerCase() === 'force';
        if (wantsForce && !(await this.hooks.isAdmin(ctx.steamId32))) {
            await this.hooks.reply('Only admins can force a start.');
            return;
        }
        if (this.hooks.countdownRunning()) {
            await this.hooks.reply('Already starting — !cancel to abort.');
            return;
        }
        const slots = await this.store.getSlots(ctx.game.id);
        if (!wantsForce) {
            // Whoever's present and ready can call it — reservations don't count,
            // a reservation is not a player.
            if (!slots.ready) {
                const missing = LOBBY_CAPACITY - slots.inLobby.length;
                await this.hooks.reply(`Need ${missing} more in the lobby before !start.`);
                return;
            }
            if (!slots.inLobby.includes(ctx.steamId32)) {
                await this.hooks.reply('Join the lobby first, then !start.');
                return;
            }
        }
        // Players seat themselves — the bot has no fairness rating and no
        // opinion about who should play with whom.
        const balanced = slots.radiant.length === 5 && slots.dire.length === 5;
        if (!wantsForce && !balanced) {
            await this.hooks.reply(`Teams are ${slots.radiant.length}-${slots.dire.length} ` +
                `(${slots.unassigned.length} unassigned). Pick your sides, then !start.`);
            return;
        }
        await this.hooks.startCountdown({ force: wantsForce, byName: ctx.playerName });
    }
    async cancel(ctx) {
        const stopped = this.hooks.cancelCountdown();
        if (stopped)
            await this.hooks.reply(`Start aborted by ${ctx.playerName}.`);
    }
    async help(ctx) {
        await this.hooks.reply('!status !start !cancel !help');
    }
}
exports.LobbyCommandRouter = LobbyCommandRouter;
/** `!status` output: `8/10 — need 2. 1 slot reserved (2:14 left).` */
function formatStatus(slots, game) {
    const present = slots.inLobby.length;
    if (present >= LOBBY_CAPACITY) {
        const seating = slots.radiant.length === 5 && slots.dire.length === 5
            ? 'teams are set — !start'
            : `teams ${slots.radiant.length}-${slots.dire.length} — pick your sides`;
        return `${present}/${LOBBY_CAPACITY} — ${seating}`;
    }
    const parts = [`${present}/${LOBBY_CAPACITY} — need ${LOBBY_CAPACITY - present}.`];
    if (slots.pendingReservations.length) {
        const soonest = slots.pendingReservations
            .map((r) => Date.parse(r.expiresAt) - Date.now())
            .sort((a, b) => a - b)[0];
        parts.push(`${slots.pendingReservations.length} reserved (${formatCountdown(soonest)} left).`);
    }
    if (game.locked)
        parts.push('Lobby is locked.');
    if (!game.published)
        parts.push('Not published — !publish to open it up.');
    return parts.join(' ');
}
function formatCountdown(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
