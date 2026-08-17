// Ambient declaration for the existing, un-sourced dist/dota-client.js.
//
// The shipped dist/dota-client.d.ts is STALE — verified by reading
// dota-client.js (1048 lines) in full. It's missing `name` on
// LobbyPlayerInfo entirely, and doesn't reflect several methods added since
// it was last hand-updated. This file is written from the real .js, not
// copied from the stale one. Re-verify against dota-client.js if this ever
// needs updating — there is no source of truth but the compiled output.
import { EventEmitter } from 'events';

export interface DotaClientConfig {
  username: string;
  password: string;
  steamGuardSharedSecret?: string;
}

export interface LobbyCreateOptions {
  name: string;
  password: string;
  gameMode: number;
  serverRegion: number;
  /** Raw DOTALobbyVisibility value: 0=public, 2=unlisted. Requires the visibility proto-patch (see proto-patch.ts) or it's silently dropped. */
  visibility: number;
  /** Seconds, not the GC enum — dota-client.js maps 10/120/300/900 internally. */
  dotaTvDelay: number;
  seriesType: number;
  leagueId?: number;
  cheatsEnabled: boolean;
  fillWithBots: boolean;
  allowSpectators: boolean;
  pauseSetting: number;
  /** 0=Manual, 1=Automatic (coin toss). Omit to leave GC default. */
  selectionPriorityRules?: number;
  /** Immortal Draft → the GC's `do_player_draft` (field 53). Requires the Dockerfile proto patch (Fix 4) AND the whitelist patch in proto-patch.ts; without both it is silently dropped. */
  doPlayerDraft?: boolean;
  radiantSeriesWins?: number;
  direSeriesWins?: number;
}

/** Real runtime shape per dota-client.js:619-641 — `name` is real, the shipped .d.ts omits it. */
export interface LobbyPlayerInfo {
  accountId: number;
  steamId32: string;
  slot: number;
  team: 'radiant' | 'dire' | 'spectator' | 'unassigned' | 'broadcaster';
  name: string | null;
  heroId?: number;
}

export interface LobbyChatMessage {
  accountId: number;
  steamId32: string;
  playerName: string;
  message: string;
}

/** Payload of the 'lobbyUpdate' event — dota-client.js:904-912. */
export interface LobbyUpdateData {
  players: LobbyPlayerInfo[];
  radiantTeamName: string;
  direTeamName: string;
  lobbyId: string | undefined;
  state: number | undefined;
  matchId: string | undefined;
  matchOutcome: number;
}

/** Snapshot from getCurrentLobbyData() — no event wait, reads the live GC cache. */
export interface LobbyDataSnapshot {
  lobbyId: string | undefined;
  state: number | undefined;
  matchId: string | undefined;
  matchOutcome: number;
}

export declare class DotaClient extends EventEmitter {
  constructor(config: DotaClientConfig);

  readonly isConnected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  createLobby(options: LobbyCreateOptions): Promise<void>;
  invitePlayer(steamId32: string): Promise<void>;
  invitePlayers(steamId32s: string[]): Promise<void>;
  sendChatMessage(message: string): Promise<void>;
  kickPlayer(steamId32: string): Promise<void>;
  /** Kick out of a team slot into the unassigned pool — they stay in the lobby. */
  kickPlayerFromTeam(steamId32: string): Promise<void>;
  /**
   * Change the lobby's game mode in place. Resends the full option set (SetDetails
   * is replace-not-merge — a partial one blanks the name and password) and does not
   * await the unreliable ack. False when there is no lobby to configure.
   */
  setGameMode(gameMode: number): Promise<boolean>;
  startGame(): Promise<{ coinToss: boolean }>;
  /** Single relaunch to resume a game aborted back to the lobby — no coin-toss re-roll. */
  relaunchGame(): Promise<void>;
  updateSeriesScore(
    radiantWins: number,
    direWins: number,
    penaltyLevelRadiant?: number,
    penaltyLevelDire?: number
  ): Promise<void>;
  leaveLobby(): Promise<void>;

  getCurrentLobbyPlayers(): LobbyPlayerInfo[];
  getLobbyTeamNames(): { radiant: string; dire: string };
  /** Current Dota 2 lobby id as a string, or undefined if not in a lobby. */
  getCurrentLobbyId(): string | undefined;
  getCurrentLobbyState(): number | undefined;
  getCurrentLobbyData(): LobbyDataSnapshot | null;
  /** True if we currently hold a lobby — either freshly created or adopted from cache. */
  hasLobby(): boolean;
  /** Resume managing a lobby already in the GC cache (post-crash). Returns the lobby id, or null if nothing to reattach to. Idempotent. */
  reattachToCachedLobby(): string | null;
  /** The bot's own account id (Steam32) once logged in — every slot calculation must exclude this. */
  getSelfSteamId32(): string | null;
  getPersonaName(steamId32: string): Promise<string | null>;

  // ─── Events (EventEmitter — payloads by name, confirmed from dota-client.js:891-991) ───
  //   'lobbyUpdate'    → (data: LobbyUpdateData)
  //   'chatMessage'    → (msg: LobbyChatMessage)
  //   'lobbyCleared'   → () — NO payload; unlike dota2-lobby-bot's own DotaClient, this one
  //                      does not pass a matchId. Track the last-seen matchId from
  //                      'lobbyUpdate' yourself if you need it at clear time.
  //   'disconnected'   → (reason: string)
  //   'gcReconnected'  → ()
  //   'gcUnready'      → ()
  on(event: 'lobbyUpdate', listener: (data: LobbyUpdateData) => void): this;
  on(event: 'chatMessage', listener: (msg: LobbyChatMessage) => void): this;
  on(event: 'lobbyCleared', listener: () => void): this;
  on(event: 'disconnected', listener: (reason: string) => void): this;
  on(event: 'gcReconnected', listener: () => void): this;
  on(event: 'gcUnready', listener: () => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
}
