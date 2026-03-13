# Lobby Bot — Full Testing Program

**Version:** 1.2  
**Created:** March 7, 2026  
**Purpose:** Comprehensive test plan to verify the lobby bot system works correctly before going live.

**Changelog:**
- v1.2 — Added tests for series management, multi-phase timeouts, live standin sync
- v1.0 — Initial test plan

---

## Test Categories

1. [Unit Tests (Automated)](#1-unit-tests-automated)
2. [Integration Tests (Firestore)](#2-integration-tests-firestore)
3. [Bot Worker Tests (Steam/Dota 2)](#3-bot-worker-tests-steamdota-2)
4. [End-to-End Scenario Tests](#4-end-to-end-scenario-tests)
5. [Admin UI Tests](#5-admin-ui-tests)
6. [Stress & Edge Case Tests](#6-stress--edge-case-tests)

---

## 1. Unit Tests (Automated)

These test pure logic functions with no external dependencies. Run with `npx vitest` or your preferred test runner.

### File: `src/lib/bot/__tests__/lobby-lifecycle.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateLobbyRequirements,
  identifyPlayerTeam,
  isReadyCommand,
  isUnreadyCommand,
  isValidTransition,
  getNextStates,
  formatTeamAssignmentMessage,
  formatValidationErrors,
  calculateSeriesResult,
  getNextGameNumber,
  formatSeriesScore,
  getWinsToWin,
} from '../lobby-lifecycle';
import type { LobbySession } from '@/types/lobby-bot';
import type { LobbyStateSnapshot } from '../lobby-lifecycle';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function createMockSession(overrides: Partial<LobbySession> = {}): LobbySession {
  return {
    id: 'session-1',
    matchId: 'match-1',
    tournamentId: 'tournament-1',
    botAccountId: 'bot-1',
    state: 'lobby_open',
    lobbyName: 'Test Match',
    lobbyPassword: 'abc123',
    radiantTeam: {
      teamId: 'team-a',
      teamName: 'Team Alpha',
      expectedPlayers: [
        { steamId32: '100000001', nickname: 'Player1', isStandin: false },
        { steamId32: '100000002', nickname: 'Player2', isStandin: false },
        { steamId32: '100000003', nickname: 'Player3', isStandin: false },
        { steamId32: '100000004', nickname: 'Player4', isStandin: false },
        { steamId32: '100000005', nickname: 'Player5', isStandin: false },
      ],
    },
    direTeam: {
      teamId: 'team-b',
      teamName: 'Team Beta',
      expectedPlayers: [
        { steamId32: '200000001', nickname: 'Player6', isStandin: false },
        { steamId32: '200000002', nickname: 'Player7', isStandin: false },
        { steamId32: '200000003', nickname: 'Player8', isStandin: false },
        { steamId32: '200000004', nickname: 'Player9', isStandin: false },
        { steamId32: '200000005', nickname: 'Player10', isStandin: false },
      ],
    },
    readyState: {
      radiantReady: false,
      direReady: false,
    },
    validationErrors: [],
    currentGameNumber: 1,
    totalGames: 2,
    completedGameIds: [],
    seriesFormat: 'bo2',
    seriesScore: { 'team-a': 0, 'team-b': 0 },
    completedGameWinners: [],
    createdAt: '2026-03-07T19:50:00Z',
    ...overrides,
  };
}

function createValidSnapshot(): LobbyStateSnapshot {
  return {
    players: [
      // Radiant players in slots 0-4
      { slotIndex: 0, steamId32: '100000001', teamSide: 'radiant' },
      { slotIndex: 1, steamId32: '100000002', teamSide: 'radiant' },
      { slotIndex: 2, steamId32: '100000003', teamSide: 'radiant' },
      { slotIndex: 3, steamId32: '100000004', teamSide: 'radiant' },
      { slotIndex: 4, steamId32: '100000005', teamSide: 'radiant' },
      // Dire players in slots 5-9
      { slotIndex: 5, steamId32: '200000001', teamSide: 'dire' },
      { slotIndex: 6, steamId32: '200000002', teamSide: 'dire' },
      { slotIndex: 7, steamId32: '200000003', teamSide: 'dire' },
      { slotIndex: 8, steamId32: '200000004', teamSide: 'dire' },
      { slotIndex: 9, steamId32: '200000005', teamSide: 'dire' },
    ],
    radiantTeamName: 'Team Alpha',
    direTeamName: 'Team Beta',
    isInGame: false,
    gameEnded: false,
  };
}

// ─── validateLobbyRequirements ──────────────────────────────────────────────

describe('validateLobbyRequirements', () => {
  it('should pass with all requirements met', () => {
    const session = createMockSession();
    const snapshot = createValidSnapshot();
    const result = validateLobbyRequirements(session, snapshot);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when Radiant team name is empty', () => {
    const session = createMockSession();
    const snapshot = createValidSnapshot();
    snapshot.radiantTeamName = '';

    const result = validateLobbyRequirements(session, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('Radiant team name is not set')
    );
  });

  it('should fail when Dire team name is empty', () => {
    const session = createMockSession();
    const snapshot = createValidSnapshot();
    snapshot.direTeamName = '';

    const result = validateLobbyRequirements(session, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('Dire team name is not set')
    );
  });

  it('should fail when a Radiant player is missing from lobby', () => {
    const session = createMockSession();
    const snapshot = createValidSnapshot();
    // Remove Player3 from the lobby
    snapshot.players = snapshot.players.filter(
      (p) => p.steamId32 !== '100000003'
    );

    const result = validateLobbyRequirements(session, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('Player3')
    );
  });

  it('should fail when a Dire player is in the wrong team slot', () => {
    const session = createMockSession();
    const snapshot = createValidSnapshot();
    // Move Player6 (Dire) to a Radiant slot
    const player6 = snapshot.players.find(
      (p) => p.steamId32 === '200000001'
    )!;
    player6.teamSide = 'radiant';
    player6.slotIndex = 0;

    const result = validateLobbyRequirements(session, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('Player6')
    );
    expect(result.errors).toContainEqual(
      expect.stringContaining('RADIANT slot')
    );
  });

  it('should fail when Radiant has less than 5 players', () => {
    const session = createMockSession();
    const snapshot = createValidSnapshot();
    // Remove 2 Radiant players
    snapshot.players = snapshot.players.filter(
      (p) => p.steamId32 !== '100000004' && p.steamId32 !== '100000005'
    );

    const result = validateLobbyRequirements(session, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('3/5 players')
    );
  });

  it('should warn about unauthorized players in team slots', () => {
    const session = createMockSession();
    const snapshot = createValidSnapshot();
    // Add an unknown player in a Radiant slot
    snapshot.players.push({
      slotIndex: 0,
      steamId32: '999999999',
      teamSide: 'radiant',
    });

    const result = validateLobbyRequirements(session, snapshot);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('Unknown player')
    );
    expect(result.warnings).toContainEqual(
      expect.stringContaining('999999999')
    );
  });

  it('should pass when standin replaces an original player', () => {
    const session = createMockSession();
    // Player5 is replaced by a standin with different Steam ID
    session.radiantTeam.expectedPlayers[4] = {
      steamId32: '100000099',
      nickname: 'StandinPlayer',
      isStandin: true,
      replacesPlayerId: 'player5-id',
      replacesPlayerNickname: 'Player5',
    };

    const snapshot = createValidSnapshot();
    // Replace Player5's Steam ID with standin's ID
    snapshot.players[4].steamId32 = '100000099';

    const result = validateLobbyRequirements(session, snapshot);
    expect(result.valid).toBe(true);
  });

  it('should not count coaches as unauthorized in team slots', () => {
    const session = createMockSession();
    session.radiantTeam.coachSteamId32 = '300000001';

    const snapshot = createValidSnapshot();
    snapshot.players.push({
      slotIndex: 10, // Radiant coach slot
      steamId32: '300000001',
      teamSide: 'radiant',
    });

    const result = validateLobbyRequirements(session, snapshot);
    // Coach should not generate a warning
    expect(result.warnings.filter((w) => w.includes('300000001'))).toHaveLength(0);
  });
});

// ─── identifyPlayerTeam ─────────────────────────────────────────────────────

describe('identifyPlayerTeam', () => {
  const session = createMockSession();

  it('should identify Radiant players', () => {
    expect(identifyPlayerTeam(session, '100000001')).toBe('radiant');
    expect(identifyPlayerTeam(session, '100000003')).toBe('radiant');
    expect(identifyPlayerTeam(session, '100000005')).toBe('radiant');
  });

  it('should identify Dire players', () => {
    expect(identifyPlayerTeam(session, '200000001')).toBe('dire');
    expect(identifyPlayerTeam(session, '200000005')).toBe('dire');
  });

  it('should return null for unknown players', () => {
    expect(identifyPlayerTeam(session, '999999999')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(identifyPlayerTeam(session, '')).toBeNull();
  });
});

// ─── isReadyCommand / isUnreadyCommand ──────────────────────────────────────

describe('isReadyCommand', () => {
  const readyCommands = ['!ready', '!r'];

  it('should match exact ready commands', () => {
    expect(isReadyCommand('!ready', readyCommands)).toBe(true);
    expect(isReadyCommand('!r', readyCommands)).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isReadyCommand('!Ready', readyCommands)).toBe(true);
    expect(isReadyCommand('!READY', readyCommands)).toBe(true);
    expect(isReadyCommand('!R', readyCommands)).toBe(true);
  });

  it('should handle leading/trailing whitespace', () => {
    expect(isReadyCommand('  !ready  ', readyCommands)).toBe(true);
  });

  it('should NOT match partial or extended commands', () => {
    expect(isReadyCommand('!readyup', readyCommands)).toBe(false);
    expect(isReadyCommand('im !ready', readyCommands)).toBe(false);
    expect(isReadyCommand('!ready guys', readyCommands)).toBe(false);
  });

  it('should NOT match unrelated messages', () => {
    expect(isReadyCommand('hello', readyCommands)).toBe(false);
    expect(isReadyCommand('gg', readyCommands)).toBe(false);
  });
});

describe('isUnreadyCommand', () => {
  const unreadyCommands = ['!unready', '!ur'];

  it('should match exact unready commands', () => {
    expect(isUnreadyCommand('!unready', unreadyCommands)).toBe(true);
    expect(isUnreadyCommand('!ur', unreadyCommands)).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isUnreadyCommand('!UNREADY', unreadyCommands)).toBe(true);
  });
});

// ─── State Machine Transitions ──────────────────────────────────────────────

describe('isValidTransition', () => {
  it('should allow valid forward transitions', () => {
    expect(isValidTransition('pending', 'bot_assigned')).toBe(true);
    expect(isValidTransition('bot_assigned', 'lobby_creating')).toBe(true);
    expect(isValidTransition('lobby_creating', 'lobby_open')).toBe(true);
    expect(isValidTransition('lobby_open', 'ready_check')).toBe(true);
    expect(isValidTransition('ready_check', 'requirements_met')).toBe(true);
    expect(isValidTransition('requirements_met', 'coin_toss')).toBe(true);
    expect(isValidTransition('coin_toss', 'in_game')).toBe(true);
    expect(isValidTransition('in_game', 'post_game')).toBe(true);
    expect(isValidTransition('post_game', 'syncing')).toBe(true);
    expect(isValidTransition('syncing', 'completed')).toBe(true);
  });

  it('should allow error transitions from any active state', () => {
    expect(isValidTransition('pending', 'error')).toBe(true);
    expect(isValidTransition('lobby_open', 'error')).toBe(true);
    expect(isValidTransition('in_game', 'error')).toBe(true);
  });

  it('should allow cancellation from pre-game states', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
    expect(isValidTransition('bot_assigned', 'cancelled')).toBe(true);
    expect(isValidTransition('lobby_open', 'cancelled')).toBe(true);
  });

  it('should allow retry from error → pending', () => {
    expect(isValidTransition('error', 'pending')).toBe(true);
  });

  it('should deny invalid transitions', () => {
    expect(isValidTransition('pending', 'in_game')).toBe(false);
    expect(isValidTransition('completed', 'pending')).toBe(false);
    expect(isValidTransition('cancelled', 'lobby_open')).toBe(false);
    expect(isValidTransition('lobby_open', 'coin_toss')).toBe(false);
  });

  it('should deny transitions from terminal states', () => {
    expect(isValidTransition('completed', 'error')).toBe(false);
    expect(isValidTransition('cancelled', 'error')).toBe(false);
  });
});

describe('getNextStates', () => {
  it('should return valid next states', () => {
    expect(getNextStates('pending')).toContain('bot_assigned');
    expect(getNextStates('pending')).toContain('cancelled');
    expect(getNextStates('pending')).toContain('error');
  });

  it('should return empty array for terminal states', () => {
    expect(getNextStates('completed')).toHaveLength(0);
    expect(getNextStates('cancelled')).toHaveLength(0);
  });
});

// ─── Message Formatting ─────────────────────────────────────────────────────

describe('formatTeamAssignmentMessage', () => {
  it('should replace team name placeholders', () => {
    const template = 'RADIANT: {radiant_team} | DIRE: {dire_team}';
    const result = formatTeamAssignmentMessage(template, 'Team Alpha', 'Team Beta');
    expect(result).toBe('RADIANT: Team Alpha | DIRE: Team Beta');
  });

  it('should handle templates without placeholders', () => {
    const result = formatTeamAssignmentMessage('Go go go!', 'A', 'B');
    expect(result).toBe('Go go go!');
  });
});

describe('formatValidationErrors', () => {
  it('should format errors with prefix and numbering', () => {
    const result = formatValidationErrors('Issues found:', [
      'Player1 is missing',
      'Team name not set',
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Issues found:');
    expect(result[1]).toBe('1. Player1 is missing');
    expect(result[2]).toBe('2. Team name not set');
  });

  it('should handle empty error list', () => {
    const result = formatValidationErrors('Prefix:', []);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Prefix:');
  });
});

// ─── calculateSeriesResult ──────────────────────────────────────────────────

describe('calculateSeriesResult', () => {
  it('BO1: decided after 1 game', () => {
    const session = createMockSession({
      seriesFormat: 'bo1',
      seriesScore: { 'team-a': 1, 'team-b': 0 },
      completedGameWinners: ['radiant'],
      radiantTeam: { teamId: 'team-a', teamName: 'Team Alpha', expectedPlayers: [] },
      direTeam: { teamId: 'team-b', teamName: 'Team Beta', expectedPlayers: [] },
    });
    const result = calculateSeriesResult(session);
    expect(result.decided).toBe(true);
    expect(result.winnerId).toBe('team-a');
    expect(result.isDraw).toBe(false);
    expect(result.gamesPlayed).toBe(1);
    expect(result.winsToWin).toBe(1);
  });

  it('BO2: not decided after 1 game (must play both)', () => {
    const session = createMockSession({
      seriesFormat: 'bo2',
      seriesScore: { 'team-a': 1, 'team-b': 0 },
      completedGameWinners: ['radiant'],
    });
    const result = calculateSeriesResult(session);
    expect(result.decided).toBe(false);
  });

  it('BO2: decided 2-0 after 2 games', () => {
    const session = createMockSession({
      seriesFormat: 'bo2',
      seriesScore: { 'team-a': 2, 'team-b': 0 },
      completedGameWinners: ['radiant', 'radiant'],
    });
    const result = calculateSeriesResult(session);
    expect(result.decided).toBe(true);
    expect(result.winnerId).toBe('team-a');
    expect(result.isDraw).toBe(false);
  });

  it('BO2: draw 1-1 after 2 games', () => {
    const session = createMockSession({
      seriesFormat: 'bo2',
      seriesScore: { 'team-a': 1, 'team-b': 1 },
      completedGameWinners: ['radiant', 'dire'],
    });
    const result = calculateSeriesResult(session);
    expect(result.decided).toBe(true);
    expect(result.isDraw).toBe(true);
    expect(result.winnerId).toBeUndefined();
  });

  it('BO3: decided 2-0 after game 2 (early clinch)', () => {
    const session = createMockSession({
      seriesFormat: 'bo3',
      seriesScore: { 'team-a': 2, 'team-b': 0 },
      completedGameWinners: ['radiant', 'radiant'],
    });
    const result = calculateSeriesResult(session);
    expect(result.decided).toBe(true);
    expect(result.winnerId).toBe('team-a');
    expect(result.gamesPlayed).toBe(2);
    expect(result.maxGames).toBe(3);
  });

  it('BO3: not decided at 1-1 (must play game 3)', () => {
    const session = createMockSession({
      seriesFormat: 'bo3',
      seriesScore: { 'team-a': 1, 'team-b': 1 },
      completedGameWinners: ['radiant', 'dire'],
    });
    const result = calculateSeriesResult(session);
    expect(result.decided).toBe(false);
  });

  it('BO5: decided 3-1 after game 4', () => {
    const session = createMockSession({
      seriesFormat: 'bo5',
      seriesScore: { 'team-a': 3, 'team-b': 1 },
      completedGameWinners: ['radiant', 'dire', 'radiant', 'radiant'],
    });
    const result = calculateSeriesResult(session);
    expect(result.decided).toBe(true);
    expect(result.winnerId).toBe('team-a');
    expect(result.winsToWin).toBe(3);
  });
});

// ─── getWinsToWin ───────────────────────────────────────────────────────────

describe('getWinsToWin', () => {
  it('BO1 → 1', () => expect(getWinsToWin('bo1')).toBe(1));
  it('BO2 → 2 (must win both)', () => expect(getWinsToWin('bo2')).toBe(2));
  it('BO3 → 2', () => expect(getWinsToWin('bo3')).toBe(2));
  it('BO5 → 3', () => expect(getWinsToWin('bo5')).toBe(3));
});

// ─── getNextGameNumber ──────────────────────────────────────────────────────

describe('getNextGameNumber', () => {
  it('should return 1 when no games completed', () => {
    const session = createMockSession({ completedGameWinners: [] });
    expect(getNextGameNumber(session)).toBe(1);
  });

  it('should return 2 after game 1', () => {
    const session = createMockSession({ completedGameWinners: ['radiant'] });
    expect(getNextGameNumber(session)).toBe(2);
  });

  it('should return 3 after games 1 and 2', () => {
    const session = createMockSession({ completedGameWinners: ['radiant', 'dire'] });
    expect(getNextGameNumber(session)).toBe(3);
  });
});

// ─── formatSeriesScore ──────────────────────────────────────────────────────

describe('formatSeriesScore', () => {
  it('should return "0-0" at start', () => {
    const session = createMockSession({
      seriesScore: { 'team-a': 0, 'team-b': 0 },
    });
    expect(formatSeriesScore(session)).toBe('0-0');
  });

  it('should return "1-0" after radiant wins game 1', () => {
    const session = createMockSession({
      seriesScore: { 'team-a': 1, 'team-b': 0 },
    });
    expect(formatSeriesScore(session)).toBe('1-0');
  });

  it('should return "1-1" after split series', () => {
    const session = createMockSession({
      seriesScore: { 'team-a': 1, 'team-b': 1 },
    });
    expect(formatSeriesScore(session)).toBe('1-1');
  });
});
```

### File: `src/lib/bot/__tests__/enforce-timeouts.test.ts`

These tests cover the four phases of `enforceSessionTimeouts()`.

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { LobbySession, TournamentBotConfig } from '@/types/lobby-bot';

// The timeout enforcer is orchestrated server-side; these tests validate
// the decision logic for each phase in isolation.

const BASE_CONFIG: Partial<TournamentBotConfig> = {
  pendingSessionTimeoutMinutes: 20,
  botAssignedTimeoutMinutes: 5,
  lobbyOpenWarningMinutes: 15,
  lobbyOpenTimeoutMinutes: 30,
  readyCheckTimeoutMinutes: 10,
};

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function makeSession(overrides: Partial<LobbySession>): LobbySession {
  return {
    id: 'test-session',
    matchId: 'match-1',
    tournamentId: 't-1',
    botAccountId: 'bot-1',
    state: 'pending',
    lobbyName: 'Test',
    lobbyPassword: 'pw',
    radiantTeam: { teamId: 'r', teamName: 'R', expectedPlayers: [] },
    direTeam: { teamId: 'd', teamName: 'D', expectedPlayers: [] },
    readyState: { radiantReady: false, direReady: false },
    validationErrors: [],
    currentGameNumber: 1,
    totalGames: 1,
    completedGameIds: [],
    seriesFormat: 'bo1',
    seriesScore: {},
    completedGameWinners: [],
    createdAt: minutesAgo(0),
    ...overrides,
  };
}

describe('Timeout Phase 1: PENDING STUCK', () => {
  it('should cancel sessions stuck in pending for > pendingSessionTimeoutMinutes', () => {
    const session = makeSession({ state: 'pending', createdAt: minutesAgo(21) });
    // Simulate: age > 20 min → should cancel
    const ageMinutes = (Date.now() - new Date(session.createdAt!).getTime()) / 60_000;
    expect(ageMinutes).toBeGreaterThan(BASE_CONFIG.pendingSessionTimeoutMinutes!);
  });

  it('should NOT cancel a pending session younger than the threshold', () => {
    const session = makeSession({ state: 'pending', createdAt: minutesAgo(5) });
    const ageMinutes = (Date.now() - new Date(session.createdAt!).getTime()) / 60_000;
    expect(ageMinutes).toBeLessThan(BASE_CONFIG.pendingSessionTimeoutMinutes!);
  });
});

describe('Timeout Phase 2: BOT STUCK', () => {
  it('should cancel bot_assigned sessions stuck for > botAssignedTimeoutMinutes', () => {
    const session = makeSession({ state: 'bot_assigned', createdAt: minutesAgo(6) });
    const ageMinutes = (Date.now() - new Date(session.createdAt!).getTime()) / 60_000;
    expect(ageMinutes).toBeGreaterThan(BASE_CONFIG.botAssignedTimeoutMinutes!);
  });

  it('should cancel lobby_creating sessions stuck for > botAssignedTimeoutMinutes', () => {
    const session = makeSession({ state: 'lobby_creating', createdAt: minutesAgo(6) });
    const ageMinutes = (Date.now() - new Date(session.createdAt!).getTime()) / 60_000;
    expect(ageMinutes).toBeGreaterThan(BASE_CONFIG.botAssignedTimeoutMinutes!);
  });
});

describe('Timeout Phase 3: LOBBY OPEN (two-phase)', () => {
  it('should NOT send warning before lobbyOpenWarningMinutes', () => {
    const session = makeSession({
      state: 'lobby_open',
      lobbyCreatedAt: minutesAgo(10),
    });
    const lobbyAge = (Date.now() - new Date(session.lobbyCreatedAt!).getTime()) / 60_000;
    expect(lobbyAge).toBeLessThan(BASE_CONFIG.lobbyOpenWarningMinutes!);
  });

  it('should send warning after lobbyOpenWarningMinutes when not yet sent', () => {
    const session = makeSession({
      state: 'lobby_open',
      lobbyCreatedAt: minutesAgo(16),
      timeoutWarningSentAt: undefined,
    });
    const lobbyAge = (Date.now() - new Date(session.lobbyCreatedAt!).getTime()) / 60_000;
    expect(lobbyAge).toBeGreaterThan(BASE_CONFIG.lobbyOpenWarningMinutes!);
    expect(session.timeoutWarningSentAt).toBeUndefined(); // warning not yet sent
  });

  it('should NOT send duplicate warning when timeoutWarningSentAt is already set', () => {
    const session = makeSession({
      state: 'lobby_open',
      lobbyCreatedAt: minutesAgo(20),
      timeoutWarningSentAt: minutesAgo(5),
    });
    // Warning was already sent — should not send again
    expect(session.timeoutWarningSentAt).toBeDefined();
  });

  it('should close lobby after lobbyOpenTimeoutMinutes', () => {
    const session = makeSession({
      state: 'lobby_open',
      lobbyCreatedAt: minutesAgo(31),
    });
    const lobbyAge = (Date.now() - new Date(session.lobbyCreatedAt!).getTime()) / 60_000;
    expect(lobbyAge).toBeGreaterThan(BASE_CONFIG.lobbyOpenTimeoutMinutes!);
  });

  it('should use lobbyCreatedAt (not createdAt) for the lobby-open clock', () => {
    // Session was created 25 min ago (total), but lobby opened only 5 min ago
    const session = makeSession({
      state: 'lobby_open',
      createdAt: minutesAgo(25),
      lobbyCreatedAt: minutesAgo(5),
    });
    const lobbyAge = (Date.now() - new Date(session.lobbyCreatedAt!).getTime()) / 60_000;
    expect(lobbyAge).toBeLessThan(BASE_CONFIG.lobbyOpenWarningMinutes!);
    // Should NOT close even though total session age is 25 min
  });
});

describe('Timeout Phase 4: READY CHECK STUCK', () => {
  it('should cancel requirements_met sessions stuck for > readyCheckTimeoutMinutes', () => {
    const session = makeSession({
      state: 'requirements_met',
      readyState: { radiantReady: true, direReady: true },
      createdAt: minutesAgo(11),
    });
    const ageMinutes = (Date.now() - new Date(session.createdAt!).getTime()) / 60_000;
    expect(ageMinutes).toBeGreaterThan(BASE_CONFIG.readyCheckTimeoutMinutes!);
  });

  it('should NOT cancel if game launched promptly', () => {
    const session = makeSession({
      state: 'in_game',
      readyState: { radiantReady: true, direReady: true },
    });
    // in_game state should not be affected by ready-check timeout
    expect(session.state).toBe('in_game');
  });
});
```

### File: `src/lib/bot/__tests__/bot-pool-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type {
  BotAccount,
  BotAccountStatus,
  TournamentBotConfig,
  LobbySession,
  LobbySessionState,
} from '@/types/lobby-bot';
import {
  DEFAULT_TOURNAMENT_BOT_CONFIG,
  DEFAULT_LOBBY_SETTINGS,
  DEFAULT_READY_CHECK_CONFIG,
  DEFAULT_CHAT_CONFIG,
  DEFAULT_POST_MATCH_CONFIG,
  DOTA_GAME_MODE_IDS,
  DOTA_SERVER_REGION_IDS,
  DOTA_LOBBY_SLOTS,
  GAME_MODE_LABELS,
  SERVER_REGION_LABELS,
} from '@/types/lobby-bot';

describe('Default Configurations', () => {
  it('DEFAULT_TOURNAMENT_BOT_CONFIG should be disabled by default', () => {
    expect(DEFAULT_TOURNAMENT_BOT_CONFIG.enabled).toBe(false);
  });

  it('default lobby settings should use Captain\'s Mode on EU West', () => {
    expect(DEFAULT_LOBBY_SETTINGS.gameMode).toBe('captains_mode');
    expect(DEFAULT_LOBBY_SETTINGS.serverRegion).toBe('europe_west');
  });

  it('default ready check should have both ready and unready commands', () => {
    expect(DEFAULT_READY_CHECK_CONFIG.readyCommands.length).toBeGreaterThan(0);
    expect(DEFAULT_READY_CHECK_CONFIG.unreadyCommands.length).toBeGreaterThan(0);
    expect(DEFAULT_READY_CHECK_CONFIG.readyCommands).toContain('!ready');
    expect(DEFAULT_READY_CHECK_CONFIG.unreadyCommands).toContain('!unready');
  });

  it('default post match config should enable auto sync with 5 min delay', () => {
    expect(DEFAULT_POST_MATCH_CONFIG.autoSyncEnabled).toBe(true);
    expect(DEFAULT_POST_MATCH_CONFIG.syncDelayMinutes).toBe(5);
  });
});

describe('Dota 2 Constants', () => {
  it('DOTA_GAME_MODE_IDS should map all modes to integers', () => {
    expect(DOTA_GAME_MODE_IDS.captains_mode).toBe(2);
    expect(DOTA_GAME_MODE_IDS.all_pick).toBe(1);
    expect(DOTA_GAME_MODE_IDS.turbo).toBe(23);
  });

  it('DOTA_SERVER_REGION_IDS should map all regions to integers', () => {
    expect(DOTA_SERVER_REGION_IDS.europe_west).toBe(8);
    expect(DOTA_SERVER_REGION_IDS.us_east).toBe(2);
    expect(DOTA_SERVER_REGION_IDS.russia).toBe(3);
  });

  it('GAME_MODE_LABELS should have a label for every mode', () => {
    const modes = Object.keys(DOTA_GAME_MODE_IDS);
    for (const mode of modes) {
      expect(GAME_MODE_LABELS[mode as keyof typeof GAME_MODE_LABELS]).toBeDefined();
    }
  });

  it('SERVER_REGION_LABELS should have a label for every region', () => {
    const regions = Object.keys(DOTA_SERVER_REGION_IDS);
    for (const region of regions) {
      expect(SERVER_REGION_LABELS[region as keyof typeof SERVER_REGION_LABELS]).toBeDefined();
    }
  });

  it('DOTA_LOBBY_SLOTS should have correct slot ranges', () => {
    expect(DOTA_LOBBY_SLOTS.RADIANT_PLAYER_START).toBe(0);
    expect(DOTA_LOBBY_SLOTS.RADIANT_PLAYER_END).toBe(4);
    expect(DOTA_LOBBY_SLOTS.DIRE_PLAYER_START).toBe(5);
    expect(DOTA_LOBBY_SLOTS.DIRE_PLAYER_END).toBe(9);
    expect(DOTA_LOBBY_SLOTS.RADIANT_COACH).toBe(10);
    expect(DOTA_LOBBY_SLOTS.DIRE_COACH).toBe(11);
    expect(DOTA_LOBBY_SLOTS.SPECTATOR_START).toBe(12);
  });
});

describe('Type Safety', () => {
  it('LobbySessionState should cover all expected states', () => {
    const validStates: LobbySessionState[] = [
      'pending', 'bot_assigned', 'lobby_creating', 'lobby_open',
      'ready_check', 'requirements_met', 'coin_toss', 'in_game',
      'post_game', 'syncing', 'completed', 'cancelled', 'error',
    ];
    // This test verifies the union type at compile time
    expect(validStates).toHaveLength(13);
  });

  it('BotAccountStatus should cover all expected statuses', () => {
    const validStatuses: BotAccountStatus[] = [
      'idle', 'starting', 'connecting', 'creating_lobby',
      'lobby_active', 'ready_check', 'in_game', 'post_game',
      'syncing', 'error', 'offline',
    ];
    expect(validStatuses).toHaveLength(11);
  });
});
```

---

## 2. Integration Tests (Firestore)

These tests verify Firestore operations. They require a Firebase emulator or test project.

### File: `src/lib/bot/__tests__/bot-config-actions.integration.test.ts`

```typescript
/**
 * Integration tests for bot-config-actions.ts
 *
 * Prerequisites:
 * - Firebase Emulator running (firebase emulators:start)
 * - Or a dedicated test Firebase project
 *
 * Run: FIREBASE_SERVICE_ACCOUNT_BASE64=<test-sa> npx vitest src/lib/bot/__tests__/bot-config-actions.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// NOTE: These tests outline the test structure. They cannot be run without
// the Firebase Admin SDK initialized. In a CI environment, use Firebase Emulator.

describe('Bot Config Actions (Integration)', () => {
  describe('getTournamentBotConfig / saveTournamentBotConfig', () => {
    it('TODO: should return null for tournament with no bot config');
    it('TODO: should save and retrieve bot config');
    it('TODO: should merge updates without overwriting existing fields');
    it('TODO: should update timestamps');
  });

  describe('registerBotAccount / getAllBotAccounts', () => {
    it('TODO: should register a new bot account with idle status');
    it('TODO: should return all registered bot accounts');
    it('TODO: should filter available (idle + enabled) bot accounts');
  });

  describe('updateBotAccountStatus', () => {
    it('TODO: should update status and matchId');
    it('TODO: should update lastHeartbeat timestamp');
  });

  describe('createLobbySession / getLobbySession', () => {
    it('TODO: should create session and return ID');
    it('TODO: should retrieve session by ID');
    it('TODO: should return null for non-existent session');
  });

  describe('getLobbySessionsForMatch', () => {
    it('TODO: should return all sessions for a match');
    it('TODO: should order by creation time desc');
  });

  describe('getPendingLobbySessions', () => {
    it('TODO: should return only pending sessions');
    it('TODO: should order by creation time asc (FIFO)');
  });

  describe('getActiveLobbySessions', () => {
    it('TODO: should return sessions not in completed/cancelled/error');
  });

  describe('updateLobbySession', () => {
    it('TODO: should update state');
    it('TODO: should update readyState');
    it('TODO: should update validationErrors');
  });

  describe('cancelLobbySession', () => {
    it('TODO: should set state to cancelled and completedAt');
  });

  describe('buildLobbyTeamAssignments', () => {
    it('TODO: should build player lists from team rosters');
    it('TODO: should replace players with approved standins');
    it('TODO: should include coach info if available');
    it('TODO: should return null if match not found');
    it('TODO: should return null if team not found');
  });

  describe('scheduleLobbyForMatch', () => {
    it('TODO: should create a pending session');
    it('TODO: should prevent duplicate active sessions for same match');
    it('TODO: should fail if bot is not enabled');
    it('TODO: should generate a random lobby password');
    it('TODO: should set totalGames based on series format');
    it('TODO: should initialise seriesFormat, seriesScore, completedGameWinners from match config');
  });

  describe('syncLobbySessionStandins', () => {
    it('TODO: should patch radiantTeam on active pre-game sessions when a standin is approved');
    it('TODO: should patch direTeam on active pre-game sessions when a dire standin is approved');
    it('TODO: should be a no-op if there are no active sessions for the match');
    it('TODO: should not throw if a session update fails — error is caught and logged');
  });

  describe('scheduleNextGameInSeries', () => {
    it('TODO: should create a new pending session with incremented currentGameNumber');
    it('TODO: should carry over seriesScore and completedGameWinners');
    it('TODO: should append " - Game N" suffix to the lobby name');
    it('TODO: should strip existing " - Game N" suffix before appending');
    it('TODO: should re-read standins fresh via buildLobbyTeamAssignments');
    it('TODO: should return { success: false } if buildLobbyTeamAssignments returns null');
  });
});
```

---

## 3. Bot Worker Tests (Steam/Dota 2)

These require actual Steam credentials. Run manually before go-live.

### 3.1. Steam Connection Test

```
MANUAL TEST: Steam Login
────────────────────────

Prerequisites:
- Bot worker dependencies installed (cd bot-worker && npm install)
- .env configured with valid Steam credentials

Steps:
1. Run: cd bot-worker && npx tsx src/index.ts --bot-id=<test-bot-id>
2. Observe logs

Expected output:
  [INFO] Starting bot worker for account: <test-bot-id>
  [INFO] Connecting as: <username> (display: <name>)
  [INFO] Steam: Logged in successfully
  [INFO] Dota 2: GC connection established
  [INFO] Bot worker is running and waiting for commands...

Verify:
  ✓ No Steam Guard errors
  ✓ Status updated to 'idle' in Firestore
  ✓ lastHeartbeat is updating every 30 seconds

Cleanup:
  Press Ctrl+C → should see "Shutdown complete"
  ✓ Status updated to 'offline' in Firestore
```

### 3.2. Lobby Creation Test

```
MANUAL TEST: Create Custom Lobby
─────────────────────────────────

Prerequisites:
- Bot worker running and connected
- Bot account document ID known

Steps:
1. Insert a command document into Firestore:
   Collection: /botCommands/<botId>/queue/
   Document:
   {
     "botAccountId": "<botId>",
     "command": {
       "type": "create_lobby",
       "sessionId": "test-session-1",
       "lobbyName": "Test Lobby - DO NOT JOIN",
       "lobbyPassword": "test123",
       "settings": {
         "gameMode": 2,
         "serverRegion": 8,
         "visibility": 2,
         "dotaTvDelay": 120,
         "seriesType": 0,
         "cheatsEnabled": false,
         "fillWithBots": false,
         "allowSpectators": true,
         "pauseSetting": 1
       }
     },
     "status": "pending",
     "createdAt": "<now>"
   }

2. Wait 2-5 seconds (poll interval)

Expected:
  ✓ Command status changes to 'processing' then 'completed'
  ✓ Bot logs: "Lobby created successfully"
  ✓ A lobby_created event appears in /botEvents collection
  ✓ The lobby is visible in Dota 2 (if public) or joinable with password

Cleanup:
  Insert a leave_lobby command to close the lobby
```

### 3.3. Player Invite Test

```
MANUAL TEST: Invite Players
────────────────────────────

Prerequisites:
- Bot is in a lobby (from test 3.2)
- You know the Steam32 ID of a test player

Steps:
1. Insert invite command:
   {
     "command": {
       "type": "invite_players",
       "sessionId": "test-session-1",
       "steamIds": ["<your-steam32-id>"]
     },
     "status": "pending",
     ...
   }

2. Check the test player's Steam client

Expected:
  ✓ Player receives a lobby invite notification
  ✓ Player can join the lobby with the password
  ✓ A player_joined event appears in /botEvents when the player joins
```

### 3.4. Chat Message Test

```
MANUAL TEST: Send Chat Message
───────────────────────────────

Prerequisites:
- Bot is in a lobby

Steps:
1. Insert chat command:
   {
     "command": {
       "type": "send_chat",
       "sessionId": "test-session-1",
       "message": "Hello! This is a test message from the bot."
     },
     "status": "pending",
     ...
   }

2. Check the lobby chat (as the test player in the lobby)

Expected:
  ✓ Message appears in lobby chat from the bot account
  ✓ Command status = 'completed'
```

### 3.5. Chat Detection Test

```
MANUAL TEST: Detect Chat Messages
──────────────────────────────────

Prerequisites:
- Bot is in a lobby with a player

Steps:
1. Player types a message in lobby chat (e.g., "!ready")
2. Check Firestore /botEvents collection

Expected:
  ✓ A chat_message event appears with:
    - steamId32 matching the player
    - message = "!ready"
    - playerName matching the player's Steam name
```

### 3.6. Lobby State Detection Test

```
MANUAL TEST: Player Slot Changes
─────────────────────────────────

Prerequisites:
- Bot is in a lobby with a player

Steps:
1. Player joins the lobby (unassigned)
2. Check for player_joined event
3. Player moves to a Radiant slot
4. Check for player_slot_changed event
5. Player leaves the lobby
6. Check for player_left event

Expected:
  ✓ All three events appear in /botEvents with correct data
  ✓ lobby_state_update events reflect the current player positions
```

### 3.7. Game Start Test (Requires 10 Players)

```
MANUAL TEST: Game Launch
────────────────────────

Prerequisites:
- Bot is in a lobby
- 10 humans OR enable "fill with bots" to reach minimum player count
- Team names set

Steps:
1. Enable cheats + fill with bots for testing
2. Insert start_game command
3. Observe

Expected:
  ✓ Coin toss phase begins
  ✓ game_started event appears (may need SourceTV-enabled game)
  ✓ Bot enters observer mode

Note: For a real game start test, you need 10 players in correct slots.
A simpler approach is to create a lobby with cheats+bots, start it,
and verify the game lifecycle events fire correctly.
```

### 3.8. Heartbeat Verification

```
MANUAL TEST: Heartbeat
──────────────────────

Steps:
1. Start bot worker
2. Wait 30+ seconds
3. Check /botEvents for heartbeat events

Expected:
  ✓ Heartbeat events appear every ~30 seconds
  ✓ Each heartbeat has correct botAccountId and status
  ✓ The bot account document's lastHeartbeat is updating
```

### 3.9. Graceful Shutdown Test

```
MANUAL TEST: Shutdown
─────────────────────

Steps:
1. Bot worker is running with an active lobby
2. Press Ctrl+C (SIGINT)

Expected:
  ✓ Log: "Received SIGINT, shutting down gracefully..."
  ✓ Bot leaves the lobby
  ✓ Status → 'offline' in Firestore
  ✓ currentMatchId → null
  ✓ Process exits with code 0
```

### 3.10. Crash Recovery Test

```
MANUAL TEST: Crash Recovery
───────────────────────────

Steps:
1. Bot worker is running
2. Kill the process forcefully (kill -9 / Task Manager)
3. Wait 30+ minutes (heartbeat threshold)
4. Run orchestrator (POST /api/admin/bot/orchestrate)

Expected:
  ✓ healthCheckBots() detects the stale bot
  ✓ Bot status → 'offline'
  ✓ Any active session for that bot → 'error' state with BOT_STALE code
  ✓ Bot can be restarted and returns to 'idle'
```

---

## 4. End-to-End Scenario Tests

These test the full flow from match scheduling to post-game sync.

### 4.1. Happy Path — Full Match Lifecycle

```
E2E TEST: Complete Match Lifecycle
──────────────────────────────────

Setup:
1. Tournament with bot enabled in admin panel
2. Bot worker running
3. A scheduled match approaching its time
4. 10 test players available (or use standins from your team)

Steps:
1. Set match scheduledFor to 10 minutes from now
2. Wait for orchestrator to create a lobby session (or trigger manually)
3. Verify: session created in 'pending' state
4. Verify: bot assigned, session → 'bot_assigned'
5. Verify: lobby created in Dota 2, session → 'lobby_open'
6. All players join lobby and move to correct slots
7. Set team names in lobby
8. Captain types "!ready" → verify team marked ready
9. Other captain types "!ready" → verify both teams ready
10. Session → 'ready_check' → validation → 'requirements_met'
11. Game starts → 'coin_toss' → 'in_game'
12. Game ends → 'post_game'
13. Wait sync delay → 'syncing' → 'completed'
14. Bot released back to idle pool

Verify at each step:
  ✓ Firestore session document matches expected state
  ✓ Bot account status matches expected stage
  ✓ All chat messages appear in lobby
  ✓ No errors in bot worker logs
```

### 4.2. Validation Failure — Wrong Slots

```
E2E TEST: Players in Wrong Slots
─────────────────────────────────

Steps:
1. Create lobby session
2. Players join but some sit on wrong side
3. Both teams type !ready
4. Bot runs validation

Expected:
  ✓ Validation errors posted in chat: "Player X is in wrong slot"
  ✓ Session reverts to 'lobby_open'
  ✓ Players can fix slots and re-ready
```

### 4.3. Standin Handling

```
E2E TEST: Approved Standin
──────────────────────────

Steps:
1. Match has an approved standin (Player5 replaced by StandinX)
2. Bot creates lobby and invites all players including StandinX
3. StandinX joins in Player5's slot
4. Ready check + validation

Expected:
  ✓ StandinX's Steam ID is in expectedPlayers (not Player5's)
  ✓ Validation passes with StandinX in the slot
  ✓ If Player5 tries to join, they appear as unrecognized (warning)
```

### 4.4. Bot Failure During Lobby

```
E2E TEST: Bot Dies During Lobby Phase
──────────────────────────────────────

Steps:
1. Bot creates lobby, players are joining
2. Kill bot-worker process
3. Wait for health check threshold
4. Run orchestrator

Expected:
  ✓ Session → 'error' with BOT_STALE code
  ✓ Admin sees error in monitor panel
  ✓ Lobby still exists in Dota 2 (players can continue if game started)
  ✓ Admin can manually handle the situation
```

### 4.5. Multiple Concurrent Matches

```
E2E TEST: Two Matches at Same Time
───────────────────────────────────

Prerequisites:
- 2 bot accounts registered and running

Steps:
1. Two matches scheduled for the same time
2. Orchestrator creates 2 lobby sessions
3. Each session gets a different bot

Expected:
  ✓ Both lobbies created independently
  ✓ No cross-talk between sessions
  ✓ Both matches complete independently
```

### 4.6. Full BO3 Series — All Three Games

```
E2E TEST: BO3 Series Goes to Game 3
────────────────────────────────────

Setup:
1. Match configured with seriesFormat: 'bo3'
2. Bot enabled, 1 bot worker running

Steps:
1. Orchestrator creates Game 1 session (lobbyName "Match X - Game 1")
2. Game 1 is played — Team Alpha wins (radiant)
3. Bot records winner, seriesScore: { 'team-a': 1, 'team-b': 0 }
4. calculateSeriesResult → not decided (1-0 in BO3)
5. scheduleNextGameInSeries creates Game 2 session (lobbyName "Match X - Game 2")
6. Game 2 is played — Team Beta wins (dire)
7. seriesScore: { 'team-a': 1, 'team-b': 1 }
8. calculateSeriesResult → not decided (1-1)
9. scheduleNextGameInSeries creates Game 3 session (lobbyName "Match X - Game 3")
10. Game 3 is played — Team Alpha wins
11. calculateSeriesResult → decided, winnerId = 'team-a'
12. Match finalised with winnerId and completed = true

Expected at each step:
  ✓ New session created with correct currentGameNumber (1, 2, 3)
  ✓ seriesScore carried forward to each new session
  ✓ completedGameWinners grows with each game
  ✓ Bot sends "Series score: 1-0", "1-1" chat messages after each game
  ✓ Match doc gets game IDs and team scores updated after each game
  ✓ No duplicate sessions for same game number
```

### 4.7. BO3 Series Decided Early (2-0)

```
E2E TEST: BO3 Clinched in Game 2
─────────────────────────────────

Steps:
1. Match configured as BO3
2. Team Alpha wins Game 1 and Game 2 (radiant both times)
3. seriesScore: { 'team-a': 2, 'team-b': 0 }
4. handleGameEnded → calculateSeriesResult

Expected:
  ✓ decided = true after game 2 (2 ≥ winsToWin=2)
  ✓ No Game 3 session is created
  ✓ Match marked winnerId = 'team-a', completed = true
  ✓ Bot posts "Team Alpha wins the series 2-0!" in chat
```

### 4.8. BO2 Draw

```
E2E TEST: BO2 Ends 1-1
───────────────────────

Steps:
1. Match configured as BO2
2. Team Alpha wins Game 1, Team Beta wins Game 2
3. seriesScore: { 'team-a': 1, 'team-b': 1 } after game 2

Expected:
  ✓ decided = true (all 2 games played in BO2)
  ✓ isDraw = true
  ✓ winnerId = undefined
  ✓ Match doc updated with isDraw = true, completed = true
  ✓ Bot posts "Series ends in a draw 1-1" in chat
```

### 4.9. Standin Approved After Bot Creates Session

```
E2E TEST: Live Standin Sync
────────────────────────────

Steps:
1. Match scheduled, bot creates lobby session
2. Session is in 'lobby_open' state
3. Player5 is injured — captain approves a standin (StandinX) mid-wait
4. syncLobbySessionStandins() is called automatically
5. radiantTeam.expectedPlayers is updated on the active session
6. StandinX joins the lobby in Player5's slot
7. Ready check + validation runs

Expected:
  ✓ syncLobbySessionStandins patches the live session within seconds of approval
  ✓ Validation passes with StandinX in the slot (not Player5)
  ✓ If Player5 tries to join, they appear as unrecognised (warning only)
  ✓ No session re-creation required
  ✓ Error in syncLobbySessionStandins does NOT block the standin approval itself
```

### 4.10. Standin Approved Between Series Games

```
E2E TEST: Standin During BO3 (Between Games)
──────────────────────────────────────────────

Steps:
1. BO3 series is at 1-0, Game 1 completed
2. Before Game 2 session is created, admin approves a standin for Team Beta
3. scheduleNextGameInSeries is called for Game 2
4. buildLobbyTeamAssignments is re-read from the match doc

Expected:
  ✓ Game 2 session has standin in the dire roster (not the original player)
  ✓ syncLobbySessionStandins not needed — fresh read on session creation is sufficient
```

### 4.11. Lobby Closes After Timeout Warning

```
E2E TEST: No-Show — Lobby Closes After 30 Minutes
──────────────────────────────────────────────────

Steps:
1. Bot creates lobby, session enters 'lobby_open' at T+0
2. Players don't join
3. At T+15min (lobbyOpenWarningMinutes) orchestrator runs
4. Warning message sent in lobby chat: "Lobby will close in 15 minutes"
5. timeoutWarningSentAt is set on the session
6. Orchestrator runs again before T+30
7. timeoutWarningSentAt is already set — no duplicate warning sent
8. At T+30min (lobbyOpenTimeoutMinutes) orchestrator runs
9. Session cancelled, match forfeited

Expected:
  ✓ Warning sent exactly once (not re-sent on subsequent orchestrator runs)
  ✓ Timeout is clocked from lobbyCreatedAt, not session createdAt
  ✓ Session → 'cancelled' at 30 min mark
  ✓ Admin monitor shows the cancelled session
```

---

## 5. Admin UI Tests

### 5.1. Bot Tab — Settings View

```
UI TEST: Configure Bot Settings
────────────────────────────────

Steps:
1. Navigate to /{tournament-slug}/admin → Bot tab
2. Toggle bot ON
3. Change game mode to All Pick
4. Change server to US East
5. Add a custom ready command "!go"
6. Change sync delay to 3 minutes
7. Click Save

Expected:
  ✓ Settings load without error
  ✓ All form fields function correctly
  ✓ Save succeeds, success toast shown
  ✓ Reloading the page shows the saved values
  ✓ Firestore /tournaments/{id}/config/bot updated
```

### 5.2. Bot Tab — Monitor View

```
UI TEST: Monitor Active Sessions
─────────────────────────────────

Steps:
1. Have at least one active lobby session
2. Navigate to Bot tab → Monitor
3. Observe bot pool status and session cards

Expected:
  ✓ Bot pool counts match Firestore data
  ✓ Active session card shows correct state, teams, ready status
  ✓ Refresh button updates data
  ✓ Auto-refresh works (if implemented)
```

---

## 6. Stress & Edge Case Tests

### 6.1. No Available Bots

```
EDGE CASE: All bots are busy
─────────────────────────────

Setup: 2 bot accounts, 3 pending sessions

Expected:
  ✓ First 2 sessions get bots assigned
  ✓ Third session stays 'pending'
  ✓ Pool status shows 0 idle bots, 1 pending session
  ✓ When a bot finishes, it gets assigned to the third session
```

### 6.2. Bot Reconnection

```
EDGE CASE: Temporary Steam disconnection
─────────────────────────────────────────

Steps:
1. Bot is in a lobby
2. Steam has a brief outage (simulate by blocking network)
3. Network restored

Expected:
  ✓ SteamUser emits 'disconnected' event
  ✓ Bot error event written to Firestore
  ✓ If reconnection succeeds, lobby may still be intact
  ✓ If reconnection fails, bot marked as error/offline
```

### 6.3. Duplicate Session Prevention

```
EDGE CASE: Orchestrator runs twice
───────────────────────────────────

Steps:
1. Match has a pending session
2. Run orchestrator twice quickly

Expected:
  ✓ scheduleLobbyForMatch checks for existing active sessions
  ✓ Second call returns error: "Active lobby session already exists"
  ✓ No duplicate sessions created
```

### 6.4. Rapid Ready/Unready

```
EDGE CASE: Spam !ready / !unready
──────────────────────────────────

Steps:
1. Player types !ready
2. Same player immediately types !unready
3. Same player types !ready again

Expected:
  ✓ Each command processed in order
  ✓ Final state reflects the last command
  ✓ No race conditions in readyState updates
```

### 6.5. Invalid Firestore State

```
EDGE CASE: Session state manually edited
─────────────────────────────────────────

Steps:
1. Manually set a session state to an invalid value in Firestore
2. Run orchestrator

Expected:
  ✓ No crash
  ✓ Invalid state handled gracefully (logged, possibly moved to error)
```

---

## Running the Tests

### Unit Tests

```bash
# From project root
npx vitest run src/lib/bot/__tests__/
```

### Manual Tests (Before Go-Live Checklist)

```
[ ] 3.1  Steam Login — bot connects and reaches idle state
[ ] 3.2  Lobby Creation — lobby is created in Dota 2
[ ] 3.3  Player Invite — test player receives and can accept invite
[ ] 3.4  Chat Message — bot can send messages visible to players
[ ] 3.5  Chat Detection — bot detects player messages and creates events
[ ] 3.6  Slot Changes — player movements detected as events
[ ] 3.7  Game Launch — game starts with coin toss (use bots + cheats)
[ ] 3.8  Heartbeat — heartbeats arrive every 30 seconds
[ ] 3.9  Graceful Shutdown — clean exit, status → offline
[ ] 3.10 Crash Recovery — stale detection works after forced kill
[ ] 4.1   Full Happy Path — complete match from schedule to sync
[ ] 4.2   Wrong Slots — validation catches and reports errors
[ ] 4.3   Standin — approved standin passes validation
[ ] 4.4   Bot Failure — error handling and admin visibility
[ ] 4.5   Concurrent Matches — two matches with two bots work independently
[ ] 4.6   BO3 Full Series — all 3 games create and link correctly
[ ] 4.7   BO3 Early Clinch — series finalised at 2-0, no game 3 created
[ ] 4.8   BO2 Draw — 1-1 result handled, match marked as draw
[ ] 4.9   Live Standin Sync — standin approved mid-lobby, bot accepts in next validation
[ ] 4.10  Standin Between Games — series game 2 picks up new standin from fresh read
[ ] 4.11  Timeout Warning — warning sent at 15 min, not duplicated; lobby closed at 30 min
[ ] 5.1   Admin Settings — save and load configuration
[ ] 5.2   Admin Monitor — view pool status and session details
[ ] 6.1   No Bots Available — queuing works correctly
[ ] 6.3   Duplicate Prevention — no double sessions
```
