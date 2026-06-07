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
 * A Steam account whitelisted to join any lobby for this tournament
 * without being auto-kicked as unauthorized. Intended for commentators,
 * observers, and admins who need lobby access but are not match players.
 */
export interface LobbyWhitelistEntry {
  /** Steam32 account ID (used for lobby enforcement matching) */
  steamId32: string;
  /** Steam64 account ID */
  steamId64: string;
  /** Steam persona/display name at the time of adding */
  displayName: string;
  /** Small Steam avatar URL */
  avatarUrl?: string;
  /** Optional admin note, e.g. "main commentator", "tournament admin" */
  note?: string;
  /** ISO timestamp when the entry was added */
  addedAt: string;
  /** Firebase UID of the admin who added this entry */
  addedBy: string;
}

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

  /** Late player detection & forfeit voting */
  lateArrival: LateArrivalPolicyConfig;

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

  /**
   * Per-bot message overrides keyed by bot account ID.
   * Merged on top of chatMessages at runtime — you only need to provide fields
   * you want to override for that specific bot's "personality".
   */
  perBotMessages?: Record<string, Partial<LobbyChatConfig>>;

  /** @deprecated Use lobbyOpenTimeoutMinutes. Kept for backward compatibility. */
  lobbyTimeoutMinutes?: number;

  /** Whether the lobby password is visible to match players on the website */
  passwordVisibleToPlayers: boolean;

  /**
   * Steam accounts that are always allowed to join lobby without being kicked.
   * Used for commentators, observers, and tournament admins.
   * Per-tournament — managed separately by tournament admins.
   */
  whitelist: LobbyWhitelistEntry[];

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
  /** League ID to associate the lobby with (for ticket/DotaTV) */
  leagueId?: number;
  /** Lobby password (auto-generated per match if not set) */
  password?: string;
  /**
   * Selection priority rules (DOTASelectionPriorityRules proto enum).
   * 1 = Automatic (default) — coin toss: GC shows "START PICK/SIDE SELECTION", captains
   *     choose side/pick-order in their Dota 2 client. Bot fires a second
   *     launchPracticeLobby() automatically once both teams have chosen.
   * 0 = Manual — no coin toss: GC uses lobby settings directly, shows "START GAME".
   *     Single launchPracticeLobby() call is enough; no player interaction needed.
   */
  selectionPriorityRules?: number;
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
}

/**
 * A custom bot command: when any lobby player types `trigger`, the bot replies with `response`.
 */
export interface CustomBotCommand {
  /** The exact trigger string (e.g. "!rules"). Case-insensitive match. */
  trigger: string;
  /** The message the bot posts in lobby chat as a response. */
  response: string;
}

/**
 * Chat messages configuration
 */
export interface LobbyChatConfig {
  /**
   * Welcome message posted when an eligible player joins the lobby.
   * The bot always prepends the player's name from the database:
   *   "{PlayerName}: {welcomeMessage}"
   * Supports {player_name} placeholder.
   */
  welcomeMessage: string;
  /**
   * Sent when one team types !r but not all their players are in the correct slots.
   * Placeholders: {player_name} (player who typed !r), {team_name}, {missing} (comma-separated list)
   */
  teamNotReadyMessage: string;
  /**
   * Sent in chat when one team marks ready and is waiting for the other.
   * Placeholders: {player_name}, {team_name}
   */
  teamReadyMessage: string;
  /** Message posted when both teams are ready. Placeholders: {player_name}, {team_name} */
  allReadyMessage: string;
  /** Message posted when requirements are not met */
  requirementsNotMetPrefix: string;
  /** Custom rules reminder (optional) */
  rulesReminder?: string;
  /** Message posted when match starts */
  matchStartMessage?: string;
  /** Admin-defined custom chat commands the bot handles in lobby chat */
  customCommands: CustomBotCommand[];
}

/**
 * Post-match configuration
 */
export interface PostMatchConfig {
  /** Minutes to wait after match ends before triggering sync */
  syncDelayMinutes: number;
  /** Whether to auto-trigger match sync after the game */
  autoSyncEnabled: boolean;
}

/**
 * Late player detection & forfeit voting configuration.
 * When a team is late, the bot asks the opposing team to vote:
 * forfeit the game/series OR wait 10 more minutes.
 * Only votes from the opposing team players are counted.
 */
