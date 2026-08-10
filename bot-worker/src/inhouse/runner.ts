// src/inhouse/runner.ts
//
// One ephemeral process owns ONE inhouse lobby end-to-end, in real time —
// the same meepow-style shape dist/runner.js already uses for tournament
// matches (see bot-worker/REBUILD_PLAN.md), applied to a game with no series,
// no fixed roster, and a completely different Firestore surface
// (inhouseGames, not botLobbySessions).
//
// Spawned manually for M1 testing:
//   node dist/inhouse-runner.js --game-id=<id> --bot-id=<id>
// M3 wires the Conductor to spawn this the same way it already spawns
// dist/runner.js children.
//
// Lifecycle: connect → reattach-or-create (waiting on the `create_inhouse_lobby`
// command already queued by the website) → member sync / host handover / ban
// enforcement, driven by GC events → !start countdown → in_progress → match
// end → website webhook → release the account.
//
// Crash recovery: if this process dies (kill -9, OOM, …) without running
// finishUp(), the account lease is simply never released — on restart with
// the same --game-id/--bot-id, node-dota2 repopulates its lobby cache from
// the GC and reattachOrCreate() reattaches instead of creating a duplicate.
// A graceful SIGTERM/SIGINT disconnects without releasing anything either,
// for the same reason dist/runner.js doesn't: the match may still be live.

import type { Firestore } from 'firebase-admin/firestore';
import { DotaClient } from '../dota-client';
import type { LobbyChatMessage, LobbyUpdateData } from '../dota-client';
import { logger } from '../logger';
import { InhouseStore } from './core/store';
import { renewLease, releaseAccount } from './core/lease';
import { issueLinkCode } from './core/link-codes';
import { backfillOnLink } from './core/attendance';
import { findGuildMember } from './discord-lookup';
import { isTerminal } from './core/types';
import type { GameState, InhouseGame } from './core/types';
import { BanGuard } from './ban-guard';
import { InhouseSessionLogic } from './session-logic';
import { CommandQueue, type InhouseLobbyCommandPayload } from './command-queue';
import { LobbyCommandRouter } from './chat-commands';
import { toInhouseLobbySettings } from './lobby-settings';
import { notifyMatchFinished } from './match-webhook';

// CSODOTALobby.State enum (runner.js's own constant, mirrored here).
const LOBBY_STATE = { UI: 0, SERVERSETUP: 1, RUN: 2, POSTGAME: 3, READYUP: 4, NOTREADY: 5, SERVERASSIGN: 6 };

const HEARTBEAT_MS = 30_000;
/** How long to wait after login for the GC to deliver a cached lobby SObject before deciding "nothing to reattach to". */
const REATTACH_SETTLE_MS = 5_000;
/** How long to wait for the website's create_inhouse_lobby command to show up before giving up — it's written synchronously at game creation, well before this process starts, so this is generous, not tight. */
const CREATE_COMMAND_WAIT_MS = 60_000;
/** How long after a launch to conclude the GC ignored it, so `!start` can be retried. Generous: a real launch reaches RUN within seconds. */
const LAUNCH_WATCHDOG_MS = 90_000;

/** Heartbeats (30s each) the GC may report no lobby before we believe it — see reconcileLobby. */
const LOBBY_MISSES_BEFORE_GONE = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function nowIso(): string {
  return new Date().toISOString();
}

interface BotAccountData {
  username: string;
  encryptedPassword: string;
  steamGuardSharedSecret?: string;
  displayName?: string;
}

export class InhouseRunner {
  private store: InhouseStore;
  private game: InhouseGame | null = null;
  private dota: DotaClient | null = null;
  private sessionLogic: InhouseSessionLogic | null = null;
  private banGuard: BanGuard | null = null;
  private commandQueue: CommandQueue | null = null;
  private router: LobbyCommandRouter | null = null;

  private botSteamId32: string | null = null;
  private lobbyCreated = false;
  /** Tracked ourselves — dota-client.js's 'lobbyCleared' carries no payload, unlike dota2-lobby-bot's own client. */
  private lastKnownMatchId: string | undefined;
  private matchStarted = false;
  private webhookSecret: string | null;
  private siteUrl: string;
  /** Bot token + guild for `!link <name>`. Unset degrades to the code flow. */
  private discordToken: string | null;
  private discordGuildId: string | null;

  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTicks: ReturnType<typeof setTimeout>[] = [];
  private launching = false;
  /** Recovers a launch the GC silently ignored — see armLaunchWatchdog. */
  private launchWatchdog: ReturnType<typeof setTimeout> | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** Consecutive heartbeats where the GC had no lobby for us — see reconcileLobby. */
  private lobbyMisses = 0;
  /** onSnapshot unsubscribe for the game doc — see watchGameDoc. */
  private gameUnsub: (() => void) | null = null;
  private finalizing = false;
  private exitCode = 0;
  private donePromiseResolve: (() => void) | null = null;

