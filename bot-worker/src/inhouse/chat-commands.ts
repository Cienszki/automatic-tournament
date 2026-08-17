// src/inhouse/chat-commands.ts
//
// Ported from dota2-lobby-bot/src/inhouse/chat-commands.ts. `!start` is the
// load-bearing one: there is deliberately no web "start game" button anywhere
// in the product, so this is the only way any inhouse game ever launches.
//
// Two tiers in practice. Everyone gets the ones that only read or that anyone
// present has standing to call (!status, !start, !cancel, !host, !link, !help);
// the host gets the ones that change the lobby under other people (!ap/!cm/!sd/
// !cd, !kick, !slots). Admins pass every host check, which is what makes a
// lobby salvageable when its host has disconnected.
//
// Still out of scope: !publish/!settings/!lock/!region/!delay, !stats/!report,
// !ban, the fun commands.

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
  /** Generate (or re-use) a one-time link code for this Steam ID. */
  issueLinkCode: (steamId32: string, playerName: string) => Promise<string>;
  /**
   * Link this Steam account to whoever answers to `discordQuery` on the guild.
   * Returns the one-line lobby-chat response; resolution and ambiguity handling
   * live in the runner so this router stays testable without a network.
   */
  linkByDiscordName: (
    steamId32: string,
    playerName: string,
    discordQuery: string
  ) => Promise<{ message: string }>;
  /** Report which Discord profile this Steam account belongs to, if any. */
  linkInfo: (steamId32: string, playerName: string) => Promise<{ message: string }>;
  /** Public site URL, used in the `!link` fallback instructions. */
  siteUrl: string;
  /**
   * Everyone the GC currently reports in the lobby, under the names shown in
   * the Dota lobby UI — not the ones we have stored. `!kick` matches on these
   * because they are the only names the person typing can actually see.
   *
   * Async because those names are not free: the lobby member objects the GC
   * sends us carry no name at all (our patched CSODOTALobbyMember has room for
   * id, team and slot and nothing else), so each one is resolved from Steam.
   */
  lobbyPlayers: () => Promise<LobbyMember[]>;
  /** Change the lobby's game mode in place. False when there is no lobby yet. */
  setGameMode: (gameMode: number) => Promise<boolean>;
  /** Remove someone from the lobby entirely. */
  kick: (steamId32: string) => Promise<void>;
  /** Move someone out of their team slot into the unassigned pool. */
  kickFromTeam: (steamId32: string) => Promise<void>;
}

/** A lobby occupant as the GC sees them, which is how the players see them too. */
export interface LobbyMember {
  steamId32: string;
  name: string | null;
  team: 'radiant' | 'dire' | 'spectator' | 'unassigned' | 'broadcaster';
  /** True for the bot's own account — never a kick target. */
  isSelf: boolean;
}