export interface LateArrivalPolicyConfig {
  /** Enable the late player detection system */
  enabled: boolean;
  /** Minutes after the scheduled match start before asking about game 1 forfeit */
  game1ForfeitMinutes: number;
  /** Minutes after the scheduled match start before asking about series forfeit */
  seriesForfeitMinutes: number;
  /** Commands opposing team can type to vote for waiting more minutes (see waitExtensionMinutes) */
  waitCommands: string[];
  /** Commands opposing team can type to vote for forfeit */
  forfeitCommands: string[];
  /** Seconds the voting window lasts (default 60) */
  votingWindowSeconds: number;
  /** How many of 5 opposing players must vote forfeit to trigger it (default 3) */
  requiredVotesForForfeit: number;
  /** Minutes added when the present team votes to wait instead of forfeiting (default 10) */
  waitExtensionMinutes: number;
  /**
   * Announcement sent when a team is absent at the game-1 forfeit threshold.
   * Placeholders: {late_team}, {present_team}, {minutes}, {wait_cmd}, {forfeit_cmd}, {window}, {required}
   */
  lateGame1AnnouncementTemplate: string;
  /**
   * Announcement sent when a team is still absent at the series forfeit threshold.
   * Placeholders: {late_team}, {present_team}, {minutes}, {wait_cmd}, {forfeit_cmd}, {window}, {required}
   */
  lateSeriesAnnouncementTemplate: string;
  /** Wait vote result message. Placeholders: {present_team}, {extra} */
  waitResultTemplate: string;
  /** Game 1 forfeit result message. Placeholders: {winner_team}, {loser_team} */
  forfeitGame1Template: string;
  /** Series forfeit result message. Placeholders: {winner_team}, {loser_team} */
  forfeitSeriesTemplate: string;
  /** Message when vote window closes without quorum. Placeholders: {votes}, {required}, {present_team} */
  noVoteResultTemplate: string;
  /**
   * Minutes after the previous game ended before the late timer for the next
   * game begins. Gives teams a break between games to reconnect/prepare.
   * Default: 15
   */
  interGameBreakMinutes: number;
}

/**
 * Lobby enforcement configuration
 */
export interface LobbyEnforcementConfig {
  /** Kick players from team/spectator slots who are not registered for the match */
  autoKickUnauthorized: boolean;
  /** Kick players who are in the wrong team slot after the grace period */
  autoKickWrongSlot: boolean;
  /** Seconds to wait before kicking a player who is in the wrong slot */
  wrongSlotGracePeriodSeconds: number;
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

  /**
   * Dota 2 series_type value for the lobby creation call.
   * Computed from seriesFormat: bo1→0 (none), bo2/bo3→1 (BO3), bo5→2 (BO5).
   * Stored per-session so game-2+ lobbies carry the same format.
   */
  lobbySeriesType?: number;
  /**
   * Current Radiant team wins to pre-populate in the lobby for game 2+.
   * Maps to the Dota 2 GC field `radiant_series_wins`.
   */
  lobbyRadiantWins?: number;
  /**
   * Current Dire team wins to pre-populate in the lobby for game 2+.
   * Maps to the Dota 2 GC field `dire_series_wins`.
   */
  lobbyDireWins?: number;

  /** Dota 2 match IDs for completed games in this session */
  completedGameIds: number[];
  /** Which team won each completed game (parallel array with completedGameIds) */
  completedGameWinners: Array<'radiant' | 'dire'>;

  /** ISO timestamp of the scheduled match start (used by late arrival timer) */
  scheduledMatchTime?: string;

  /**
   * ISO timestamp until which the orchestrator should NOT time out this session.
   * Set when players vote to wait for late opponents; cleared after the extra
   * wait window expires (or a forfeit/game-start occurs).
   */
  lateWaitUntil?: string;

  /**
   * Games that were resolved via forfeit (no Dota 2 match ID).
   * Stored alongside completedGameIds for series score tracking.
   */
  forfeitedGames?: Array<{
    gameNumber: number;
    /** Which team's side was forfeited */
    forfeitedTeam: 'radiant' | 'dire';
    /** Which side was awarded the win */
    winnerTeam: 'radiant' | 'dire';
  }>;