  constructor(
    private db: Firestore,
    private gameId: string,
    private botAccountId: string
  ) {
    this.store = new InhouseStore(db);
    this.webhookSecret = process.env.INHOUSE_BOT_WEBHOOK_SECRET || null;
    this.siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://dota2inhouse.pl';
    this.discordToken = process.env.DISCORD_TOKEN || null;
    this.discordGuildId = process.env.DISCORD_GUILD_ID || null;
  }

  // ─── Boot ────────────────────────────────────────────────────────────────

  async run(): Promise<number> {
    const initial = await this.store.getGame(this.gameId);
    if (!initial) {
      logger.error(`[InhouseRunner] Game ${this.gameId} not found — exiting`);
      return 1;
    }
    this.game = initial;
    if (['finished', 'cancelled', 'expired', 'abandoned', 'failed'].includes(this.game.state)) {
      logger.info(`[InhouseRunner] Game ${this.gameId} already ${this.game.state} — nothing to do`);
      return 0;
    }

    const botSnap = await this.db.collection('botAccounts').doc(this.botAccountId).get();
    if (!botSnap.exists) {
      logger.error(`[InhouseRunner] Bot account ${this.botAccountId} not found`);
      return 1;
    }
    const bot = botSnap.data() as BotAccountData;

    const username = process.env.STEAM_USERNAME || bot.username;
    const password =
      process.env.STEAM_PASSWORD ||
      (bot.encryptedPassword ? Buffer.from(bot.encryptedPassword, 'base64').toString('utf-8') : undefined);
    const sharedSecret = process.env.STEAM_GUARD_SHARED_SECRET || bot.steamGuardSharedSecret;
    if (!password) {
      logger.error(`[InhouseRunner] Bot account ${this.botAccountId} has no usable password`);
      return 1;
    }

    logger.info(
      `[InhouseRunner] game=${this.gameId} (#${this.game.gameNumber}) bot=${bot.displayName || username}`
    );

    this.dota = new DotaClient({ username, password, steamGuardSharedSecret: sharedSecret });
    this.wireDotaEvents();

    await this.dota.connect();
    this.botSteamId32 = this.dota.getSelfSteamId32();
    logger.info(`[InhouseRunner] Connected to Steam + Dota 2 GC (self=${this.botSteamId32 || 'unknown'})`);
    if (!this.botSteamId32) {
      logger.error('[InhouseRunner] Could not resolve the bot\'s own Steam32 id — every slot/host calculation depends on excluding it. Exiting.');
      return 1;
    }

    this.banGuard = new BanGuard(this.store, {
      kick: (steamId32) => this.dota!.kickPlayer(steamId32),
      announce: (message) => this.dota!.sendChatMessage(message),
    });
    this.sessionLogic = new InhouseSessionLogic(this.game, {
      store: this.store,
      banGuard: this.banGuard,
      kick: (steamId32) => this.dota!.kickPlayer(steamId32),
      sendChatMessage: (message) => this.dota!.sendChatMessage(message),
      botSteamId32: this.botSteamId32,
    });

    this.commandQueue = new CommandQueue(this.db, this.botAccountId, this.gameId, {
      createInhouseLobby: (payload) => this.onCreateLobbyCommand(payload),
      invitePlayer: (steamId32) => this.dota!.invitePlayer(steamId32),
      kickPlayer: (steamId32) => this.dota!.kickPlayer(steamId32),
      sendChat: (message) => this.dota!.sendChatMessage(message),
      endSession: (reason) => this.onEndSessionCommand(reason),
    });
    this.commandQueue.start();

    this.router = new LobbyCommandRouter(this.store, {
      reply: (message) => this.dota!.sendChatMessage(message),
      startCountdown: (opts) => this.startCountdown(opts),
      cancelCountdown: () => this.cancelCountdown(),
      countdownRunning: () => this.countdownTimer !== null,
      isAdmin: (steamId32) => this.store.isAdmin({ steamId32 }),
      issueLinkCode: (steamId32, playerName) => issueLinkCode(this.store, steamId32, playerName),
      linkByDiscordName: (steamId32, playerName, query) =>
        this.linkByDiscordName(steamId32, playerName, query),
      linkInfo: (steamId32, playerName) => this.linkInfo(steamId32, playerName),
      siteUrl: this.siteUrl,
    });

    await this.claimAccountStatus();
    this.startHeartbeat();
    this.watchGameDoc();

    await this.reattachOrCreate();
    if (this.finalizing) return this.exitCode;

    await new Promise<void>((resolve) => {
      this.donePromiseResolve = resolve;
    });
    return this.exitCode;
  }

