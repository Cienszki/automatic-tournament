import type { InhouseGame } from './core/types';
import { InhouseStore } from './core/store';
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
export declare class InhouseSessionLogic {
    private game;
    private readonly store;
    private readonly deps;
    /** Guards against two overlapping member syncs interleaving their writes. */
    private syncing;
    /** Serialized last-written slot picture, so an unchanged one costs nothing — and so `slotSnapshot.updatedAt` never moves without the slots moving. */
    private lastSlotFingerprint;
    /** Roster identity (who is here, under what name) — changes here touch the game document without rewriting the snapshot. */
    private lastIdentityFingerprint;
    private hostAnnounceTimer;
    constructor(game: InhouseGame, deps: SessionLogicDeps);
    get gameId(): string;
    get current(): InhouseGame;
    refresh(): Promise<void>;
    stop(): void;
    /**
     * Reconcile the GC's member list into Firestore. The GC re-sends the full
     * list on every change, so this is a full reconciliation rather than a
     * diff: anyone present is upserted, anyone previously present and now
     * absent is marked left. Robust to a dropped update, which do happen.
     */
    onLobbyUpdate(players: LobbyPlayerInfo[]): Promise<void>;
    /** Called when the GC reports the match has actually launched. */
    onMatchStarted(matchId: number): Promise<void>;
    /**
     * Emit the current slot picture so the website can re-render. Reserved
     * players are reported separately from in-lobby players, never merged —
     * `slotsOpen` has to mean "this many people can act on it right now".
     */
    private publishSlotState;
    private reconcileHost;
    private assignHost;
    private vacateHost;
    /**
     * One pending timer per game: a new assignment clears whatever was pending
     * before scheduling its own, so a rapid join/leave/join can't spam the
     * lobby. Firing re-checks against the live `initiatorSteamId32` and drops
     * the message if this person isn't host anymore.
     */
    private scheduleHostAnnounce;
    private clearHostAnnounce;
}
