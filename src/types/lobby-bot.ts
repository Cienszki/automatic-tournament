// src/types/lobby-bot.ts
// Type definitions for the Dota 2 Lobby Bot system

/**
 * Bot account credentials stored securely (never exposed to client)
 */
export interface BotAccount {
  id: string;
  username: string;
  /** Encrypted Steam login password — only used server-side */
  encryptedPassword: string;
  steamId: string;
  steamId32: string;
  displayName: string;
  /** Whether the account is enabled and available for assignment */
  enabled: boolean;
  /** Current status of the bot instance */
  status: BotAccountStatus;
  /** The match this bot is currently assigned to (null if idle) */
  currentMatchId: string | null;
  /** The tournament this bot is currently serving */
  currentTournamentId: string | null;
  /** Timestamp of last activity */
  lastHeartbeat: string | null;
  /** Additional notes (admin-only) */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BotAccountStatus =
  | 'idle'           // Available for assignment
  | 'starting'       // Bot process is launching
  | 'connecting'     // Connecting to Steam/Dota 2
  | 'creating_lobby' // Creating the lobby
  | 'lobby_active'   // Lobby is open, waiting for players
  | 'ready_check'    // Both teams declared ready, validating
  | 'in_game'        // Match is live
  | 'post_game'      // Match ended, waiting before sync
  | 'syncing'        // Triggering match sync
  | 'error'          // Something went wrong
  | 'offline';       // Bot process is not running

/**
 * Per-tournament bot configuration set by tournament admins
 */
export interface TournamentBotConfig {
  /** Whether the bot system is enabled for this tournament */
  enabled: boolean;

  /** Lobby settings */
  lobby: LobbySettings;

  /** Ready check configuration */
  readyCheck: ReadyCheckConfig;

  /** Chat messages the bot posts in the lobby */
  chatMessages: LobbyChatConfig;

  /** Post-match behavior */
  postMatch: PostMatchConfig;

  /** Lobby enforcement & security */
  enforcement: LobbyEnforcementConfig;

  /** How many minutes before scheduled time the bot creates the lobby */
  lobbyCreationLeadMinutes: number;

  /**
   * How long a session can stay in 'pending' (no bot available) before being cancelled.
   * Default: 20 minutes.
   */
  pendingSessionTimeoutMinutes: number;

  /**
   * How long a session can stay in 'bot_assigned' or 'lobby_creating' before being
   * cancelled as a stuck/failed bot. Default: 5 minutes.
   */
  botAssignedTimeoutMinutes: number;

  /**
   * Minutes after the lobby opens (lobbyCreatedAt) before a warning message is sent
   * in chat. Set to 0 to disable warnings. Default: 15 minutes.
   */
  lobbyOpenWarningMinutes: number;

  /**
   * Minutes after the lobby opens (lobbyCreatedAt) before the lobby is closed for
   * no-show. Measured from lobbyCreatedAt, not session createdAt. Default: 30 minutes.
   * (Previously lobbyTimeoutMinutes, kept for compatibility.)
   */
  lobbyOpenTimeoutMinutes: number;

  /**
   * How long to wait in 'ready_check' state (both teams typed !ready) before
   * treating it as a stuck state and cancelling. Default: 10 minutes.
   */
  readyCheckTimeoutMinutes: number;

  /** @deprecated Use lobbyOpenTimeoutMinutes. Kept for backward compatibility. */
  lobbyTimeoutMinutes?: number;

  /** Whether the lobby password is visible to match players on the website */
  passwordVisibleToPlayers: boolean;