  // ─── Lobby create / reattach ────────────────────────────────────────────────

  private async reattachOrCreate(): Promise<void> {
    await sleep(REATTACH_SETTLE_MS);
    const dota = this.dota!;

    const ourLobby = this.game!.dotaLobbyId;
    if (dota.hasLobby()) {
      if (ourLobby) {
        const id = dota.reattachToCachedLobby();
        logger.info(`[InhouseRunner] Reattached to existing lobby ${id} (game state=${this.game!.state})`);
        this.lobbyCreated = true;
        if (this.game!.state === 'in_progress') this.matchStarted = true;
        return;
      }
      logger.warn('[InhouseRunner] A stale cached lobby exists on this account — leaving it before creating a fresh one');
      try {
        await dota.leaveLobby();
      } catch (e) {
        logger.warn('[InhouseRunner] Failed to leave stale lobby', e);
      }
    } else if (ourLobby) {
      logger.warn(`[InhouseRunner] Game expected lobby ${ourLobby} but the GC cache is empty — recreating`);
    }

    // No lobby yet — wait for the create_inhouse_lobby command the website
    // already queued at game creation, well before this process started. In
    // the normal case this resolves on the very first poll.
    const deadline = Date.now() + CREATE_COMMAND_WAIT_MS;
    while (!this.lobbyCreated && Date.now() < deadline && !this.finalizing) {
      await this.commandQueue!.pollNow();
      if (!this.lobbyCreated && !this.finalizing) await sleep(2_000);
    }
    if (!this.lobbyCreated && !this.finalizing) {
      // Ending the process is not enough: the Conductor decides whether to
      // respawn by re-reading the game, so giving up without a terminal state
      // spins forever — runner starts, waits the full timeout, releases the
      // account, gets replaced, repeats. Seen in production burning a
      // tournament account on an ~80s cycle.
      //
      // Which ending depends on whether a lobby ever existed. A game that
      // already carries a dotaLobbyId had one and lost it — the players closed
      // it, and `cancelled` is what happened from their point of view. A game
      // that never had one never got off the ground, which is `failed`.
      const hadLobby = Boolean(this.game?.dotaLobbyId);
      logger.error(
        `[InhouseRunner] No lobby for game ${this.gameId} after ${CREATE_COMMAND_WAIT_MS}ms ` +
          `(${hadLobby ? 'previous lobby is gone from the GC' : 'no create_inhouse_lobby command arrived'}) — giving up`
      );
      await this.finishUp(
        1,
        hadLobby ? 'cancelled' : 'failed',
        hadLobby ? 'Lobby zostało zamknięte' : 'Nie udało się utworzyć lobby'
      );
    }
  }

  /** Hooked into CommandQueue — idempotent, so a duplicate/retried command is safe. */
  private async onCreateLobbyCommand(payload: InhouseLobbyCommandPayload): Promise<void> {
    if (this.lobbyCreated || this.finalizing) return;
    const game = this.game!;

    // The website assigns the lobby name/password before enqueuing this
    // command, nested under `lobby`. A worker that generates its own sends
    // every player looking for a lobby that doesn't exist under that name —
    // only fall back to generating when both the payload and the document
    // are empty.
    const lobbyName =
      payload.lobby?.name || payload.lobbyName || game.lobbyName || `inhouse-${game.gameNumber}`;
    const lobbyPassword =
      payload.lobby?.password ||
      payload.lobbyPassword ||
      game.lobbyPassword ||
      String(Math.floor(1000 + Math.random() * 9000));

    if (!game.settings.leagueId) {
      logger.warn(
        `[InhouseRunner] Game ${this.gameId} has no leagueId configured — the match will NOT be ` +
          `publicly retrievable, so attendance, match pages and awards will be empty.`
      );
    }

    await this.store.transitionState(this.gameId, 'lobby_creating', { botAccountId: this.botAccountId });

    const settings = toInhouseLobbySettings(game.settings, game.published);
    const created = await this.createLobbyResilient({ name: lobbyName, password: lobbyPassword, ...settings });
    if (!created) return; // exhausted retries — createLobbyResilient already tore the process down

    const dotaLobbyId = this.dota!.getCurrentLobbyId() || 'pending';
    logger.info(`[InhouseRunner] Lobby created (${dotaLobbyId}) "${lobbyName}" for game ${this.gameId}`);

    await this.store.updateGame(this.gameId, {
      dotaLobbyId,
      botAccountId: this.botAccountId,
      ...(game.lobbyName === lobbyName ? {} : { lobbyName }),
      ...(game.lobbyPassword === lobbyPassword ? {} : { lobbyPassword }),
    });
    await this.store.transitionState(this.gameId, 'open');
    await this.sessionLogic!.refresh();
    this.game = this.sessionLogic!.current;

    this.lobbyCreated = true;
  }

