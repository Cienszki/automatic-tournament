// src/inhouse/session-logic.ts
//
// Ported and adapted from dota2-lobby-bot/src/inhouse/session.ts — the parts
// that have no tournament equivalent: member sync into the attendance-bearing
// membership records, host handover, and the slotSnapshot the website reads.
// Countdown/launch, chat-command routing and settings-apply live elsewhere
// (chat-commands.ts, runner.ts) — this module is purely event-driven state,
// mirroring how runner-logic.js sits alongside runner.js in the tournament
// half of this same repo: pure-ish domain logic next to the stateful class
// that owns the GC connection.
//
// Adaptations from the source, all deliberate:
//   - LobbyPlayerInfo here has `.name`, not `.playerName` (dota-client.js's
//     real shape, confirmed by reading it — the shipped .d.ts was stale).
//   - No `emit()` event-bus parameter — this deployment has no Discord
//     gateway and the contract has no botEvents involvement for inhouses.
//   - No settings-apply / countdown / launch — M1 scope only; every
//     website-created game arrives already published with settings frozen,
//     and `!start`/`!cancel` live in chat-commands.ts + runner.ts.

import type { InhouseGame, Membership } from './core/types';
import { PLAYING_SIDES } from './core/types';
import { InhouseStore } from './core/store';
import { logger } from '../logger';
import type { BanGuard } from './ban-guard';
import type { LobbyPlayerInfo } from '../dota-client';

export interface SessionLogicDeps {
  store: InhouseStore;
  banGuard: BanGuard;
  kick: (steamId32: string) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
  /** The bot's own Steam32 — every slot/host calculation must exclude this. */
  botSteamId32: string;
  /**
   * Fired only when the slot picture actually moved, with the timestamp just
   * written to `slotSnapshot.updatedAt` and the number of players on a playing
   * slot. This is the clock the runner's close rules run on (§5a), which is why
   * it is deliberately NOT fired for a name-only refresh.
   */
  onSlotsChanged?: (updatedAt: string, playersSeated: number) => void;
}

/** How long after a host assignment to announce it in chat — lands after the join-burst of chatter, where it'll actually be read. */
const HOST_ANNOUNCE_DELAY_MS = 5_000;

export class InhouseSessionLogic {
  private game: InhouseGame;
  private readonly store: InhouseStore;
  private readonly deps: SessionLogicDeps;

  /** Guards against two overlapping member syncs interleaving their writes. */
  private syncing = false;
  /** Serialized last-written slot picture, so an unchanged one costs nothing — and so `slotSnapshot.updatedAt` never moves without the slots moving. */
  private lastSlotFingerprint = '';
  /** Roster identity (who is here, under what name) — changes here touch the game document without rewriting the snapshot. */
  private lastIdentityFingerprint = '';
  private hostAnnounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(game: InhouseGame, deps: SessionLogicDeps) {
    this.game = game;
    this.store = deps.store;
    this.deps = deps;
  }

  get gameId(): string {
    return this.game.id;
  }

  get current(): InhouseGame {
    return this.game;
  }

  async refresh(): Promise<void> {
    const latest = await this.store.getGame(this.game.id);
    if (latest) this.game = latest;
  }

  stop(): void {
    if (this.hostAnnounceTimer) clearTimeout(this.hostAnnounceTimer);
    this.hostAnnounceTimer = null;
  }

  // ─── GC event intake ───────────────────────────────────────────────────────

  /**
   * Reconcile the GC's member list into Firestore. The GC re-sends the full
   * list on every change, so this is a full reconciliation rather than a
   * diff: anyone present is upserted, anyone previously present and now
   * absent is marked left. Robust to a dropped update, which do happen.
   */
  async onLobbyUpdate(players: LobbyPlayerInfo[]): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const botId = this.deps.botSteamId32;
      const humans = players.filter((p) => p.steamId32 !== botId && p.steamId32 !== '0');

      const previous = await this.store.listMemberships(this.game.id, true);
      const previousIds = new Set(previous.map((m) => m.steamId32));
      const currentIds = new Set(humans.map((p) => p.steamId32));