  /** Timestamps for lifecycle tracking */
  createdAt: string;
  lobbyCreatedAt?: string;
  /** Set once start_game has been dispatched for this session (prevents double-launch) */
  startGameSentAt?: string;
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
  visibility: 'public',
  cheatsEnabled: false,
  fillWithBots: false,
  dotaTvDelay: 120,
  allowSpectators: true,
  pauseSetting: 'limited',
  selectionPriorityRules: 1, // Automatic by default — coin toss (START PICK/SIDE SELECTION)
};

export const DEFAULT_READY_CHECK_CONFIG: ReadyCheckConfig = {
  readyCommands: ['!ready', '!r'],
  unreadyCommands: ['!unready', '!ur'],
  captainOnly: false,
};

export const DEFAULT_LATE_ARRIVAL_CONFIG: LateArrivalPolicyConfig = {
  enabled: false,
  game1ForfeitMinutes: 15,
  seriesForfeitMinutes: 30,
  waitExtensionMinutes: 10,
  interGameBreakMinutes: 15,
  waitCommands: ['!wait', '!w'],
  forfeitCommands: ['!forfeit', '!ff'],
  votingWindowSeconds: 60,
  requiredVotesForForfeit: 3,
  lateGame1AnnouncementTemplate:
    '{late_team} nie pojawiła się po {minutes} min. {present_team}: ' +
    'wpisz {forfeit_cmd} żeby oddać grę 1 / {wait_cmd} żeby czekać 10 min. ' +
    'Potrzeba {required}/5 głosów. Głosowanie trwa {window}s.',
  lateSeriesAnnouncementTemplate:
    '{late_team} nie pojawiła się po {minutes} min. {present_team}: ' +
    'wpisz {forfeit_cmd} żeby oddać całą serię / {wait_cmd} żeby czekać 10 min. ' +
    'Potrzeba {required}/5 głosów. Głosowanie trwa {window}s.',
  waitResultTemplate:
    'Wynik głosowania: {present_team} zagłosowała za czekaniem 10 minut.',
  forfeitGame1Template:
    'Wynik głosowania: Gra 1 oddana na rzecz {winner_team}! ({loser_team} otrzymuje porażkę.) Admin powiadomiony.',
  forfeitSeriesTemplate:
    'Wynik głosowania: Seria oddana na rzecz {winner_team}! ({loser_team} otrzymuje walkower.) Admin powiadomiony.',
  noVoteResultTemplate:
    'Niewystarczająca liczba głosów ({votes}/{required}). Kontynuuję oczekiwanie...',
};

export const DEFAULT_CHAT_CONFIG: LobbyChatConfig = {
  welcomeMessage: 'Welcome to the match lobby! Please take your team slots.',
  teamNotReadyMessage: '{player_name}: Not all {team_name} players are in the correct slots yet. Missing: {missing}',
  teamReadyMessage: '{team_name} is ready! Waiting for the other team...',
  allReadyMessage: 'Both teams are ready! Checking requirements...',
  requirementsNotMetPrefix: 'Cannot start - issues found:',
  rulesReminder: '',
  matchStartMessage: 'All requirements met! Starting the match. Good luck & have fun!',
  customCommands: [],
};

export const DEFAULT_POST_MATCH_CONFIG: PostMatchConfig = {
  syncDelayMinutes: 5,
  autoSyncEnabled: true,
};

export const DEFAULT_ENFORCEMENT_CONFIG: LobbyEnforcementConfig = {
  autoKickUnauthorized: true,
  autoKickWrongSlot: false,
  wrongSlotGracePeriodSeconds: 30,
};

export const DEFAULT_TOURNAMENT_BOT_CONFIG: TournamentBotConfig = {
  enabled: false,
  lobby: { ...DEFAULT_LOBBY_SETTINGS, allowSpectators: false },
  readyCheck: DEFAULT_READY_CHECK_CONFIG,
  chatMessages: DEFAULT_CHAT_CONFIG,
  postMatch: DEFAULT_POST_MATCH_CONFIG,
  enforcement: DEFAULT_ENFORCEMENT_CONFIG,
  lateArrival: DEFAULT_LATE_ARRIVAL_CONFIG,
  lobbyCreationLeadMinutes: 10,
  pendingSessionTimeoutMinutes: 20,
  botAssignedTimeoutMinutes: 5,
  lobbyOpenWarningMinutes: 15,
  lobbyOpenTimeoutMinutes: 30,
  readyCheckTimeoutMinutes: 10,
  passwordVisibleToPlayers: true,
  whitelist: [],
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