  /**
   * Retry createLobby up to 4 attempts with backoff — node-dota2's
   * createPracticeLobby can time out or hit Valve's per-account rate limit,
   * and a single failure would otherwise strand the game forever. Mirrors
   * dist/runner.js's createLobbyResilient exactly.
   *
   * On total failure this exits the process non-zero. In M1 (no Conductor)
   * that just ends the manual test run; M3's Conductor integration respawns
   * with a clean GC session the same way it already does for tournaments.
   */
  private async createLobbyResilient(opts: Parameters<DotaClient['createLobby']>[0]): Promise<boolean> {
    const attempts = 4;
    let lastErr: unknown;
    const dota = this.dota!;

    for (let i = 1; i <= attempts && !this.finalizing; i++) {
      if (dota.getCurrentLobbyId()) {
        logger.warn(`[InhouseRunner] Still in a lobby before create (attempt ${i}/${attempts}) — leaving it first`);
        try {
          await dota.leaveLobby();
        } catch {
          /* best-effort */
        }
        await sleep(2_500);
      }
      try {
        await dota.createLobby(opts);
        if (i > 1) logger.info(`[InhouseRunner] Lobby created on attempt ${i}/${attempts}`);
        return true;
      } catch (e) {
        lastErr = e;
        const backoff = Math.min(15_000, 3_000 * i);
        logger.warn(
          `[InhouseRunner] createLobby attempt ${i}/${attempts} failed: ${(e as Error)?.message || e} — retrying in ${backoff}ms`
        );
        await sleep(backoff);
      }
    }
    if (this.finalizing) return false;
    logger.error(
      `[InhouseRunner] createLobby failed after ${attempts} attempts (${(lastErr as Error)?.message || lastErr}) — exiting`
    );
    await this.finishUp(1);
    return false;
  }

  // ─── Event wiring ───────────────────────────────────────────────────────────

  private wireDotaEvents(): void {
    const dota = this.dota!;

    dota.on('lobbyUpdate', (data: LobbyUpdateData) => {
      if (data.matchId) this.lastKnownMatchId = data.matchId;
      if (!this.matchStarted && data.state === LOBBY_STATE.RUN && data.matchId) {
        this.matchStarted = true;
        void this.onMatchStarted(Number(data.matchId)).catch((e) =>
          logger.error('[InhouseRunner] onMatchStarted failed', e)
        );
      }
      if (this.sessionLogic) {
        void this.sessionLogic.onLobbyUpdate(data.players).catch((e) =>
          logger.error('[InhouseRunner] onLobbyUpdate failed', e)
        );
      }
    });

    dota.on('chatMessage', (msg: LobbyChatMessage) => {
      void this.onChatMessage(msg).catch((e) => logger.error('[InhouseRunner] onChatMessage failed', e));
    });

    dota.on('lobbyCleared', () => {
      void this.onLobbyCleared().catch((e) => logger.error('[InhouseRunner] onLobbyCleared failed', e));
    });

    dota.on('disconnected', (reason: string) => {
      logger.warn(`[InhouseRunner] Steam disconnected: ${reason}`);
    });
    dota.on('gcReconnected', () => {
      logger.info('[InhouseRunner] GC session regained');
    });
    dota.on('gcUnready', () => {
      logger.warn('[InhouseRunner] GC session lost — node-dota2 is retrying');
    });
  }

  private async onChatMessage(msg: LobbyChatMessage): Promise<void> {
    if (this.finalizing || !this.sessionLogic || !this.router) return;
    await this.sessionLogic.refresh();
    this.game = this.sessionLogic.current;
    await this.router.handle(this.game, msg.steamId32, msg.playerName, msg.message);
  }

  private async onMatchStarted(matchId: number): Promise<void> {
    this.clearCountdown();
    logger.info(`[InhouseRunner] Match ${matchId} started for game ${this.gameId}`);
    await this.sessionLogic!.onMatchStarted(matchId);
    this.game = this.sessionLogic!.current;
  }

