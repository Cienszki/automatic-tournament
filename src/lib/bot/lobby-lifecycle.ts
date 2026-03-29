// src/lib/bot/lobby-lifecycle.ts
// Lobby lifecycle management — state machine for lobby sessions
// This module handles the logic of validating lobby state, checking requirements,
// and transitioning between lobby states. It does NOT directly interact with the
// Dota 2 client — that's handled by the bot agent (bot-agent.ts).

import type {
  LobbySession,
  LobbySessionState,
  TournamentBotConfig,
  LobbyTeamAssignment,
  LobbyEnforcementConfig,
  LobbyWhitelistEntry,
} from '@/types/lobby-bot';

// ─── Lobby Player Slot Info (from Dota 2 GC) ───────────────────────────────

export interface LobbySlotInfo {
  slotIndex: number;
  steamId32: string;
  teamSide: 'radiant' | 'dire' | 'spectator' | 'unassigned';
  heroId?: number;
}

export interface LobbyStateSnapshot {
  /** Players currently in lobby with their slot assignments */
  players: LobbySlotInfo[];
  /** Team name set for Radiant side (empty string if not set) */
  radiantTeamName: string;
  /** Team name set for Dire side (empty string if not set) */
  direTeamName: string;
  /** Whether the lobby is in-game */
  isInGame: boolean;
  /** Whether the game has ended */
  gameEnded: boolean;
  /** Dota 2 match ID (once game starts) */
  dotaMatchId?: number;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that all lobby requirements are met before the match can start.
 *
 * Requirements:
 * 1. Team names must be set for both Radiant and Dire (not empty)
 * 2. Each expected player must be in a slot on their assigned side
 * 3. No unauthorized players in team slots
 */
export function validateLobbyRequirements(
  session: LobbySession,
  snapshot: LobbyStateSnapshot
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check team names are set
  if (!snapshot.radiantTeamName || snapshot.radiantTeamName.trim() === '') {
    errors.push('Radiant team name is not set. A team name must be set to start the game.');
  }
  if (!snapshot.direTeamName || snapshot.direTeamName.trim() === '') {
    errors.push('Dire team name is not set. A team name must be set to start the game.');
  }

  // 2. Check Radiant players
  const radiantSlots = snapshot.players.filter((p) => p.teamSide === 'radiant');
  const direSlots = snapshot.players.filter((p) => p.teamSide === 'dire');

  const radiantExpectedIds = new Set(
    session.radiantTeam.expectedPlayers.map((p) => p.steamId32)
  );
  const direExpectedIds = new Set(
    session.direTeam.expectedPlayers.map((p) => p.steamId32)
  );

  // Check that every expected Radiant player is in a Radiant slot
  for (const expected of session.radiantTeam.expectedPlayers) {
    const inSlot = radiantSlots.find((s) => s.steamId32 === expected.steamId32);
    if (!inSlot) {
      const inWrongSlot = direSlots.find((s) => s.steamId32 === expected.steamId32);
      if (inWrongSlot) {
        errors.push(
          `${expected.nickname} (${session.radiantTeam.teamName}) is in a DIRE slot but should be on RADIANT side.`
        );
      } else {
        errors.push(
          `${expected.nickname} (${session.radiantTeam.teamName}) is not in a Radiant player slot.`
        );
      }
    }
  }

  // Check that every expected Dire player is in a Dire slot
  for (const expected of session.direTeam.expectedPlayers) {
    const inSlot = direSlots.find((s) => s.steamId32 === expected.steamId32);
    if (!inSlot) {
      const inWrongSlot = radiantSlots.find((s) => s.steamId32 === expected.steamId32);
      if (inWrongSlot) {
        errors.push(
          `${expected.nickname} (${session.direTeam.teamName}) is in a RADIANT slot but should be on DIRE side.`
        );
      } else {
        errors.push(
          `${expected.nickname} (${session.direTeam.teamName}) is not in a Dire player slot.`
        );
      }
    }
  }

  // 3. Check for unauthorized players in team slots
  for (const slot of radiantSlots) {
    if (
      !radiantExpectedIds.has(slot.steamId32) &&
      slot.steamId32 !== session.radiantTeam.coachSteamId32
    ) {
      warnings.push(
        `Unknown player (Steam32: ${slot.steamId32}) is in a Radiant slot but is not on the expected roster.`
      );
    }
  }
  for (const slot of direSlots) {
    if (
      !direExpectedIds.has(slot.steamId32) &&
      slot.steamId32 !== session.direTeam.coachSteamId32
    ) {
      warnings.push(
        `Unknown player (Steam32: ${slot.steamId32}) is in a Dire slot but is not on the expected roster.`
      );
    }
  }

  // 4. Check minimum player counts (5v5)
  if (radiantSlots.length < 5) {
    errors.push(
      `Radiant has only ${radiantSlots.length}/5 players in slots.`
    );
  }
  if (direSlots.length < 5) {
    errors.push(
      `Dire has only ${direSlots.length}/5 players in slots.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Chat Message Formatting ────────────────────────────────────────────────

/**
 * Format the team assignment message with actual team names
 */
export function formatTeamAssignmentMessage(
  template: string,
  radiantTeamName: string,
  direTeamName: string
): string {
  return template
    .replace('{radiant_team}', radiantTeamName)
    .replace('{dire_team}', direTeamName);
}

/**
 * Format validation errors into a chat message
 */
export function formatValidationErrors(
  prefix: string,
  errors: string[]
): string[] {
  const messages: string[] = [prefix];
  errors.forEach((error, index) => {
    messages.push(`${index + 1}. ${error}`);
  });
  return messages;
}

// ─── Ready Check Logic ──────────────────────────────────────────────────────

/**
 * Determine which team a player belongs to based on their Steam ID
 */
export function identifyPlayerTeam(
  session: LobbySession,
  steamId32: string
): 'radiant' | 'dire' | null {
  const isRadiant = session.radiantTeam.expectedPlayers.some(
    (p) => p.steamId32 === steamId32
  );
  if (isRadiant) return 'radiant';

  const isDire = session.direTeam.expectedPlayers.some(
    (p) => p.steamId32 === steamId32
  );
  if (isDire) return 'dire';

  return null;
}

/**
 * Check if a chat message is a ready command
 */
export function isReadyCommand(
  message: string,
  readyCommands: string[]
): boolean {
  const normalized = message.trim().toLowerCase();
  return readyCommands.some((cmd) => normalized === cmd.toLowerCase());
}

/**
 * Check if a chat message is an unready command
 */
export function isUnreadyCommand(
  message: string,
  unreadyCommands: string[]
): boolean {
  const normalized = message.trim().toLowerCase();
  return unreadyCommands.some((cmd) => normalized === cmd.toLowerCase());
}

// ─── State Machine Transitions ──────────────────────────────────────────────

/** Valid state transitions */
const VALID_TRANSITIONS: Record<LobbySessionState, LobbySessionState[]> = {
  pending: ['bot_assigned', 'cancelled', 'error'],
  bot_assigned: ['lobby_creating', 'cancelled', 'error'],
  lobby_creating: ['lobby_open', 'error'],
  lobby_open: ['ready_check', 'cancelled', 'error'],
  ready_check: ['lobby_open', 'requirements_met', 'error'],
  requirements_met: ['coin_toss', 'lobby_open', 'error'],
  coin_toss: ['in_game', 'error'],
  in_game: ['post_game', 'error'],
  post_game: ['syncing', 'error'],
  syncing: ['completed', 'error'],
  completed: [],
  cancelled: [],
  error: ['pending'], // Can retry from error
};

/**
 * Validate a state transition
 */
export function isValidTransition(
  from: LobbySessionState,
  to: LobbySessionState
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get all possible next states from the current state
 */
export function getNextStates(current: LobbySessionState): LobbySessionState[] {
  return VALID_TRANSITIONS[current] || [];
}

// ─── Lobby Session Lifecycle Events ─────────────────────────────────────────

export interface LobbyEvent {
  type: LobbyEventType;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type LobbyEventType =
  | 'session_created'
  | 'bot_assigned'
  | 'lobby_created'
  | 'player_joined'
  | 'player_left'
  | 'player_moved_slot'
  | 'team_name_set'
  | 'ready_declared'
  | 'ready_cancelled'
  | 'validation_passed'
  | 'validation_failed'
  | 'lobby_started'     // First "start" = coin toss
  | 'game_started'      // After coin toss, game actually begins
  | 'game_ended'
  | 'sync_triggered'
  | 'sync_completed'
  | 'session_completed'
  | 'session_cancelled'
  | 'error_occurred';

// ─── Enforcement Logic ──────────────────────────────────────────────────────

export interface EnforcementAction {
  /** Steam32 IDs to kick from the lobby */
  kickPlayers: Array<{ steamId32: string; reason: string }>;
  /** Steam32 IDs to reinvite after kicking (registered players kicked for wrong slot) */
  reinvitePlayers: string[];
  /** Messages to post in lobby chat */
  chatMessages: string[];
  /** Updated wrong-slot warning timestamps to persist */
  updatedWrongSlotWarnings: Record<string, string>;
}

/**
 * Get all Steam32 IDs that are authorized to be in this lobby.
 * Includes both teams' players, coaches, and any tournament-level whitelist entries
 * (commentators, observers, admins).
 */
export function getAllAuthorizedSteamIds(
  session: LobbySession,
  whitelist: LobbyWhitelistEntry[] = []
): Set<string> {
  const authorized = new Set<string>();

  for (const player of session.radiantTeam.expectedPlayers) {
    authorized.add(player.steamId32);
  }
  for (const player of session.direTeam.expectedPlayers) {
    authorized.add(player.steamId32);
  }

  if (session.radiantTeam.coachSteamId32) {
    authorized.add(session.radiantTeam.coachSteamId32);
  }
  if (session.direTeam.coachSteamId32) {
    authorized.add(session.direTeam.coachSteamId32);
  }

  // Tournament-level whitelist: commentators, observers, admins
  for (const entry of whitelist) {
    authorized.add(entry.steamId32);
  }

  return authorized;
}

/**
 * Get the correct team side for a given Steam32 ID.
 * Returns 'radiant', 'dire', or null if not a player (e.g., coach).
 */
export function getExpectedTeamSide(
  session: LobbySession,
  steamId32: string
): 'radiant' | 'dire' | null {
  const isRadiantPlayer = session.radiantTeam.expectedPlayers.some(
    (p) => p.steamId32 === steamId32
  );
  if (isRadiantPlayer) return 'radiant';

  const isDirePlayer = session.direTeam.expectedPlayers.some(
    (p) => p.steamId32 === steamId32
  );
  if (isDirePlayer) return 'dire';

  return null;
}

/**
 * Get the nickname for a Steam32 ID from the session's expected players.
 */
function getPlayerNickname(session: LobbySession, steamId32: string): string {
  const rPlayer = session.radiantTeam.expectedPlayers.find(
    (p) => p.steamId32 === steamId32
  );
  if (rPlayer) return rPlayer.nickname;

  const dPlayer = session.direTeam.expectedPlayers.find(
    (p) => p.steamId32 === steamId32
  );
  if (dPlayer) return dPlayer.nickname;

  return steamId32;
}

/**
 * Evaluate lobby enforcement rules against the current lobby state.
 * Returns a list of kicks, reinvites, and chat messages to execute.
 *
 * Called every time a lobby_state_update event is received.
 */
export function evaluateEnforcement(
  session: LobbySession,
  players: LobbySlotInfo[],
  config: LobbyEnforcementConfig,
  whitelist: LobbyWhitelistEntry[] = []
): EnforcementAction {
  const action: EnforcementAction = {
    kickPlayers: [],
    reinvitePlayers: [],
    chatMessages: [],
    updatedWrongSlotWarnings: { ...(session.wrongSlotWarnings || {}) },
  };

  const authorized = getAllAuthorizedSteamIds(session, whitelist);
  const now = Date.now();

  for (const player of players) {
    const { steamId32, teamSide } = player;

    // Skip the bot itself or empty slots
    if (!steamId32 || steamId32 === '0') continue;

    const isAuthorized = authorized.has(steamId32);
    const isInTeamSlot = teamSide === 'radiant' || teamSide === 'dire';
    const isSpectator = teamSide === 'spectator';
    const isUnassigned = teamSide === 'unassigned';

    // ── 1. Unauthorized player in any slot → kick ──
    if (!isAuthorized && config.autoKickUnauthorized) {
      if (isInTeamSlot || isSpectator) {
        action.kickPlayers.push({
          steamId32,
          reason: 'not_registered',
        });
        action.chatMessages.push(
          `Player (Steam32: ${steamId32}) is not registered for this match and has been removed.`
        );
        // Clean up any warning for this player
        delete action.updatedWrongSlotWarnings[steamId32];
        continue;
      }
      // Unassigned unauthorized players — kick too
      if (isUnassigned) {
        action.kickPlayers.push({
          steamId32,
          reason: 'not_registered',
        });
        continue;
      }
    }

    // ── 2. Authorized player in wrong team slot → warn, then kick + reinvite ──
    if (isAuthorized && isInTeamSlot && config.autoKickWrongSlot) {
      const expectedSide = getExpectedTeamSide(session, steamId32);

      // Coaches are allowed on their team's side without being expected players
      if (
        expectedSide !== null &&
        expectedSide !== teamSide
      ) {
        const existingWarning = action.updatedWrongSlotWarnings[steamId32];

        if (!existingWarning) {
          // First offense: warn the player
          const nickname = getPlayerNickname(session, steamId32);
          const correctTeam = expectedSide === 'radiant'
            ? session.radiantTeam.teamName
            : session.direTeam.teamName;
          action.chatMessages.push(
            `${nickname}: You are on the wrong side! Please move to ${correctTeam} (${expectedSide.toUpperCase()}).`
          );
          action.updatedWrongSlotWarnings[steamId32] = new Date().toISOString();
        } else {
          // Already warned — check if grace period expired
          const warnedAt = new Date(existingWarning).getTime();
          const elapsed = (now - warnedAt) / 1000;

          if (elapsed >= config.wrongSlotGracePeriodSeconds) {
            const nickname = getPlayerNickname(session, steamId32);
            action.kickPlayers.push({
              steamId32,
              reason: 'wrong_slot',
            });
            action.reinvitePlayers.push(steamId32);
            action.chatMessages.push(
              `${nickname} was removed for being in the wrong team slot. A new invite has been sent.`
            );
            // Reset warning so they get a fresh grace period if they do it again
            delete action.updatedWrongSlotWarnings[steamId32];
          }
        }
      } else {
        // Player is on the correct side — clear any existing warning
        if (action.updatedWrongSlotWarnings[steamId32]) {
          delete action.updatedWrongSlotWarnings[steamId32];
        }
      }
    }
  }

  return action;
}

/**
 * Check whether a player's ready/unready command should be accepted based on cooldown.
 * Returns true if the command should be processed, false if it should be ignored.
 */
export function isReadyCommandAllowed(
  session: LobbySession,
  steamId32: string,
  cooldownSeconds: number
): boolean {
  if (cooldownSeconds <= 0) return true;

  const lastUsed = session.readyCooldowns?.[steamId32];
  if (!lastUsed) return true;

  const elapsed = (Date.now() - new Date(lastUsed).getTime()) / 1000;
  return elapsed >= cooldownSeconds;
}

// ─── Series Management Logic ────────────────────────────────────────────────

export interface SeriesResult {
  /** Whether the series has been conclusively decided */
  decided: boolean;
  /** Winning team ID (null for BO2 draws) */
  winnerId: string | null;
  /** Whether the result is a draw (only possible in BO2 1-1) */
  isDraw: boolean;
  /** Current score: { teamId: wins } */
  score: Record<string, number>;
  /** Number of games played */
  gamesPlayed: number;
  /** Maximum number of games in the format */
  maxGames: number;
  /** How many wins are needed to clinch (for elimination formats) */
  winsToWin: number;
}

/**
 * How many wins clinch the series for each format.
 * BO2 is special: never "clinched" by wins — all 2 games are always played.
 */
function getWinsToWin(seriesFormat: 'bo1' | 'bo2' | 'bo3' | 'bo5'): number {
  switch (seriesFormat) {
    case 'bo1': return 1;
    case 'bo2': return Infinity; // BO2 always plays both games
    case 'bo3': return 2;
    case 'bo5': return 3;
  }
}

/**
 * Calculate the series result given the current session state.
 * Call this after recording a game result to decide whether to continue.
 */
export function calculateSeriesResult(session: LobbySession): SeriesResult {
  const { seriesFormat, totalGames, seriesScore, completedGameIds, radiantTeam, direTeam } = session;
  const winsToWin = getWinsToWin(seriesFormat);

  const radiantWins = seriesScore[radiantTeam.teamId] || 0;
  const direWins = seriesScore[direTeam.teamId] || 0;
  const gamesPlayed = completedGameIds.length;

  const result: SeriesResult = {
    decided: false,
    winnerId: null,
    isDraw: false,
    score: { ...seriesScore },
    gamesPlayed,
    maxGames: totalGames,
    winsToWin,
  };

  // Check if one team has clinched (BO1, BO3, BO5)
  if (radiantWins >= winsToWin) {
    result.decided = true;
    result.winnerId = radiantTeam.teamId;
    return result;
  }
  if (direWins >= winsToWin) {
    result.decided = true;
    result.winnerId = direTeam.teamId;
    return result;
  }

  // BO2 special case: series ends after exactly 2 games
  if (seriesFormat === 'bo2' && gamesPlayed >= 2) {
    result.decided = true;
    if (radiantWins > direWins) {
      result.winnerId = radiantTeam.teamId;
    } else if (direWins > radiantWins) {
      result.winnerId = direTeam.teamId;
    } else {
      result.isDraw = true;
      result.winnerId = null;
    }
    return result;
  }

  // Check if all games have been played (shouldn't happen for BO3/BO5 but safety)
  if (gamesPlayed >= totalGames) {
    result.decided = true;
    if (radiantWins > direWins) {
      result.winnerId = radiantTeam.teamId;
    } else if (direWins > radiantWins) {
      result.winnerId = direTeam.teamId;
    } else {
      result.isDraw = true;
    }
    return result;
  }

  return result; // Not decided yet — more games to play
}

/**
 * Determine if the series needs another game.
 * Returns the next game number, or null if the series is complete.
 */
export function getNextGameNumber(session: LobbySession): number | null {
  const result = calculateSeriesResult(session);
  if (result.decided) return null;
  return session.completedGameIds.length + 1;
}

/**
 * Format a human-readable series score string.
 * Example: "Team Alpha 2 - 1 Team Beta"
 */
export function formatSeriesScore(session: LobbySession): string {
  const radiantWins = session.seriesScore[session.radiantTeam.teamId] || 0;
  const direWins = session.seriesScore[session.direTeam.teamId] || 0;
  return `${session.radiantTeam.teamName} ${radiantWins} - ${direWins} ${session.direTeam.teamName}`;
}
