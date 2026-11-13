// Builders for the tournament bot's documents. Two teams of five: Alpha (101-105) and
// Beta (201-205); the bot itself is Steam32 999.

import type { BotConfig, MatchDoc, SessionData, SlotSide } from '../types';
import type { MemoryStore } from './memory-store';
import type { FakeLobbyClient } from './fake-lobby-client';

export const T = 'cup';
export const MATCH = 'm1';
export const SESSION = 's1';
export const BOT = 'bot1';
export const ALPHA = ['101', '102', '103', '104', '105'];
export const BETA = ['201', '202', '203', '204', '205'];

const players = (ids: string[], prefix: string) => ids.map((id, i) => ({ id: `${prefix}${i + 1}`, steamId32: id, nickname: `${prefix}-${id}` }));

export function aBotConfig(overrides: Partial<BotConfig> = {}): BotConfig {
    return {
        enabled: true,
        lobby: { gameMode: 'captains_mode', serverRegion: 'europe_west', visibility: 'public', pauseSetting: 'limited' },
        readyCheck: { readyCommands: ['!ready', '!r'], unreadyCommands: ['!unready'] },
        chatMessages: {
            teamReadyMessage: '{team_name} ready',
            allReadyMessage: 'all ready',
            teamNotReadyMessage: '{team_name} missing {missing}',
        },
        postMatch: { autoSyncEnabled: true, syncDelayMinutes: 5 },
        ...overrides,
    };
}

export function aMatch(overrides: Partial<MatchDoc> = {}): MatchDoc {
    return {
        status: 'scheduled',
        teamA: { id: 'A', name: 'Alpha' },
        teamB: { id: 'B', name: 'Beta' },
        ...overrides,
    };
}

export function aSession(overrides: Partial<SessionData> = {}): SessionData {
    const baseRadiantPlayers = players(ALPHA, 'a');
    const baseDirePlayers = players(BETA, 'b');
    const expected = (base: typeof baseRadiantPlayers) => base.map((p) => ({ steamId32: p.steamId32, nickname: p.nickname, isStandin: false }));
    return {
        matchId: MATCH,
        tournamentId: T,
        botAccountId: BOT,
        state: 'bot_assigned',
        lobbyName: 'ALP vs BET - Cup',
        lobbyPassword: 'pw',
        radiantTeam: { teamId: 'A', teamName: 'Alpha', teamTag: 'ALP', expectedPlayers: expected(baseRadiantPlayers) },
        direTeam: { teamId: 'B', teamName: 'Beta', teamTag: 'BET', expectedPlayers: expected(baseDirePlayers) },
        baseRadiantPlayers,
        baseDirePlayers,
        standinAssignments: [],
        readyState: { radiantReady: false, direReady: false },
        validationErrors: [],
        seriesFormat: 'bo3',
        currentGameNumber: 1,
        totalGames: 3,
        seriesScore: { A: 0, B: 0 },
        completedGameIds: [],
        completedGameWinners: [],
        lobbySeriesType: 1,
        lobbyRadiantWins: 0,
        lobbyDireWins: 0,
        scheduledMatchTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

/** A store holding one tournament, its config, one match, one session and one idle account. */
export function seed(store: MemoryStore, session: Partial<SessionData> = {}, config: Partial<BotConfig> = {}): void {
    store.tournaments.set(T, { name: 'Cup' });
    store.putBotConfig(T, aBotConfig(config));
    store.putMatch(T, MATCH, aMatch());
    store.putSession(SESSION, aSession(session));
    store.accounts.set(BOT, {
        enabled: true, status: 'bot_assigned', displayName: 'Bot One', username: 'bot-one',
        encryptedPassword: Buffer.from('secret').toString('base64'), steamId32: '999',
    });
}

/** Alpha on one side, Beta on the other, the bot in the unassigned pool. */
export function seatTeams(fake: FakeLobbyClient, alphaSide: 'radiant' | 'dire', extra: Array<[string, SlotSide]> = []): void {
    const betaSide = alphaSide === 'radiant' ? 'dire' : 'radiant';
    fake.teamNames = { radiant: 'Team R', dire: 'Team D' };
    fake.seat([
        ['999', 'unassigned'],
        ...ALPHA.map((id): [string, SlotSide] => [id, alphaSide]),
        ...BETA.map((id): [string, SlotSide] => [id, betaSide]),
        ...extra,
    ]);
}