  /**
   * The GC destroyed the lobby. dota-client.js's 'lobbyCleared' carries no
   * payload (unlike dota2-lobby-bot's own DotaClient), so whether a match was
   * actually played is read from `lastKnownMatchId`, captured from the most
   * recent 'lobbyUpdate' before the clear. Without a match id, nothing was
   * played — the lobby was destroyed some other way (bot kicked, host
   * cancelled, timed out before launch) — and guessing a result here would be
   * wrong, so this just tears the runner down.
   */
  private async onLobbyCleared(): Promise<void> {
    if (this.finalizing) return;

    const matchId = this.lastKnownMatchId;
    if (!matchId) {
      // Nobody else will ever close this out. The website's ingest cron only
      // sweeps games that reached a played state, and no match id means no
      // result is coming, so leaving the state alone leaves the game listed as
      // open on the site forever — with its Steam account leased to it. The
      // runner is the only party that knows the lobby is gone, so it has to say so.
      logger.info(
        `[InhouseRunner] Lobby for game ${this.gameId} closed before any match started — cancelling the game`
      );
      await this.finishUp(0, 'cancelled', 'Lobby zostało zamknięte przed startem meczu');
      return;
    }

    logger.info(`[InhouseRunner] Match ${matchId} ended for game ${this.gameId} — handing off to the website`);

    try {
      await this.store.updateGame(this.gameId, { dotaMatchId: Number(matchId) });
    } catch (error) {
      logger.error(
        `[InhouseRunner] Could not write dotaMatchId ${matchId} for game ${this.gameId} — the ` +
          `website has no way to find this match now`,
        error
      );
    }

    try {
      await notifyMatchFinished(
        { siteUrl: this.siteUrl, secret: this.webhookSecret },
        { gameId: this.gameId, dotaMatchId: Number(matchId) }
      );
    } catch (error) {
      logger.error(`[InhouseRunner] Match webhook failed for game ${this.gameId}`, error);
    }

    await this.finishUp(0);
  }

  private async onEndSessionCommand(reason: string | null): Promise<void> {
    // The website has already moved the game to a terminal state before
    // sending this — leave the lobby and release the account, don't
    // transition state ourselves.
    logger.info(`[InhouseRunner] end_inhouse_session for game ${this.gameId}: ${reason ?? 'no reason given'}`);
    try {
      if (this.dota) await this.dota.leaveLobby();
    } catch {
      /* best-effort */
    }
    await this.finishUp(0);
  }

  // ─── Linking ────────────────────────────────────────────────────────────────

  /**
   * `!link <discord name>` — resolve the name on the guild and link on the spot.
   *
   * Every failure returns a line the player can act on, because this runs in
   * lobby chat where "something went wrong" is useless. The refusals that
   * matter:
   *
   *   ambiguous  — two people answer to that name. Guessing would attach a
   *                stranger's history to this Steam account, so it is refused
   *                and the candidates are shown.
   *   claimed    — this Steam account already belongs to a different Discord
   *                profile. Silently reassigning would move someone's whole
   *                history, so `linkSteamAccount` refuses and so do we.
   */
  private async linkByDiscordName(
    steamId32: string,
    playerName: string,
    query: string
  ): Promise<{ message: string }> {
    const lookup = await findGuildMember(
      { token: this.discordToken, guildId: this.discordGuildId },
      query
    );

    if (!lookup.ok) {
      if (lookup.reason === 'ambiguous') {
        return {
          message: `${playerName}: kilka osób pasuje do "${query}" (${lookup.candidates.join(', ')}) — podaj dokładniejszy nick.`,
        };
      }
      if (lookup.reason === 'not_found') {
        return { message: `${playerName}: nie znalazłem nikogo o nicku "${query}" na Discordzie.` };
      }
      if (lookup.reason === 'not_configured') {
        const base = this.siteUrl.replace(/\/+$/, '');
        return {
          message: `${playerName}: łączenie po nicku jest niedostępne — wpisz !link i użyj kodu na ${base}/inhouse/link`,
        };
      }
      return { message: `${playerName}: nie udało się sprawdzić Discorda — spróbuj za chwilę.` };
    }

    const { discordId, displayName } = lookup.match;

    const link = await this.store.linkSteamAccount(discordId, steamId32, 'manual', displayName);
    if (!link.ok && link.reason === 'claimed_by_other') {
      return {
        message: `${playerName}: to konto Steam jest już przypisane do innego profilu Discord.`,
      };
    }
    if (link.alreadyLinked) {
      return { message: `${playerName}: to konto jest już połączone z ${displayName}.` };
    }

    // The payoff, and the reason linking is worth doing at all: every inhouse
    // is on record whether or not the player ever linked, so the history is
    // waiting for them the moment they do.
    let found = 0;
    try {
      found = (await backfillOnLink(this.store, discordId, steamId32)).gamesFound;
    } catch (error) {
      logger.warn(`[InhouseRunner] Backfill failed for ${discordId}/${steamId32}`, error);
    }

    logger.info(`[InhouseRunner] Linked steam ${steamId32} → discord ${discordId} (${displayName})`);
    return {
      message: found
        ? `${playerName}: połączono z ${displayName} — znaleźliśmy ${found} twoich wcześniejszych gier.`
        : `${playerName}: połączono z ${displayName}.`,
    };
  }