      for (const player of humans) {
        const isNew = !previousIds.has(player.steamId32);

        if (isNew) {
          // Ban check before the membership write, so a banned player never
          // lands in the ledger as a participant.
          if (await this.deps.banGuard.enforce(player.steamId32, player.name)) continue;
        }

        const owner = isNew ? await this.store.findPlayerBySteamId(player.steamId32) : null;

        await this.store.upsertMembership(this.game.id, {
          steamId32: player.steamId32,
          side: mapSide(player.team),
          slot: player.slot,
          playerName: player.name ?? null,
          ...(owner ? { discordId: owner.discordId, displayName: owner.discordName ?? undefined } : {}),
        });

        if (isNew) {
          await this.store.consumeReservationBySteamId(this.game.id, player.steamId32);
          await this.store.updateGame(this.game.id, { lastActivityAt: new Date().toISOString() });
        }
      }

      for (const gone of previous.filter((m) => !currentIds.has(m.steamId32))) {
        await this.store.markMembershipLeft(this.game.id, gone.steamId32);
      }

      await this.reconcileHost();
      await this.publishSlotState();
    } catch (error) {
      logger.error(`[InhouseRunner] Lobby sync failed for game ${this.game.id}`, error);
    } finally {
      this.syncing = false;
    }
  }

  /** Called when the GC reports the match has actually launched. */
  async onMatchStarted(matchId: number): Promise<void> {
    await this.store.transitionState(this.game.id, 'in_progress', { dotaMatchId: matchId });
    await this.refresh();
  }

  // ─── Slot state broadcasting ───────────────────────────────────────────────

  /**
   * Emit the current slot picture so the website can re-render. Reserved
   * players are reported separately from in-lobby players, never merged —
   * `slotsOpen` has to mean "this many people can act on it right now".
   */
  private async publishSlotState(): Promise<void> {
    const [members, reservations] = await Promise.all([
      this.store.listMemberships(this.game.id, false),
      this.store.listActiveReservations(this.game.id),
    ]);
    const present = members.filter((m) => m.leftAt === null);

    const slots = InhouseStore.computeSlots(present, reservations);

    const snapshot = {
      inLobby: slots.inLobby,
      radiant: slots.radiant,
      dire: slots.dire,
      unassigned: slots.unassigned,
      committed: slots.committed,
      slotsOpen: slots.slotsOpen,
      reserved: slots.pendingReservations.map((r) => ({
        discordId: r.discordId,
        steamId32: r.steamId32,
        playerName: r.playerName,
        expiresAt: r.expiresAt,
      })),
    };

    // The GC re-sends the lobby on every trivial change, so nothing is written
    // unless something a human would see has actually moved. Two fingerprints,
    // because two different consumers read two different timestamps and they
    // must not be conflated (lobby-bot-integration.md §5a):
    //
    //   slots    → `slotSnapshot.updatedAt`. The website reads this as "empty
    //              since" and closes a lobby nobody has been in for five
    //              minutes. Rewriting the snapshot with unchanged contents —
    //              on a name refresh, on any periodic touch — resets that clock
    //              on every pass, and no empty lobby ever closes again. So this
    //              timestamp moves if and only if the slot picture moved.
    //   identity → the game document's own `updatedAt`. A display name that
    //              resolved late, or a spectator arriving, changes nobody's
    //              slot but does change what the site should render; the site
    //              re-reads `memberships` only when the game document changes,
    //              so this still has to be a write.
    const slotFingerprint = JSON.stringify(snapshot);
    const identityFingerprint = JSON.stringify(
      present.map((m) => [m.steamId32, m.side, m.displayName ?? '', m.playerName ?? ''].join(' ')).sort()
    );

    if (slotFingerprint !== this.lastSlotFingerprint) {
      this.lastSlotFingerprint = slotFingerprint;
      this.lastIdentityFingerprint = identityFingerprint;
      const updatedAt = new Date().toISOString();
      await this.store.updateGame(this.game.id, { slotSnapshot: { ...snapshot, updatedAt } });
      this.deps.onSlotsChanged?.(updatedAt, slots.inLobby.length);
    } else if (identityFingerprint !== this.lastIdentityFingerprint) {
      this.lastIdentityFingerprint = identityFingerprint;
      // Touches `updatedAt` and nothing else — deliberately not the snapshot.
      await this.store.updateGame(this.game.id, {});
    }

    if (slots.ready && this.game.state === 'open') {
      await this.store.transitionState(this.game.id, 'ready');
      await this.refresh();
    } else if (!slots.ready && this.game.state === 'ready') {
      await this.store.transitionState(this.game.id, 'open');
      await this.refresh();
    }
  }

  // ─── Host handover ──────────────────────────────────────────────────────────
  //
  // Invariant: while the lobby is open, the host is a player occupying a
  // playing slot, or there is no host. The rule keys off
  // `initiatorSteamId32 === null` alone, not whether `initiatorDiscordId`
  // happens to be set — a Discord-created lobby whose host never linked Steam
  // gets the same treatment as an anonymous website open, since neither has a
  // Steam identity to track presence against.
  //
  // Deliberately does NOT touch a host with a real steamId32 who simply
  // hasn't walked into the lobby yet (no membership row at all) — only
  // someone actually seen on a playing slot and then gone counts as having
  // left, so an ordinary already-linked host is never displaced before they
  // arrive.

  private async reconcileHost(): Promise<void> {
    if (this.game.state !== 'open' && this.game.state !== 'ready') return;

    const hostSteamId = this.game.initiatorSteamId32;

    const allMembers = await this.store.listMemberships(this.game.id, false);
    const playing = allMembers.filter((m) => m.leftAt === null && PLAYING_SIDES.includes(m.side));

    if (hostSteamId !== null) {
      if (playing.some((m) => m.steamId32 === hostSteamId)) return; // still seated — a side swap included

      const everSeen = allMembers.some((m) => m.steamId32 === hostSteamId);
      if (!everSeen) return; // named host hasn't walked in yet — not a departure
    }

    const next = [...playing].sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt))[0];

    if (next) {
      await this.assignHost(next);
    } else if (hostSteamId !== null) {
      await this.vacateHost();
    }
  }

  private async assignHost(member: Membership): Promise<void> {
    const name = member.displayName || member.playerName || `Player ${member.steamId32}`;
    const nowIso = new Date().toISOString();

    await this.store.updateGame(this.game.id, {
      initiatorSteamId32: member.steamId32,
      initiatorDiscordId: member.discordId ?? '',
      initiatorName: name,
      updatedAt: nowIso,
    });
    await this.refresh();

    this.scheduleHostAnnounce(member.steamId32, name);
  }

  private async vacateHost(): Promise<void> {
    this.clearHostAnnounce();
    await this.store.updateGame(this.game.id, {
      initiatorSteamId32: null,
      initiatorDiscordId: '',
      initiatorName: 'Gość',
      updatedAt: new Date().toISOString(),
    });
    await this.refresh();
  }

  /**
   * One pending timer per game: a new assignment clears whatever was pending
   * before scheduling its own, so a rapid join/leave/join can't spam the
   * lobby. Firing re-checks against the live `initiatorSteamId32` and drops
   * the message if this person isn't host anymore.
   */
  private scheduleHostAnnounce(steamId32: string, name: string): void {
    this.clearHostAnnounce();
    this.hostAnnounceTimer = setTimeout(() => {
      this.hostAnnounceTimer = null;
      if (this.game.initiatorSteamId32 !== steamId32) return;
      void this.deps
        .sendChatMessage(`${name} jest teraz hostem tego lobby. Wpisz !help, aby zobaczyć komendy.`)
        .catch(() => undefined);
    }, HOST_ANNOUNCE_DELAY_MS);
  }

  private clearHostAnnounce(): void {
    if (this.hostAnnounceTimer) clearTimeout(this.hostAnnounceTimer);
    this.hostAnnounceTimer = null;
  }
}

/** Map dota-client.js's team-side strings onto the domain's TeamSide — 'broadcaster' is bot-only and never reaches here since the bot itself is filtered out before this is called. */
function mapSide(team: LobbyPlayerInfo['team']): Membership['side'] {
  if (team === 'radiant' || team === 'dire' || team === 'spectator' || team === 'unassigned') return team;
  return 'unassigned';
}
