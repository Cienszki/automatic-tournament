// A LobbyClient with no Steam behind it. It records every call, and the test plays the
// Game Coordinator: seat players, set team names, move the lobby through its states and
// send chat. Events are emitted synchronously, like node-dota2's; the runner's handlers
// are async, so tests flush them by advancing (fake) timers.

import { EventEmitter } from 'events';
import type { LobbyClient } from '../lobby-client';
import type { LobbyCreateOptions, LobbyDataSnapshot, LobbyPlayerInfo } from '../dota-client';
import type { SlotSide } from '../types';

/** CSODOTALobby.State */
export const LOBBY = { UI: 0, SERVERSETUP: 1, RUN: 2, POSTGAME: 3, READYUP: 4, NOTREADY: 5, SERVERASSIGN: 6 } as const;
/** EMatchOutcome */
export const OUTCOME = { RADIANT: 2, DIRE: 3 } as const;

export type Call = { method: string; args: unknown[] };

interface FakeLobby {
    id: string;
    state: number;
    matchId: string | undefined;
    matchOutcome: number;
    options: LobbyCreateOptions;
}

export class FakeLobbyClient extends EventEmitter implements LobbyClient {
    isConnected = false;
    readonly calls: Call[] = [];
    readonly chat: string[] = [];
    readonly created: LobbyCreateOptions[] = [];
    lobby: FakeLobby | null = null;
    players: LobbyPlayerInfo[] = [];
    teamNames = { radiant: '', dire: '' };
    selfSteamId32: string | null = '999';
    /** Set to make the next createLobby calls fail. */
    failCreates = 0;
    private nextLobbyId = 9000;

    private record(method: string, ...args: unknown[]): void {
        this.calls.push({ method, args });
    }

    callsTo(method: string): unknown[][] {
        return this.calls.filter((c) => c.method === method).map((c) => c.args);
    }

    // ─── LobbyClient ────────────────────────────────────────────────────────

    async connect(): Promise<void> { this.record('connect'); this.isConnected = true; }
    async disconnect(): Promise<void> { this.record('disconnect'); this.isConnected = false; }

    async createLobby(options: LobbyCreateOptions): Promise<void> {
        this.record('createLobby', options);
        if (this.failCreates > 0) { this.failCreates--; throw new Error('Lobby creation timeout (30s)'); }
        this.created.push(options);
        this.lobby = { id: String(this.nextLobbyId++), state: LOBBY.UI, matchId: undefined, matchOutcome: 0, options };
        this.players = [];
        this.teamNames = { radiant: '', dire: '' };
    }

    async invitePlayer(steamId32: string): Promise<void> { this.record('invitePlayer', steamId32); }
    async invitePlayers(steamId32s: string[]): Promise<void> { this.record('invitePlayers', [...steamId32s]); }
    async sendChatMessage(message: string): Promise<void> { this.record('sendChatMessage', message); this.chat.push(message); }

    async kickPlayer(steamId32: string): Promise<void> {
        this.record('kickPlayer', steamId32);
        this.players = this.players.filter((p) => p.steamId32 !== steamId32);
    }

    async kickPlayerFromTeam(steamId32: string): Promise<void> { this.record('kickPlayerFromTeam', steamId32); }
    async setGameMode(gameMode: number): Promise<boolean> { this.record('setGameMode', gameMode); return true; }
    async startGame(): Promise<{ coinToss: boolean }> { this.record('startGame'); return { coinToss: true }; }
    async relaunchGame(): Promise<void> { this.record('relaunchGame'); }

    async updateSeriesScore(radiantWins: number, direWins: number, penaltyLevelRadiant = 0, penaltyLevelDire = 0): Promise<void> {
        this.record('updateSeriesScore', radiantWins, direWins, penaltyLevelRadiant, penaltyLevelDire);
    }

    async leaveLobby(): Promise<void> { this.record('leaveLobby'); this.lobby = null; this.players = []; }

    getCurrentLobbyPlayers(): LobbyPlayerInfo[] { return this.players.map((p) => ({ ...p })); }
    getLobbyTeamNames(): { radiant: string; dire: string } { return { ...this.teamNames }; }
    getCurrentLobbyId(): string | undefined { return this.lobby?.id; }
    getCurrentLobbyState(): number | undefined { return this.lobby?.state; }

    getCurrentLobbyData(): LobbyDataSnapshot | null {
        if (!this.lobby) return null;
        return { lobbyId: this.lobby.id, state: this.lobby.state, matchId: this.lobby.matchId, matchOutcome: this.lobby.matchOutcome };
    }

    hasLobby(): boolean { return this.lobby !== null; }
    reattachToCachedLobby(): string | null { this.record('reattachToCachedLobby'); return this.lobby?.id ?? null; }
    getSelfSteamId32(): string | null { return this.selfSteamId32; }
    async getPersonaName(steamId32: string): Promise<string | null> { return `persona-${steamId32}`; }

    // ─── The test's side: what the Game Coordinator would do ────────────────

    /** A lobby already in the GC cache when the runner logs in (crash recovery). */
    cacheLobby(id: string, state: number, matchId?: string): void {
        this.lobby = { id, state, matchId, matchOutcome: 0, options: {} as LobbyCreateOptions };
    }

    /** Replace who sits where, then push a lobby update. */
    seat(seats: Array<[steamId32: string, team: SlotSide]>): void {
        this.players = seats.map(([steamId32, team], slot) => ({ accountId: Number(steamId32), steamId32, slot, team, name: `name-${steamId32}` }));
        this.push();
    }

    /** Change lobby state / match fields, then push a lobby update. */
    setLobby(fields: Partial<Pick<FakeLobby, 'state' | 'matchId' | 'matchOutcome'>>): void {
        if (!this.lobby) throw new Error('no lobby');
        Object.assign(this.lobby, fields);
        this.push();
    }

    say(steamId32: string, message: string): void {
        this.emit('chatMessage', { accountId: Number(steamId32), steamId32, playerName: `name-${steamId32}`, message });
    }

    push(): void {
        if (!this.lobby) return;
        this.emit('lobbyUpdate', {
            players: this.getCurrentLobbyPlayers(),
            radiantTeamName: this.teamNames.radiant,
            direTeamName: this.teamNames.dire,
            lobbyId: this.lobby.id,
            state: this.lobby.state,
            matchId: this.lobby.matchId,
            matchOutcome: this.lobby.matchOutcome,
        });
    }
}