  /**
   * `!link-info` — which Discord profile owns this Steam account?
   *
   * Resolved through findPlayerBySteamId, which matches with array-contains,
   * so it answers correctly from any of the person's alts rather than only
   * their primary.
   */
  private async linkInfo(steamId32: string, playerName: string): Promise<{ message: string }> {
    let player;
    try {
      player = await this.store.findPlayerBySteamId(steamId32);
    } catch (error) {
      logger.warn(`[InhouseRunner] link-info lookup failed for ${steamId32}`, error);
      return { message: `${playerName}: nie udało się sprawdzić — spróbuj za chwilę.` };
    }

    if (!player) {
      return {
        message: `${playerName}: to konto nie jest połączone — wpisz !link <twój nick z Discorda>`,
      };
    }

    const name = player.discordName || player.discordId;
    const parts = [`połączony z ${name}`];
    // Only worth saying when there is more than one — the common case is one
    // account and the extra clause is noise.
    if (player.steamIds.length > 1) parts.push(`${player.steamIds.length} konta Steam`);
    parts.push(`${player.gamesPlayed} gier`);

    return { message: `${playerName}: ${parts.join(' · ')}` };
  }

  // ─── Countdown and launch ───────────────────────────────────────────────────

  private clearCountdown(): void {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    for (const t of this.countdownTicks) clearTimeout(t);
    this.countdownTicks = [];
    if (this.launchWatchdog) clearTimeout(this.launchWatchdog);
    this.launchWatchdog = null;
  }

  private cancelCountdown(): boolean {
    if (!this.countdownTimer) return false;
    this.clearCountdown();
    return true;
  }

  private async startCountdown(opts: { force: boolean; byName: string }): Promise<void> {
    if (this.countdownTimer || this.launching) return;
    const seconds = Math.max(5, this.game?.settings.startCountdownSeconds ?? 30);

    await this.dota!.sendChatMessage(`${opts.byName} started the game. Launching in ${seconds}s — !cancel to abort.`);
    for (const at of [20, 10, 5].filter((t) => t < seconds)) {
      this.countdownTicks.push(
        setTimeout(() => void this.dota!.sendChatMessage(`${at}...`).catch(() => undefined), (seconds - at) * 1000)
      );
    }
    this.countdownTimer = setTimeout(() => void this.launch(opts.force), seconds * 1000);
  }

  private async launch(force: boolean): Promise<void> {
    this.clearCountdown();
    if (this.launching) return;
    this.launching = true;

    try {
      const slots = await this.store.getSlots(this.gameId);
      if (!force && !slots.ready) {
        await this.dota!.sendChatMessage('Someone left — start cancelled.');
        this.launching = false;
        return;
      }

      // Even a forced start needs somebody on an actual team slot. The GC
      // silently DISCARDS launchPracticeLobby when radiant and dire are both
      // empty — no error, no ack, no state change — so without this check a
      // force-start from the unassigned player pool looks like it worked while
      // nothing happens. `fillWithBots` does not rescue this: bots fill empty
      // team slots, they don't seat the humans standing in the pool.
      if (slots.radiant.length === 0 && slots.dire.length === 0) {
        await this.dota!.sendChatMessage(
          'Nobody is on Radiant or Dire — take a team slot (not the unassigned pool), then !start.'
        );
        this.launching = false;
        return;
      }

      await this.store.updateGame(this.gameId, { locked: true });
      await this.dota!.startGame();
      logger.info(`[InhouseRunner] Game ${this.gameId} launch initiated (force=${force})`);
      this.armLaunchWatchdog();
    } catch (error) {
      this.launching = false;
      await this.unlockAfterFailedLaunch();
      logger.error(`[InhouseRunner] Launch failed for game ${this.gameId}`, error);
      await this.dota!.sendChatMessage('Could not start the game — try !start again.').catch(() => undefined);
    }
  }

