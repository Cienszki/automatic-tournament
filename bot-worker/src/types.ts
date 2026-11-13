// Shapes of the documents the tournament bot reads and writes.
//
// Written from what conductor, scheduling and runner actually touch, field by field.
// The website's own copy is src/types/lobby-bot.ts (outside bot-worker); the two are not
// linked, which is the drift ARCHITECTURE.md B6 describes. WP-21 replaces both with
// schemas in contract/. Nothing is validated on read: a field is optional here whenever
// the code supplies a fallback for it.

export type TeamSide = 'radiant' | 'dire';
/** Where a lobby member sits, as DotaClient reports it. */
export type SlotSide = TeamSide | 'spectator' | 'unassigned' | 'broadcaster';

export type SessionState =
  | 'pending'
  | 'bot_assigned'
  | 'lobby_creating'
  | 'lobby_open'
  | 'ready_check'
  | 'requirements_met'
  | 'coin_toss'
  | 'in_game'
  | 'post_game'
  | 'syncing'
  | 'completed'
  | 'cancelled'
  | 'error';

export type SeriesFormat = 'bo1' | 'bo2' | 'bo3' | 'bo5';

// ─── Website documents (read only) ──────────────────────────────────────────

export interface TeamPlayerDoc {
  id: string;
  steamId32?: string;
  nickname: string;
}

/** tournaments/{t}/teams/{teamId}: the parts the bot reads. */
export interface TeamDoc {
  tag?: string | null;
  players?: TeamPlayerDoc[];
  /** Older roster shape: steamId64 → player. */
  roster?: Record<string, { steamId32?: string; nickname: string }>;
  coach?: { nickname?: string };
}

export interface ApprovedStandin {
  teamId: string;
  replacedPlayerId: string;
  steamId32: string;
  nickname: string;
  gameNumbers?: number[];
}

export interface DraftPenalty {
  teamId: string;
  level: number | string;
  games?: number[];
}

/** tournaments/{t}/matches/{matchId}: the parts the bot reads. */
export interface MatchDoc {
  status?: string;
  scheduledFor?: string;
  winnerId?: string | null;
  series_format?: SeriesFormat;
  group_id?: string | null;
  teamA?: { id?: string; name?: string };
  teamB?: { id?: string; name?: string };
  approvedStandins?: Record<string, ApprovedStandin>;
  coachInfo?: Record<string, { nickname?: string }>;
  casters?: Array<{ steamId32?: string | number } | null>;
  draftPenalties?: DraftPenalty[];
}

/** tournaments/{t}: the parts the bot reads. */
export interface TournamentDoc {
  name?: string;
  lobbySettings?: { leagueName?: string };
}

// ─── Bot configuration (tournaments/{t}/config/bot, written by the website) ──

export interface WhitelistEntry {
  steamId32: string;
}

export interface LobbySettings {
  gameMode?: string;
  serverRegion?: string;
  visibility?: string;
  dotaTvDelay?: number;
  leagueId?: number;
  cheatsEnabled?: boolean;
  fillWithBots?: boolean;
  allowSpectators?: boolean;
  pauseSetting?: string;
  selectionPriorityRules?: number;
  password?: string;
}

export interface ChatMessages {
  welcomeMessage?: string;
  teamNotReadyMessage?: string;
  teamReadyMessage?: string;
  allReadyMessage?: string;
  matchStartMessage?: string;
  unauthorizedKickMessage?: string;
  customCommands?: Array<{ trigger?: string; response: string }>;
}

export interface EnforcementConfig {
  autoKickUnauthorized?: boolean;
  autoKickWrongSlot?: boolean;
  wrongSlotGracePeriodSeconds?: number;
}

export interface ReadyCheckConfig {
  readyCommands: string[];
  unreadyCommands: string[];
}

export interface LateArrivalPolicy {
  enabled?: boolean;
  game1ForfeitMinutes: number;
  seriesForfeitMinutes: number;
  waitCommands: string[];
  forfeitCommands: string[];
  votingWindowSeconds?: number;
  requiredVotesForForfeit: number;
  waitExtensionMinutes?: number;
  lateGame1AnnouncementTemplate?: string;
  lateSeriesAnnouncementTemplate?: string;
  waitResultTemplate?: string;
  forfeitGame1Template?: string;
  forfeitSeriesTemplate?: string;
  noVoteResultTemplate?: string;
  interGameBreakMinutes?: number;
}

export interface BotConfig {
  enabled?: boolean;
  lobby: LobbySettings;
  readyCheck?: ReadyCheckConfig;
  chatMessages?: ChatMessages;
  perBotMessages?: Record<string, Partial<ChatMessages>>;
  postMatch?: { autoSyncEnabled?: boolean; syncDelayMinutes?: number };
  enforcement?: EnforcementConfig;
  lateArrival?: LateArrivalPolicy;
  whitelist?: WhitelistEntry[];
  lobbyCreationLeadMinutes?: number;
  pendingSessionTimeoutMinutes?: number;
  lobbyOpenTimeoutMinutes?: number;
  lobbyTimeoutMinutes?: number;
  lobbyOpenWarningMinutes?: number;
  readyCheckTimeoutMinutes?: number;
  inGameTimeoutMinutes?: number;
}