  updatedAt: string;
  updatedBy: string;
}

/**
 * Dota 2 lobby creation settings
 */
export interface LobbySettings {
  /** Game mode. Default: "Captains Mode" */
  gameMode: DotaGameMode;
  /** Server region. Default: "Luxembourg" */
  serverRegion: DotaServerRegion;
  /** Lobby visibility */
  visibility: DotaLobbyVisibility;
  /** Enable cheats */
  cheatsEnabled: boolean;
  /** Fill empty slots with bots */
  fillWithBots: boolean;
  /** DotaTV broadcast delay in seconds (0, 120, 300) */
  dotaTvDelay: number;
  /** Allow spectators */
  allowSpectators: boolean;
  /** Enable penalty for pausing (pause limit) */
  pauseSetting: DotaPauseSetting;
  /** Series type: 0 = no series, 1 = BO3, 2 = BO5 */
  seriesType: number;
  /** League ID to associate the lobby with (for ticket/DotaTV) */
  leagueId?: number;
  /** Lobby password (auto-generated per match if not set) */
  password?: string;
}

/**
 * Ready check configuration
 */
export interface ReadyCheckConfig {
  /** Commands the bot listens to for ready declaration (e.g., ["!ready", "!r"]) */
  readyCommands: string[];
  /** Commands to cancel ready (e.g., ["!unready", "!ur"]) */
  unreadyCommands: string[];
  /** Whether only captains can declare ready, or any team member */
  captainOnly: boolean;
  /** Timeout in minutes before auto-forfeit after lobby creation */
  timeoutMinutes: number;
}

/**
 * Chat messages configuration
 */
export interface LobbyChatConfig {
  /** Welcome message posted when lobby is created */
  welcomeMessage: string;
  /** Template for team slot assignment message.
   *  Supports placeholders: {radiant_team}, {dire_team} */
  teamAssignmentMessage: string;
  /** Message posted when both teams are ready */
  allReadyMessage: string;
  /** Message posted when requirements are not met */
  requirementsNotMetPrefix: string;
  /** Custom rules reminder (optional) */
  rulesReminder?: string;
  /** Message posted when match starts */
  matchStartMessage?: string;
}

/**
 * Post-match configuration
 */
export interface PostMatchConfig {
  /** Minutes to wait after match ends before triggering sync */
  syncDelayMinutes: number;
  /** Whether to auto-trigger match sync after the game */
  autoSyncEnabled: boolean;
  /** Post a summary message in lobby chat after game */
  postGameSummary: boolean;
}

/**
 * Lobby enforcement configuration — auto-kick, cooldowns, etc.
 */
export interface LobbyEnforcementConfig {
  /** Kick players from team/spectator slots who are not registered for the match */
  autoKickUnauthorized: boolean;
  /** Kick registered players who are sitting in the wrong team's slot, then re-invite them */
  autoKickWrongSlot: boolean;
  /** Seconds to wait after warning a wrong-slot player before kicking them */
  wrongSlotGracePeriodSeconds: number;
  /** Cooldown in seconds between !ready/!unready commands per player */
  readyCooldownSeconds: number;
}

// ─── Dota 2 Enums ───────────────────────────────────────────────────────────

export type DotaGameMode =
  | 'all_pick'
  | 'captains_mode'
  | 'captains_draft'
  | 'random_draft'
  | 'single_draft'
  | 'all_random'
  | 'turbo';

export type DotaServerRegion =
  | 'us_west'
  | 'us_east'
  | 'europe_west'
  | 'europe_east'
  | 'russia'
  | 'southeast_asia'
  | 'south_america'
  | 'australia'
  | 'dubai'
  | 'chile'
  | 'peru'
  | 'india'
  | 'japan'
  | 'south_africa';

export type DotaLobbyVisibility = 'public' | 'friends_only' | 'unlisted';

export type DotaPauseSetting = 'unlimited' | 'limited' | 'disabled';

// ─── Lobby Session (runtime state tracked in Firestore) ─────────────────────

/**
 * Represents an active lobby session managed by a bot.
 * Stored at /botLobbySessions/{sessionId}
 */
export interface LobbySession {
  id: string;
  /** Which match this lobby is for */
  matchId: string;
  /** Which tournament this match belongs to */
  tournamentId: string;
  /** Which bot account is managing this lobby */
  botAccountId: string;
  /** Current state of the lobby lifecycle */
  state: LobbySessionState;
  /** Lobby name (e.g., "PDL S1 - Team A vs Team B") */
  lobbyName: string;
  /** Lobby password */
  lobbyPassword: string;
  /** Dota 2 lobby ID (set once lobby is created in-game) */
  dotaLobbyId?: string;

