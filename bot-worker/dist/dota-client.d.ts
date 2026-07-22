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
    visibility: number;
    dotaTvDelay: number;
    seriesType: number;
    leagueId?: number;
    cheatsEnabled: boolean;
    fillWithBots: boolean;
    allowSpectators: boolean;
    pauseSetting: number;
}
export interface LobbyPlayerInfo {
    accountId: number;
    steamId32: string;
    slot: number;
    team: 'radiant' | 'dire' | 'spectator' | 'unassigned';
    heroId?: number;
}
export interface LobbyChatMessage {
    accountId: number;
    steamId32: string;
    playerName: string;
    message: string;
}
/**
 * Wraps Steam + Dota 2 client for lobby management.
 * Emits high-level events that map to BotEvent types.
 */
export declare class DotaClient extends EventEmitter {
    private config;
    private steam;
    private dota2;
    private _connected;
    private _inDota;
    private _currentLobby;
    constructor(config: DotaClientConfig);
    get isConnected(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    createLobby(options: LobbyCreateOptions): Promise<void>;
    invitePlayer(steamId32: string): Promise<void>;
    invitePlayers(steamId32s: string[]): Promise<void>;
    sendChatMessage(message: string): Promise<void>;
    kickPlayer(steamId32: string): Promise<void>;
    startGame(): Promise<void>;
    /** Single launch to resume a game aborted back to the lobby (or via !start) — no coin-toss re-roll. */
    relaunchGame(): Promise<void>;
    /** Set the lobby series score + per-side draft penalty for the current game (before coin toss). */
    updateSeriesScore(radiantWins: number, direWins: number, penaltyLevelRadiant?: number, penaltyLevelDire?: number): Promise<void>;
    leaveLobby(): Promise<void>;
    /**
     * Get the current lobby state (players, teams, etc.)
     */
    getCurrentLobbyPlayers(): LobbyPlayerInfo[];
    /**
     * Get team names from current lobby
     */
    getLobbyTeamNames(): {
        radiant: string;
        dire: string;
    };
    private setupEventHandlers;
    private slotToTeam;
    private steam32ToSteam64;
    private sleep;
}