// ─── Bot accounts (botAccounts/{id}, shared with the website and the inhouse bot) ──

export interface BotAccountDoc {
  enabled?: boolean;
  status?: string;
  displayName?: string;
  username?: string;
  /** Base64, not encryption (ARCHITECTURE.md B6). */
  encryptedPassword?: string;
  steamGuardSharedSecret?: string;
  steamId32?: string;
  cooldownUntil?: string | null;
}

// ─── Lobby sessions (botLobbySessions/{id}) ─────────────────────────────────

export interface ExpectedPlayer {
  steamId32: string;
  nickname: string;
  isStandin?: boolean;
  replacesPlayerId?: string;
  replacesPlayerNickname?: string;
}

export interface TeamAssignment {
  teamId: string;
  teamName: string;
  teamTag?: string | null;
  expectedPlayers: ExpectedPlayer[];
  coachSteamId32?: string;
  coachNickname?: string;
}

export interface BasePlayer {
  id: string;
  steamId32: string;
  nickname: string;
}

export interface StandinAssignment {
  teamId: string;
  replacedPlayerId: string;
  steamId32: string;
  nickname: string;
  gameNumbers: number[];
}

export interface ReadyState {
  radiantReady: boolean;
  direReady: boolean;
  radiantReadyBy?: string;
  direReadyBy?: string;
}

export interface LateVote {
  kind: 'game1' | 'series';
  lateSide: TeamSide;
  openedAt: string;
  closesAt: string;
  votes: Record<string, 'forfeit' | 'wait'>;
}

export interface ForfeitedGame {
  gameNumber: number;
  forfeitedTeam: TeamSide;
  winnerTeam: TeamSide;
}

export interface SessionError {
  message: string;
  code?: string;
  timestamp: string;
}

/** The fields of a botLobbySessions document. */
export interface SessionData {
  matchId: string;
  tournamentId: string;
  botAccountId: string;
  state: SessionState;
  lobbyName: string;
  lobbyPassword: string;
  radiantTeam: TeamAssignment;
  direTeam: TeamAssignment;
  baseRadiantPlayers?: BasePlayer[];
  baseDirePlayers?: BasePlayer[];
  standinAssignments?: StandinAssignment[];
  readyState: ReadyState;
  validationErrors?: string[];
  seriesFormat: SeriesFormat;
  currentGameNumber: number;
  totalGames: number;
  seriesScore: Record<string, number>;
  completedGameIds: number[];
  completedGameWinners: TeamSide[];
  lobbySeriesType?: number;
  lobbyRadiantWins?: number;
  lobbyDireWins?: number;
  scheduledMatchTime?: string;
  createdAt: string;
  updatedAt?: string;

  dotaLobbyId?: string;
  lobbyCreatedAt?: string;
  startGameSentAt?: string | null;
  readyCheckStartedAt?: string | null;
  timeoutWarningSentAt?: string | null;
  timeoutHeldNotified?: string | null;
  gameStartedAt?: string;
  gameEndedAt?: string;
  completedAt?: string;
  currentGameDotaMatchId?: number | null;
  currentGameSides?: { radiant: string | null; dire: string | null } | null;
  awaitingRestart?: boolean;
  lastLobbyPlayers?: Array<{ steamId32: string; teamSide: SlotSide }>;
  lateVote?: LateVote | null;
  lateWaitUntil?: string | null;
  forfeitedGames?: ForfeitedGame[];
  reassignCount?: number;
  reassignReason?: string;
  cancelReason?: string;
  lastHeartbeat?: string;
  error?: SessionError;
  lastRunnerError?: { message: string; timestamp: string };
}

/** A session as the runner holds it: the document plus its id. */
export interface Session extends SessionData {
  id: string;
}

// ─── Result tasks (botSyncTasks, drained by the website) ────────────────────

export interface SyncTask {
  type: 'sync';
  sessionId: string;
  matchId: string;
  tournamentId: string;
  dotaMatchId: number;
  syncAt: string;
  status: 'pending';
  createdAt: string;
}

export interface ForfeitTask {
  type: 'forfeit';
  sessionId: string;
  matchId: string;
  tournamentId: string;
  forfeitingTeamId: string;
  forfeitedGameNumbers: number[];
  reason: string;
  syncAt: string;
  status: 'pending';
  createdAt: string;
}

// ─── Lobby occupancy as the runner and runner-logic see it ──────────────────

export interface LobbySlot {
  steamId32: string;
  teamSide: SlotSide;
  slotIndex?: number;
  name?: string | null;
}