  /**
   * Recover from a launch the GC accepted but never acted on.
   *
   * `launchPracticeLobby` is fire-and-forget by design (its ack is unreliable —
   * see dota-client.js), so the only evidence a launch actually took is the
   * lobby moving to RUN with a match id. If that never arrives, `launching`
   * would stay true for the life of the process and every later `!start` would
   * silently no-op, with the lobby left locked. Unwind both so the players can
   * simply try again.
   */
  private armLaunchWatchdog(): void {
    if (this.launchWatchdog) clearTimeout(this.launchWatchdog);
    this.launchWatchdog = setTimeout(() => {
      this.launchWatchdog = null;
      if (this.matchStarted || this.finalizing) return;

      logger.warn(
        `[InhouseRunner] Game ${this.gameId}: launch sent ${LAUNCH_WATCHDOG_MS / 1000}s ago but the ` +
          `match never started — unlocking so !start can be retried`
      );
      this.launching = false;
      void this.unlockAfterFailedLaunch();
      void this.dota
        ?.sendChatMessage('The game did not start. Check everyone is on a team slot, then !start again.')
        .catch(() => undefined);
    }, LAUNCH_WATCHDOG_MS);
  }

  private async unlockAfterFailedLaunch(): Promise<void> {
    try {
      await this.store.updateGame(this.gameId, { locked: false });
      await this.sessionLogic?.refresh();
      if (this.sessionLogic) this.game = this.sessionLogic.current;
    } catch (e) {
      logger.warn(`[InhouseRunner] Could not unlock game ${this.gameId} after a failed launch`, e);
    }
  }

  // ─── Heartbeat / lease ──────────────────────────────────────────────────────