  /** Team assignments */
  radiantTeam: LobbyTeamAssignment;
  direTeam: LobbyTeamAssignment;

  /** Ready check state */
  readyState: {
    radiantReady: boolean;
    direReady: boolean;
    radiantReadyBy?: string; // Player who said ready
    direReadyBy?: string;
  };

  /** Validation errors from last requirements check */
  validationErrors: string[];

  /** Tracks when wrong-slot players were first warned (steamId32 → ISO timestamp) */
  wrongSlotWarnings?: Record<string, string>;

  /** Tracks last ready/unready command per player for cooldown (steamId32 → ISO timestamp) */
  readyCooldowns?: Record<string, string>;

  /** Series format (bo1, bo2, bo3, bo5) */
  seriesFormat: 'bo1' | 'bo2' | 'bo3' | 'bo5';
  /** Game number within the series (1-indexed) */
  currentGameNumber: number;
  /** Total games expected in this series */
  totalGames: number;
  /** Running series score: { radiantTeamId: wins, direTeamId: wins } */
  seriesScore: Record<string, number>;

  /** Dota 2 match IDs for completed games in this session */
  completedGameIds: number[];
  /** Which team won each completed game (parallel array with completedGameIds) */
  completedGameWinners: Array<'radiant' | 'dire'>;

  /** Timestamps for lifecycle tracking */
  createdAt: string;
  lobbyCreatedAt?: string;
  gameStartedAt?: string;
  gameEndedAt?: string;
  syncTriggeredAt?: string;
  completedAt?: string;

  /**
   * Timestamp of the last pre-close warning sent in lobby chat.
   * Set by enforceSessionTimeouts() to prevent repeated warnings.
   */
  timeoutWarningSentAt?: string;

  /** Error information if state is 'error' */
  error?: {
    message: string;
    code?: string;
    timestamp: string;
  };
}

export type LobbySessionState =
  | 'pending'          // Scheduled, bot not yet assigned
  | 'bot_assigned'     // Bot account claimed this session
  | 'lobby_creating'   // Bot is creating the Dota 2 lobby
  | 'lobby_open'       // Lobby created, invites sent, waiting for players
  | 'ready_check'      // One or both teams declared ready, validating
  | 'requirements_met' // All checks passed, about to launch
  | 'coin_toss'        // Lobby started (coin toss phase)
  | 'in_game'          // Game is live
  | 'post_game'        // Game ended, waiting sync delay
  | 'syncing'          // Match data sync in progress
  | 'completed'        // Session fully done
  | 'cancelled'        // Admin or system cancelled
  | 'error';           // Unrecoverable error

/**
 * Team assignment info for a lobby
 */
export interface LobbyTeamAssignment {
  teamId: string;
  teamName: string;
  /** Expected player Steam32 IDs (roster + approved standins) */
  expectedPlayers: LobbyExpectedPlayer[];
  /** Coach Steam32 ID (if applicable) */
  coachSteamId32?: string;
  coachNickname?: string;
}

export interface LobbyExpectedPlayer {
  steamId32: string;
  nickname: string;
  /** Whether this player is a standin replacing someone */
  isStandin: boolean;
  /** If standin, who they are replacing */
  replacesPlayerId?: string;
  replacesPlayerNickname?: string;
}

// ─── Default Configurations ─────────────────────────────────────────────────

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  gameMode: 'captains_mode',
  serverRegion: 'europe_west',
  visibility: 'unlisted',
  cheatsEnabled: false,
  fillWithBots: false,
  dotaTvDelay: 120,
  allowSpectators: true,
  pauseSetting: 'limited',
  seriesType: 0,
};

export const DEFAULT_READY_CHECK_CONFIG: ReadyCheckConfig = {
  readyCommands: ['!ready', '!r'],
  unreadyCommands: ['!unready', '!ur'],
  captainOnly: false,
  timeoutMinutes: 30,
};

export const DEFAULT_CHAT_CONFIG: LobbyChatConfig = {
  welcomeMessage: 'Welcome to the match lobby! Please join your assigned team slots.',
  teamAssignmentMessage: 'RADIANT: {radiant_team} | DIRE: {dire_team}',
  allReadyMessage: 'Both teams are ready! Checking requirements...',
  requirementsNotMetPrefix: 'Cannot start - issues found:',
  rulesReminder: '',
  matchStartMessage: 'All requirements met! Starting the match. Good luck & have fun!',
};

