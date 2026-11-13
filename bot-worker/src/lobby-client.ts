// What the runners need from a Dota 2 lobby client: the public surface of DotaClient
// (dota-client.ts, Steam + Valve's Game Coordinator). Tests drive a runner with
// testing/fake-lobby-client.ts instead, because the Game Coordinator cannot be emulated;
// the one manual lobby test in RELEASE_CHECK.md covers the real thing.

import type {
    DotaClient,
    DotaClientConfig,
    LobbyChatMessage,
    LobbyCreateOptions,
    LobbyDataSnapshot,
    LobbyPlayerInfo,
    LobbyUpdateData,
} from './dota-client';

export interface LobbyClient {
    readonly isConnected: boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;

    createLobby(options: LobbyCreateOptions): Promise<void>;
    invitePlayer(steamId32: string): Promise<void>;
    invitePlayers(steamId32s: string[]): Promise<void>;
    sendChatMessage(message: string): Promise<void>;
    kickPlayer(steamId32: string): Promise<void>;
    /** Out of a team slot into the unassigned pool; the player stays in the lobby. */
    kickPlayerFromTeam(steamId32: string): Promise<void>;
    /** Resends the full option set: SetDetails replaces the whole lobby configuration. */
    setGameMode(gameMode: number): Promise<boolean>;
    /** First launch; under Automatic selection priority it opens the coin toss. */
    startGame(): Promise<{ coinToss: boolean }>;
    /** One launch with no coin toss, to resume a game aborted back to the lobby. */
    relaunchGame(): Promise<void>;
    /** Must run before startGame(): it resends every lobby option with the new score. */
    updateSeriesScore(radiantWins: number, direWins: number, penaltyLevelRadiant?: number, penaltyLevelDire?: number): Promise<void>;
    leaveLobby(): Promise<void>;

    getCurrentLobbyPlayers(): LobbyPlayerInfo[];
    getLobbyTeamNames(): { radiant: string; dire: string };
    getCurrentLobbyId(): string | undefined;
    getCurrentLobbyState(): number | undefined;
    getCurrentLobbyData(): LobbyDataSnapshot | null;
    hasLobby(): boolean;
    /** Adopt a lobby already in the GC cache after a restart; its id, or null. */
    reattachToCachedLobby(): string | null;
    /** The bot's own Steam32 id once logged in. */
    getSelfSteamId32(): string | null;
    getPersonaName(steamId32: string): Promise<string | null>;

    on(event: 'lobbyUpdate', listener: (data: LobbyUpdateData) => void): this;
    on(event: 'chatMessage', listener: (msg: LobbyChatMessage) => void): this;
    /** No payload. */
    on(event: 'lobbyCleared', listener: () => void): this;
    on(event: 'disconnected', listener: (reason: string) => void): this;
    on(event: 'gcReconnected', listener: () => void): this;
    on(event: 'gcUnready', listener: () => void): this;
}

export type CreateLobbyClient = (config: DotaClientConfig) => LobbyClient;

// Compile-time proof that the real client has this surface. dota-client.ts itself is
// unchecked (@ts-nocheck), so this is where a drift would surface.
type Implements<T extends LobbyClient> = T;
export type DotaClientIsALobbyClient = Implements<DotaClient>;