  /**
   * Mark the account busy in the field the TOURNAMENT side reads.
   *
   * The two systems track busy-ness differently: inhouses use
   * leasedByGameId + leaseHeartbeatAt, tournaments use
   * busyWithSessionId + a `status` that must be exactly 'idle' for
   * assignPendingSessions to consider an account free. A runner that only
   * renews the lease is invisible to that filter, so the Conductor could hand
   * this same account to a tournament match mid-inhouse — a duplicate Steam
   * login that crash-loops both sides.
   *
   * The website's leaseAccount already sets 'assigned' before we start, so in
   * the normal flow this is a no-op; it exists for every other entry point
   * (manual --bot-id, a respawn after the status was cleared elsewhere).
   */
  private async claimAccountStatus(): Promise<void> {
    try {
      await this.db.collection('botAccounts').doc(this.botAccountId).update({
        status: 'assigned',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      logger.warn(`[InhouseRunner] Could not mark ${this.botAccountId} assigned`, e);
    }
  }

  /**
   * React to the game being ended from outside this process.
   *
   * The host cancelling on the website, an admin force-releasing the bot
   * account, or the website's stuck-game sweeper all just write a terminal
   * state to the document — they do not, and should not, need to reach this
   * process. `end_inhouse_session` covers the same ground but is explicitly
   * best-effort in the contract, so relying on it alone leaves a runner
   * holding a live lobby and a leased Steam account indefinitely for a game
   * everyone else considers over. The tournament runner watches its session
   * doc for exactly this reason; this is the inhouse equivalent.
   */
  private watchGameDoc(): void {
    this.gameUnsub = this.db
      .collection('inhouseGames')
      .doc(this.gameId)
      .onSnapshot(
        (snap) => {
          if (!snap.exists || this.finalizing) return;
          const next = snap.data() as InhouseGame;
          if (!isTerminal(next.state)) return;

          logger.warn(
            `[InhouseRunner] Game ${this.gameId} was moved to '${next.state}' externally — leaving the lobby`
          );
          void (async () => {
            try {
              if (this.dota) await this.dota.leaveLobby();
            } catch {
              /* best-effort */
            }
            await this.finishUp(0);
          })();
        },
        (err) => logger.error(`[InhouseRunner] Game watch failed for ${this.gameId}`, err)
      );
  }

  private startHeartbeat(): void {
    const beat = async (): Promise<void> => {
      try {
        await renewLease(this.db, this.botAccountId, this.gameId);
      } catch (e) {
        logger.warn(`[InhouseRunner] Failed to renew lease on ${this.botAccountId}`, e);
      }
      this.reconcileLobby();
    };
    this.heartbeatTimer = setInterval(() => void beat(), HEARTBEAT_MS);
    void beat();
  }

  /**
   * Notice that our lobby is gone even when no event told us so.
   *
   * The lease heartbeat above proves this *process* is alive; it says nothing
   * about the lobby. Seen in production: a runner sat renewing its lease for
   * ten minutes with the game still showing `open` on the website and a
   * tournament account leased to it, long after the lobby had disappeared —
   * because 'lobbyCleared' never arrived. It is emitted from node-dota2's
   * `practiceLobbyCleared`, which needs a live GC session to be delivered; lose
   * the session at the wrong moment and the notification is simply missed, with
   * nothing to re-deliver it.
   *
   * So the heartbeat also reconciles belief against the GC's shared-object
   * cache, which is authoritative and survives reconnects. Two consecutive
   * misses rather than one, and only while the GC session is actually up, keeps
   * an ordinary reconnect blip from tearing down a perfectly good lobby.
   */
  private reconcileLobby(): void {
    if (this.finalizing || !this.lobbyCreated || !this.dota) return;
    if (!this.dota.isConnected) {
      this.lobbyMisses = 0; // GC is down; its cache tells us nothing right now.
      return;
    }
    if (this.dota.hasLobby()) {
      this.lobbyMisses = 0;
      return;
    }

    this.lobbyMisses += 1;
    if (this.lobbyMisses < LOBBY_MISSES_BEFORE_GONE) {
      logger.warn(
        `[InhouseRunner] Lobby for game ${this.gameId} is missing from the GC cache ` +
          `(${this.lobbyMisses}/${LOBBY_MISSES_BEFORE_GONE}) — confirming before ending the game`
      );
      return;
    }

    logger.warn(
      `[InhouseRunner] Lobby for game ${this.gameId} is gone and no lobbyCleared event arrived — ` +
        `ending the game so the website and the account pool stop waiting on it`
    );
    void this.onLobbyCleared().catch((e) =>
      logger.error('[InhouseRunner] Reconciled lobby teardown failed', e)
    );
  }

  // ─── Teardown ────────────────────────────────────────────────────────────────

  /**
   * Leave the lobby, disconnect, release the account, and resolve run().
   *
   * M1 always releases the account on any finish — there is no Conductor yet
   * to distinguish a clean finish from a crash worth respawning with the same
   * lease, the way dist/runner.js's finishUp does for tournaments. A `kill -9`
   * bypasses this entirely (that's the point of the crash/reattach test), so
   * the lease is only ever released here on a graceful path. M3 should revisit
   * this once the Conductor can actually respawn with the same account.
   */
  private async finishUp(
    exitCode: number,
    endState?: GameState,
    endReason?: string
  ): Promise<void> {
    if (this.finalizing) return;
    this.finalizing = true;
    this.exitCode = exitCode;

    // Before releasing the account, not after. The Conductor decides whether an
    // exit was a finish or a crash by re-reading the game, so a game that is
    // still non-terminal when this process dies gets a replacement runner —
    // which would open a second lobby. Writing the state first closes that gap.
    // transitionState refuses to overwrite an already-terminal state, so the
    // website winning the race (or watchGameDoc having fired) is a no-op here.
    if (endState) {
      try {
        await this.store.transitionState(this.gameId, endState, {
          endedAt: new Date().toISOString(),
          ...(endReason ? { endReason } : {}),
        });
      } catch (e) {
        logger.error(
          `[InhouseRunner] Could not mark game ${this.gameId} as ${endState} — the website will ` +
            `keep showing it as live until its sweeper catches it`,
          e
        );
      }
    }

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.clearCountdown();
    this.commandQueue?.stop();
    this.sessionLogic?.stop();
    if (this.gameUnsub) {
      try {
        this.gameUnsub();
      } catch {
        /* ignore */
      }
      this.gameUnsub = null;
    }

    try {
      await releaseAccount(this.db, this.botAccountId);
    } catch (e) {
      logger.warn(`[InhouseRunner] Failed to release account ${this.botAccountId}`, e);
    }
    try {
      if (this.dota) await this.dota.disconnect();
    } catch {
      /* ignore */
    }

    logger.info(`[InhouseRunner] Finished game ${this.gameId} (exit ${exitCode})`);
    if (this.donePromiseResolve) this.donePromiseResolve();
  }

  /** Graceful shutdown path — SIGINT/SIGTERM. Disconnects without releasing the account or touching game state, since the process may simply be restarting. */
  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.clearCountdown();
    this.commandQueue?.stop();
    this.sessionLogic?.stop();
    try {
      if (this.dota) await this.dota.disconnect();
    } catch {
      /* ignore */
    }
  }
}