/** The four modes worth a one-word command, in the order !help lists them. */
const MODE_COMMANDS: Array<{ words: string[]; mode: number; label: string }> = [
  { words: ['ap'], mode: 22, label: 'All Pick' },
  { words: ['cm'], mode: 2, label: 'Captains Mode' },
  { words: ['sd'], mode: 4, label: 'Single Draft' },
  { words: ['cd'], mode: 16, label: 'Captains Draft' },
];

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
      // Naming the host matters more than naming the rule: the usual reason
      // this fires is that nobody in the lobby knows who the host is.
      if (spec.tier === 'initiator') {
        await this.hooks.reply(`!${key} może użyć tylko host. ${hostLine(ctx.game)}`);
      }
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
    this.add('link', { tier: 'everyone', handler: (c) => this.link(c) });
    this.add('link-info', { tier: 'everyone', handler: (c) => this.linkInfo(c) });
    this.add('linkinfo', { tier: 'everyone', handler: (c) => this.linkInfo(c) });
    this.add('host', { tier: 'everyone', handler: (c) => this.host(c) });
    this.add('help', { tier: 'everyone', handler: (c) => this.help(c) });

    // Host-only from here down. `initiator` also admits admins (see `permitted`),
    // which is what makes these salvageable when a host disconnects.
    for (const { words, mode, label } of MODE_COMMANDS) {
      for (const word of words) {
        this.add(word, { tier: 'initiator', handler: (c) => this.setMode(c, mode, label) });
      }
    }
    this.add('kick', { tier: 'initiator', handler: (c) => this.kick(c) });
    for (const word of ['slot', 'sloty', 'slots']) {
      this.add(word, { tier: 'initiator', handler: (c) => this.clearSlots(c) });
    }
  }

  /**
   * Who is the host — deliberately open to everyone.
   *
   * Half the host-only commands get typed by someone who isn't the host, and
   * "Only the host can use !kick" is a useless answer if nobody in the lobby
   * knows who that is. This is also what the failed-launch notice points at.
   */
  private async host(ctx: CommandContext): Promise<void> {
    await this.hooks.reply(hostLine(ctx.game));
  }

  /**
   * !ap / !cm / !sd / !cd — swap the mode without remaking the lobby.
   *
   * Refused once the game is locked: the mode is baked in at launch, and
   * changing it under a lobby that is already counting down would either do
   * nothing or produce a game nobody agreed to.
   */
  private async setMode(ctx: CommandContext, mode: number, label: string): Promise<void> {
    if (this.hooks.countdownRunning()) {
      await this.hooks.reply(`Gra już startuje — !cancel, potem zmień tryb.`);
      return;
    }
    if (ctx.game.locked) {
      await this.hooks.reply('Lobby jest zamknięte — za późno na zmianę trybu.');
      return;
    }

    const applied = await this.hooks.setGameMode(mode);
    await this.hooks.reply(
      applied
        ? `Tryb gry: ${label}. Sprawdźcie w ustawieniach lobby.`
        : 'Nie mogę teraz zmienić trybu — lobby jeszcze nie istnieje.'
    );
  }

  /**
   * !kick <fragment nicku> — remove someone from the lobby.
   *
   * Matches on the names the GC reports, because those are the names on screen;
   * the names we have stored may be Discord nicknames the kicker has never seen.
   * A prefix is enough, but it has to be unambiguous — kicking the wrong person
   * out of a ten-person lobby is not something an "I guessed" can undo, so an
   * ambiguous fragment lists the candidates and does nothing.
   */
  private async kick(ctx: CommandContext): Promise<void> {
    const query = ctx.rest.trim();
    if (!query) {
      await this.hooks.reply('Użycie: !kick <fragment nicku>');
      return;
    }

    const match = matchLobbyPlayer(await this.hooks.lobbyPlayers(), query);

    switch (match.status) {
      case 'none':
        await this.hooks.reply(`Nie ma w lobby nikogo pasującego do "${query}".`);
        return;
      case 'ambiguous':
        await this.hooks.reply(
          `"${query}" pasuje do ${match.candidates.length}: ${match.candidates.join(', ')}. Doprecyzuj.`
        );
        return;
      case 'self':
        await this.hooks.reply('Nie wyrzucę bota — to on trzyma lobby.');
        return;
    }

    // Kicking yourself is allowed — a host who wants out of their own lobby is a
    // real thing, and refusing would leave them no way to do it from chat. Only
    // the bot is off limits, and that is handled by the matcher.
    await this.hooks.kick(match.player.steamId32);
    await this.hooks.reply(`${match.player.name ?? match.player.steamId32} wyrzucony z lobby.`);
  }

  /**
   * !slot / !sloty / !slots — empty both team slots in one go.
   *
   * The per-player version of this is a right-click in the lobby UI, which is
   * ten right-clicks when the teams need redoing. Nobody leaves the lobby; they
   * all land in the unassigned pool and re-seat themselves.
   */
  private async clearSlots(ctx: CommandContext): Promise<void> {
    if (this.hooks.countdownRunning()) {
      await this.hooks.reply('Gra już startuje — !cancel, zanim ruszysz slotami.');
      return;
    }

    const seated = (await this.hooks.lobbyPlayers()).filter(
      (p) => !p.isSelf && (p.team === 'radiant' || p.team === 'dire')
    );

    if (!seated.length) {
      await this.hooks.reply('Nikt nie siedzi na slocie Radiant ani Dire.');
      return;
    }

    let moved = 0;
    for (const player of seated) {
      try {
        await this.hooks.kickFromTeam(player.steamId32);
        moved++;
      } catch (error) {
        logger.warn(`[InhouseRunner] !slots could not move ${player.steamId32}`, error);
      }
    }

    await this.hooks.reply(
      moved === seated.length
        ? `Sloty wyczyszczone — ${moved} graczy wróciło do puli. Składy wybierzecie już w grze.`
        : `Zwolniłem ${moved} z ${seated.length} slotów — resztę zrzućcie ręcznie.`
    );
  }

  /**
   * Who is this Steam account linked to?
   *
   * Answers the question that otherwise has no answer from inside Dota: a
   * player has no way to tell whether their account is connected, or which
   * profile is collecting their games. Also the natural way to notice a
   * mislink — since linking takes no confirmation, this is the check that
   * surfaces one.
   */
  private async linkInfo(ctx: CommandContext): Promise<void> {
    const outcome = await this.hooks.linkInfo(ctx.steamId32, ctx.playerName);
    await this.hooks.reply(outcome.message);
  }

  /**
   * Connect a Steam account to a Discord one, from inside the lobby.
   *
   *   !link cienszki   → resolve the name on the guild and link immediately
   *   !link            → fall back to a one-time code typed on the website
   *
   * The named form is the one that matters. Sending a player to a website to
   * log in and type a code has three places to lose them, and they are in Dota
   * precisely because they don't want to be anywhere else. Linking is what
   * unlocks their history — the backfill reports how many past games it found —
   * so the flow has to cost one line of chat.
   *
   * Deliberately NOT a claim-and-confirm handshake: nobody is DM'd to approve.
   * Mislinking costs the mislinker their own stats, which is a price the
   * community owner has explicitly accepted in exchange for the friction.
   * Ambiguity is the real failure, and that IS refused — see the runner.
   */
  private async link(ctx: CommandContext): Promise<void> {
    if (ctx.rest) {
      const outcome = await this.hooks.linkByDiscordName(ctx.steamId32, ctx.playerName, ctx.rest);
      await this.hooks.reply(outcome.message);
      return;
    }

    const code = await this.hooks.issueLinkCode(ctx.steamId32, ctx.playerName);
    const base = this.hooks.siteUrl.replace(/\/+$/, '');
    await this.hooks.reply(
      `${ctx.playerName}: wpisz !link <twój nick z Discorda>, albo wejdź na ${base}/inhouse/link i wpisz kod ${code}`
    );
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

  /**
   * Split by audience rather than alphabetically: lobby chat scrolls, and a
   * flat list of a dozen commands tells nobody which ones they can actually
   * use. Sent as two lines so neither is truncated.
   */
  private async help(ctx: CommandContext): Promise<void> {
    await this.hooks.reply(
      'Wszyscy: !status !start !cancel !host !link !link-info !help'
    );
    await this.hooks.reply(
      `Host (${hostName(ctx.game)}): !ap !cm !sd !cd (tryb gry) · !kick <nick> · !slots (zwolnij sloty)`
    );
  }
}