export const DEFAULT_POST_MATCH_CONFIG: PostMatchConfig = {
  syncDelayMinutes: 5,
  autoSyncEnabled: true,
  postGameSummary: true,
};

export const DEFAULT_ENFORCEMENT_CONFIG: LobbyEnforcementConfig = {
  autoKickUnauthorized: true,
  autoKickWrongSlot: true,
  wrongSlotGracePeriodSeconds: 30,
  readyCooldownSeconds: 5,
};

export const DEFAULT_TOURNAMENT_BOT_CONFIG: TournamentBotConfig = {
  enabled: false,
  lobby: { ...DEFAULT_LOBBY_SETTINGS, allowSpectators: false },
  readyCheck: DEFAULT_READY_CHECK_CONFIG,
  chatMessages: DEFAULT_CHAT_CONFIG,
  postMatch: DEFAULT_POST_MATCH_CONFIG,
  enforcement: DEFAULT_ENFORCEMENT_CONFIG,
  lobbyCreationLeadMinutes: 10,
  pendingSessionTimeoutMinutes: 20,
  botAssignedTimeoutMinutes: 5,
  lobbyOpenWarningMinutes: 15,
  lobbyOpenTimeoutMinutes: 30,
  readyCheckTimeoutMinutes: 10,
  passwordVisibleToPlayers: true,
  updatedAt: '',
  updatedBy: '',
};

// ─── Dota 2 Constants ───────────────────────────────────────────────────────

/** Mapping of game mode names to Dota 2 GC enum values */
export const DOTA_GAME_MODE_IDS: Record<DotaGameMode, number> = {
  all_pick: 1,
  captains_mode: 2,
  captains_draft: 16,
  random_draft: 6,
  single_draft: 4,
  all_random: 3,
  turbo: 23,
};

/** Mapping of server region names to Dota 2 server cluster IDs */
export const DOTA_SERVER_REGION_IDS: Record<DotaServerRegion, number> = {
  us_west: 1,
  us_east: 2,
  europe_west: 8,
  europe_east: 14,
  russia: 3,
  southeast_asia: 6,
  south_america: 7,
  australia: 9,
  dubai: 15,
  chile: 13,
  peru: 10,
  india: 5,
  japan: 11,
  south_africa: 12,
};

/** Human-readable labels for game modes */
export const GAME_MODE_LABELS: Record<DotaGameMode, string> = {
  all_pick: 'All Pick',
  captains_mode: "Captain's Mode",
  captains_draft: "Captain's Draft",
  random_draft: 'Random Draft',
  single_draft: 'Single Draft',
  all_random: 'All Random',
  turbo: 'Turbo',
};

/** Human-readable labels for server regions */
export const SERVER_REGION_LABELS: Record<DotaServerRegion, string> = {
  us_west: 'US West',
  us_east: 'US East',
  europe_west: 'Europe West (Luxembourg)',
  europe_east: 'Europe East (Vienna)',
  russia: 'Russia',
  southeast_asia: 'Southeast Asia',
  south_america: 'South America',
  australia: 'Australia',
  dubai: 'Dubai',
  chile: 'Chile',
  peru: 'Peru',
  india: 'India',
  japan: 'Japan',
  south_africa: 'South Africa',
};

/** Dota 2 lobby slot layout:
 *  Radiant slots: 0-4 (players), Radiant coach: index 10
 *  Dire slots: 5-9 (players), Dire coach: index 11
 *  Spectators/Unassigned: 12+
 *  Broadcasters: dedicated slots
 */
export const DOTA_LOBBY_SLOTS = {
  RADIANT_PLAYER_START: 0,
  RADIANT_PLAYER_END: 4,
  DIRE_PLAYER_START: 5,
  DIRE_PLAYER_END: 9,
  RADIANT_COACH: 10,
  DIRE_COACH: 11,
  SPECTATOR_START: 12,
} as const;
