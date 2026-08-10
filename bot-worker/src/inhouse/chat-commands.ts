// src/inhouse/chat-commands.ts
//
// Ported from dota2-lobby-bot/src/inhouse/chat-commands.ts, trimmed to the M1
// tier only: !status, !start, !cancel, !help. Everything else
// (!publish/!settings/!lock/!host/!mode/!region/!delay, !link/!unlink/!stats/
// !report, !kick/!ban, the fun commands) is out of scope until M2/M4 — see
// the plan's milestone table. `!start` is the load-bearing one: there is
// deliberately no web "start game" button anywhere in the product, so this
// is the only way any inhouse game ever launches.

import { InhouseStore } from './core/store';
import type { InhouseGame, SlotCounts } from './core/types';
import { logger } from '../logger';

const LOBBY_CAPACITY = 10;

export interface CommandContext {
  game: InhouseGame;
  steamId32: string;
  playerName: string;
  args: string[];
  rest: string;
}

export interface CommandHooks {
  reply: (message: string) => Promise<void>;
  /** Begin the abortable pre-launch countdown. */
  startCountdown: (opts: { force: boolean; byName: string }) => Promise<void>;
  /** Abort a running countdown. Returns false when nothing was running. */
  cancelCountdown: () => boolean;
  countdownRunning: () => boolean;
  isAdmin: (steamId32: string) => Promise<boolean>;
}

type Handler = (ctx: CommandContext) => Promise<void>;

interface CommandSpec {
  /** everyone | initiator | admin — only 'everyone' commands are wired in the M1 subset. */
  tier: 'everyone' | 'initiator' | 'admin';
  handler: Handler;
}

/** Per-Steam-ID token bucket — prevents one player spamming the router or flooding the GC. */
class RateLimiter {
  private buckets = new Map<string, number[]>();
  constructor(
    private maxPerWindow: number,
    private windowMs: number
  ) {}

  allow(key: string): boolean {
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

export class LobbyCommandRouter {
  private limiter = new RateLimiter(6, 60_000);
  private commands = new Map<string, CommandSpec>();

  constructor(
    private store: InhouseStore,
    private hooks: CommandHooks
  ) {
    this.register();
  }

  /** Returns true when the message was a command the router consumed. */
  async handle(game: InhouseGame, steamId32: string, playerName: string, message: string): Promise<boolean> {
    const trimmed = message.trim();
    if (!trimmed.startsWith('!')) return false;

    const [word, ...args] = trimmed.slice(1).split(/\s+/);
    const key = word.toLowerCase();
    const spec = this.commands.get(key);
    if (!spec) return false;

    const rest = trimmed.slice(1 + word.length).trim();
    const ctx: CommandContext = { game, steamId32, playerName, args, rest };

    if (!(await this.permitted(spec.tier, ctx))) {
      if (spec.tier === 'initiator') await this.hooks.reply(`Only the host can use !${key}.`);
      return true;
    }

    if (!this.limiter.allow(steamId32)) {
      logger.debug(`[InhouseRunner] Rate-limited !${key} from ${steamId32}`);
      return true;
    }

    try {
      await spec.handler(ctx);
    } catch (error) {
      logger.error(`[InhouseRunner] Command !${key} from ${steamId32} failed`, error);
      await this.hooks.reply(`!${key} failed — try again in a moment.`).catch(() => undefined);
    }
    return true;
  }

  private async permitted(tier: CommandSpec['tier'], ctx: CommandContext): Promise<boolean> {
    if (tier === 'everyone') return true;
    if (await this.hooks.isAdmin(ctx.steamId32)) return true;
    if (tier === 'admin') return false;
    return ctx.game.initiatorSteamId32 === ctx.steamId32;
  }

  private add(name: string, spec: CommandSpec): void {
    this.commands.set(name, spec);
  }

  private register(): void {
    this.add('status', { tier: 'everyone', handler: (c) => this.status(c) });
    this.add('start', { tier: 'everyone', handler: (c) => this.start(c) });
    this.add('cancel', { tier: 'everyone', handler: (c) => this.cancel(c) });
    this.add('help', { tier: 'everyone', handler: (c) => this.help(c) });
  }

  private async status(ctx: CommandContext): Promise<void> {
    const slots = await this.store.getSlots(ctx.game.id);
    await this.hooks.reply(formatStatus(slots, ctx.game));
  }

  private async start(ctx: CommandContext): Promise<void> {
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
      await this.hooks.reply(
        `Teams are ${slots.radiant.length}-${slots.dire.length} ` +
          `(${slots.unassigned.length} unassigned). Pick your sides, then !start.`
      );
      return;
    }

    await this.hooks.startCountdown({ force: wantsForce, byName: ctx.playerName });
  }

  private async cancel(ctx: CommandContext): Promise<void> {
    const stopped = this.hooks.cancelCountdown();
    if (stopped) await this.hooks.reply(`Start aborted by ${ctx.playerName}.`);
  }

  private async help(ctx: CommandContext): Promise<void> {
    await this.hooks.reply('!status !start !cancel !help');
  }
}

/** `!status` output: `8/10 — need 2. 1 slot reserved (2:14 left).` */
export function formatStatus(slots: SlotCounts, game: InhouseGame): string {
  const present = slots.inLobby.length;

  if (present >= LOBBY_CAPACITY) {
    const seating =
      slots.radiant.length === 5 && slots.dire.length === 5
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
  if (game.locked) parts.push('Lobby is locked.');
  if (!game.published) parts.push('Not published — !publish to open it up.');

  return parts.join(' ');
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