/** `Host: Kowalski. !host powie to jeszcze raz.` — one line, reused by several commands. */
export function hostLine(game: InhouseGame): string {
  return `Host tego lobby: ${hostName(game)}.`;
}

function hostName(game: InhouseGame): string {
  return game.initiatorName || 'nieznany';
}

export type LobbyMatch =
  | { status: 'ok'; player: LobbyMember }
  | { status: 'none' }
  | { status: 'self' }
  | { status: 'ambiguous'; candidates: string[] };

/**
 * Resolve a typed fragment to exactly one lobby member.
 *
 * Three passes, narrowest first: an exact name wins outright (so someone whose
 * whole name is a prefix of a longer one is still reachable), then prefix, then
 * substring. Anything matching more than one player at the winning precision is
 * refused rather than guessed — see `kick`.
 */
export function matchLobbyPlayer(players: LobbyMember[], query: string): LobbyMatch {
  const needle = query.trim().toLowerCase();
  if (!needle) return { status: 'none' };

  const named = players.filter((p) => (p.name ?? '').trim().length > 0);
  const nameOf = (p: LobbyMember): string => (p.name ?? '').toLowerCase();

  for (const pass of [
    (p: LobbyMember) => nameOf(p) === needle,
    (p: LobbyMember) => nameOf(p).startsWith(needle),
    (p: LobbyMember) => nameOf(p).includes(needle),
  ]) {
    const hits = named.filter(pass);
    if (hits.length === 1) {
      return hits[0].isSelf ? { status: 'self' } : { status: 'ok', player: hits[0] };
    }
    if (hits.length > 1) {
      return { status: 'ambiguous', candidates: hits.map((p) => p.name ?? p.steamId32) };
    }
  }

  // Last resort: the raw Steam id, for a player whose name the GC never sent.
  const byId = players.find((p) => p.steamId32 === needle);
  if (byId) return byId.isSelf ? { status: 'self' } : { status: 'ok', player: byId };

  return { status: 'none' };
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
