// src/lib/definitions.ts

// ... (other definitions remain the same)

export interface PlayerPerformanceInGame {
  /**
   * For data imported after March 2026: this is the player's steamId64.
   * For legacy data: this is the Firestore player-subcollection doc ID.
   * Use `steamId` field (= steamId64) for new code.
   */
  playerId: string;
  /** Steam 64-bit ID — same as playerId for data imported after the architecture change. */
  steamId?: string;
  teamId: string;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  lastHits: number;
  denies: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
  obsPlaced: number;
  senPlaced: number;
  courierKills: number;
  firstBloodClaimed: boolean;
  observerKills: number;
  sentryKills: number;
  highestKillStreak: number;
  buybackCount: number;
  heroHealing: number;
  fantasyPoints: number;

  // Multikill data
  multiKills: { [key: string]: number }; // Object with 2, 3, 4, 5 kill counts
  doubleKills: number;
  tripleKills: number;
  ultraKills: number;
  rampages: number;

  // Additional stats
  roshanKills: number;
  towerKills: number;
  neutralKills: number;
  laneKills: number;
  heroKills: number;
  totalGold: number;
  goldSpent: number;
  runesPickedUp: number;
  campsStacked: number;
}

export interface Game {
  id: string; // OpenDota match_id
  radiant_win: boolean;
  duration: number;
  start_time: number;
  firstBloodTime: number;
  picksBans?: any[];
  radiant_team?: { id: string; name: string; };
  dire_team?: { id: string; name: string; };
}

export interface Match {
  id: string;
  teamA: { id: string; name: string; score: number; logoUrl: string; };
  teamB: { id: string; name: string; score: number; logoUrl: string; };
  teams: string[];
  status: 'scheduled' | 'completed' | 'live';
  scheduledFor: string;
  group_id?: string;
  divisionId?: string; // Same as group_id, used for league matches
  playoff_round?: number;
  schedulingStatus: 'unscheduled' | 'proposed' | 'confirmed';
  proposedTime?: string;
  proposingCaptainId?: string;
  proposedById?: string;
  deadline?: string; // ISO date — deadline by which the match must be played
  game_ids?: number[]; // This now holds the IDs of the individual games
  completed_at?: string;
  series_format?: 'bo1' | 'bo2' | 'bo3' | 'bo5'; // Series format (BO2 for groups, BO1/BO3/BO5 for playoffs)
  winnerId?: string | null; // Winner of the match, null for draws
  playerPerformances?: PlayerPerformanceInMatch[];
  openDotaMatchUrl?: string;
  // Schedule properties
  matchday?: number;
  round?: number;
  bestOf?: number;
  standinInfo?: {
    [teamId: string]: {
      teamId: string;
      unavailablePlayers: string[];
      standins: string[];
    }
  };
  // PDL-specific match fields
  rescheduleRequest?: {
    requestedBy: string;
    requestedByName: string;
    requestedByCaptainId?: string;
    originalDate: string;
    proposedDate: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    respondedAt?: string;
  };
  coachInfo?: {
    [teamId: string]: {
      nickname: string;
      steamProfileUrl: string;
      assignedAt: string;
    };
  };
  standinRequests?: PDLStandinRequest[];
  // PDL approved standins — denormalized copy written into the match document
  // whenever a standin request reaches 'approved' or 'appeal_approved' status.
  // Keyed by standinRequest ID so individual entries can be removed cleanly.
  approvedStandins?: {
    [requestId: string]: {
      steamId32: string;
      nickname: string;
      replacedPlayerId: string;
      replacedPlayerNickname: string;
      teamId: string;
      approvedAt: string;
      /** Standin's own player doc ID (may be from a different team than the match teams). */
      playerDocId?: string;
      /** Standin's MMR (copied from the standin request at approval time). */
      standinMmr?: number;
      /**
       * Which games of the series this standin plays (1-indexed). Omitted/empty = the
       * whole series (backward compatible with series-wide standins).
       */
      gameNumbers?: number[];
    };
  };
  // Forfeit/walkover metadata
  forfeit?: {
    forfeitingTeam: 'teamA' | 'teamB'; // which team forfeited
    scope: 'series' | 'games';          // entire series or specific games
    forfeitedGameNumbers?: number[];    // [1], [2], or [1,2] for game-level
    reason?: string;
    issuedAt: string;   // ISO date string
    issuedBy: string;   // admin userId
  };
  /** Set to true when the match was voided due to a team ban. Hidden from schedule views. */
  isBanForfeit?: boolean;
  /**
   * True when this Match is a projection of a playoff bracket match (stored in the
   * `playoff_matches` collection, not `matches`). Consumers that write back to Firestore
   * (reschedule, coach, standins) must route to `playoff_matches` for these.
   */
  isPlayoff?: boolean;
  /** Playoff bracket short code (e.g. "U2C", "GF"), only set when `isPlayoff` is true. */
  playoffCode?: string;
  /**
   * Transient (never persisted) marker used by the my-team view: true when this playoff match was
   * read from `playoff_matches` because no mirror exists in `matches` yet. Writes for such a match
   * must route back to `playoff_matches`. Once a mirror exists it is read from `matches` and this
   * is absent, so writes route to `matches` like a group match.
   */
  isPlayoffOnly?: boolean;
  /** Admin-issued draft-time penalties for this match (applied per team, per game). */
  draftPenalties?: DraftPenalty[];
}

/** Draft-time penalty severity levels — map to the Dota lobby's penalty_level (1..3). */
export type DraftPenaltyLevel = 1 | 2 | 3;

/**
 * The three draft-penalty levels and their meaning. `seconds` is how much draft time the penalized
 * team loses; `level` is the value written to the Dota lobby's penalty_level_radiant/dire field.
 */
export const DRAFT_PENALTY_LEVELS: Record<DraftPenaltyLevel, { seconds: number; label: string; description: string }> = {
  1: { seconds: 30, label: 'Poziom 1 (−30s)', description: 'Kara: −30 sekund czasu na draft' },
  2: { seconds: 70, label: 'Poziom 2 (−70s)', description: 'Kara: −70 sekund czasu na draft' },
  3: { seconds: 130, label: 'Poziom 3 (−130s)', description: 'Kara: −130 sekund czasu na draft' },
};

export interface DraftPenalty {
  id: string;
  /** Penalized team. */
  teamId: string;
  /** 1-indexed game numbers this penalty applies to. Empty array = the whole series. */
  games: number[];
  level: DraftPenaltyLevel;
  reason?: string;
  issuedAt: string;
  issuedBy: string;
}

/** Does a penalty apply to the given 1-indexed game number? (Empty games = whole series.) */
export function draftPenaltyAppliesToGame(penalty: DraftPenalty, gameNumber: number): boolean {
  return !penalty.games || penalty.games.length === 0 || penalty.games.includes(gameNumber);
}

export interface PlayerPerformanceInMatch {
  playerId: string;
  teamId: string;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  fantasyPoints: number;
}

// ... (rest of definitions)
export const LEAGUE_ID = 18559;
export const TEAM_MMR_CAP = 24000;
export const FANTASY_BUDGET_MMR = 24000;

// Tournament-specific league IDs for multi-tournament support
export const TOURNAMENT_LEAGUE_IDS: Record<string, number> = {
  'letnia': 18559,
  'letnia-2025': 18559,
  'pdl': 19206,
  'pdl-s1': 19206,
};

// Helper to get league ID for a tournament
export function getLeagueId(tournamentSlug: string): number {
  return TOURNAMENT_LEAGUE_IDS[tournamentSlug] || LEAGUE_ID;
}


export type TeamStatus = 'pending' | 'verified' | 'rejected' | 'warning' | 'banned' | 'eliminated';
export const PlayerRoles = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
export type PlayerRole = typeof PlayerRoles[number];

export interface Player {
  id: string;
  nickname: string;
  mmr: number;
  role: PlayerRole;
  /** Steam 64-bit ID. Written to both `steamId` and `steamId64` fields in Firestore. */
  steamId: string;
  /** Alias for `steamId` — some documents written during registration use this field name. */
  steamId64?: string;
  steamId32: string;
  steamProfileUrl?: string;
  openDotaAccountId?: number;
  profileScreenshotUrl: string;
  /** Steam display name (personaname from Steam API). */
  personaname?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  smurfAccounts?: { steamProfileUrl: string; steamId64?: string; steamId32?: string }[];
  /** Most played heroes fetched from OpenDota — top 5 overall and top 5 last 6 months */
  mostPlayedHeroes?: {
    overall: { heroId: number; games: number; win: number }[];
    recent: { heroId: number; games: number; win: number }[];
    lastUpdated?: string;
  };
}

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  discordUsername?: string;
  roles?: {
    admin?: boolean;
  };
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  logoUrl: string;
  captainId: string;
  discordUsername: string;
  motto: string;
  status: TeamStatus;
  createdAt: string;
  players: Player[];
  /**
   * Embedded roster keyed by steamId64 for quick single-doc reads.
   * `{ [steamId64]: { nickname, role, steamId32, avatar? } }`
   */
  roster?: Record<string, { nickname: string; role: PlayerRole; steamId32: string; avatar?: string }>;
  openDotaTeamId?: number;
  testCaptainEmail?: string;
  testCaptainPassword?: string;

  // Tournament context
  division?: string;
  divisionId?: string;
  points?: number; // Current round points
  seasonPoints?: number; // Cumulative season points for LAN qualification
  recentForm?: ('W' | 'L' | 'D')[];

  // Team statistics
  matchesPlayed?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  averageKillsPerGame?: number;
  averageDeathsPerGame?: number;
  averageAssistsPerGame?: number;
  averageFantasyPoints?: number;
  averageMatchDurationMinutes?: number;
  averageGpm?: number;
  averageXpm?: number;
  averageLastHits?: number;
  averageNetWorth?: number;
  averageHeroDamage?: number;
  averageTowerDamage?: number;
  averageHeroHealing?: number;
  mostPlayedHeroes?: Array<{
    name: string;
    gamesPlayed: number;
  }>;
  captainDiscordUsername?: string;
  coach?: {
    id?: string;
    nickname?: string;
    discordUsername?: string;
    steamProfileUrl?: string;
  };
  // PDL-specific team fields
  previousRoundPlayers?: Player[]; // Snapshot of players used in last completed round (for transfer validation)
  transferHistory?: PDLTransferRecord[];
  seasonId?: string;
  timePenalty?: {
    minutes: number;
    reason: string;
    appliesTo?: string; // Match ID if specific to one match
  };
}

export interface GroupStanding {
  teamId: string;
  teamName: string;
  teamLogoUrl: string;
  matchesPlayed: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  headToHead: { [opponentId: string]: 'win' | 'loss' | 'draw' };
  neustadtlScore: number;
  status: 'pending' | 'updated';
  totalMMR: number;
}

export interface GroupHighlight {
  color: string;
  count: number;
  from: 'top' | 'bottom';
}

export interface Group {
  id: string;
  name: string;
  standings: { [teamId: string]: GroupStanding };
  highlights?: GroupHighlight[];
}

export interface TournamentPlayer extends Player {
  teamId: string;
  teamName: string;
  teamTag: string;
}

export interface FantasyLineup {
  userId: string;
  displayName?: string;
  roundId?: string;
  lineup: Partial<Record<PlayerRole, TournamentPlayer>>;
  submittedAt?: string;
  totalFantasyScore?: number;
}

export interface FantasyData {
  players: TournamentPlayer[];
  lineups: FantasyLineup[];
}

export interface Pickem {
  userId: string;
  predictions: {
    champion: string[];
    runnerUp: string[];
    thirdPlace: string[];
    fourthPlace: string[];
    fifthToSixth: string[];
    seventhToEighth: string[];
    ninthToTwelfth: string[];
    thirteenthToSixteenth: string[];
    pool: string[];
  };
  scores: Record<string, number>;
  lastUpdated: any;
}

export interface PickemPrediction {
  userId: string;
  matchId: string;
  predictedWinnerId: string;
}

export interface CategoryDisplayStats {
  categoryName: string;
  leader: {
    playerId: string;
    playerNickname: string;
    teamName: string;
    teamTag: string;
    value: number;
  };
}

export interface CategoryRankingDetail {
  playerId: string;
  playerNickname: string;
  teamName: string;
  teamTag: string;
  averageValue: number;
  matchesPlayed: number;
}

export interface TournamentHighlightRecord {
  category: string;
  playerId: string;
  playerNickname: string;
  teamName: string;
  teamTag: string;
  value: number;
  matchId: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export type StandinStatus = 'pending' | 'verified';

export interface Standin {
  id: string;
  userId: string;
  nickname: string;
  discordUsername: string;
  mmr: number;
  profileScreenshotUrl: string;
  steamProfileUrl: string;
  steamId?: string;
  steamId32?: string;
  roles: string[]; // Array of roles they can play: 'Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'
  description: string; // Max 300 characters - when available, heroes they play, additional info
  status: StandinStatus;
  createdAt: string;
  verifiedAt?: string;
  matches?: string[]; // Array of match IDs where they are standing in
}

export interface StandinRequest {
  id: string;
  matchId: string;
  teamId: string;
  captainId: string;
  unavailablePlayers: string[]; // Player IDs who won't be available
  requestedStandins: string[]; // Standin IDs requested
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

// ============================================================
// PDL-specific types for standins, coaches, transfers, reschedules
// ============================================================

export type PDLStandinRequestStatus =
  | 'pending'       // Waiting for opponent captain approval
  | 'approved'      // Opponent captain approved
  | 'rejected'      // Opponent captain rejected
  | 'appeal_pending' // Captain appealed to admin
  | 'appeal_approved' // Admin approved the appeal
  | 'appeal_rejected'; // Admin rejected the appeal

export interface PDLStandinRequest {
  id: string;
  matchId: string;
  teamId: string;             // Requesting team
  captainId: string;          // Requesting captain UID
  replacedPlayerId: string;   // Player ID being replaced
  replacedPlayerNickname: string;
  replacedPlayerMmr?: number; // Original player's MMR (stored for MMR-limited tournaments)
  standinNickname: string;    // Standin's recognizable nickname
  standinSteamProfileUrl: string; // Link to standin's Steam profile
  standinMmr?: number;        // Standin's declared MMR (required for MMR-limited tournaments)
  standinSmurfAccounts?: { steamProfileUrl: string }[]; // Standin's smurf accounts
  /**
   * Which games of the series this standin plays (1-indexed). Omitted/empty = the whole
   * series (backward compatible). Two non-overlapping requests for the same replaced
   * player allow a different standin per game.
   */
  gameNumbers?: number[];
  // Denormalized match labels (copied at request creation) so standin history can be
  // shown as "TeamA vs TeamB — date" without loading the referenced match.
  matchTeamAName?: string;
  matchTeamBName?: string;
  matchScheduledFor?: string;
  status: PDLStandinRequestStatus;
  createdAt: string;
  updatedAt: string;
  // Opponent response
  respondedBy?: string;       // Opponent captain UID
  respondedAt?: string;
  rejectionReason?: string;
  // Admin appeal
  appealedAt?: string;
  appealResolvedBy?: string;  // Admin UID
  appealResolvedAt?: string;
  appealAdminNote?: string;
}

export interface PDLCoachAssignment {
  id: string;
  teamId: string;
  matchId: string;            // Match this coach is assigned to
  nickname: string;           // Coach's recognizable nickname
  steamProfileUrl: string;    // Link to coach's Steam profile
  assignedAt: string;
  assignedBy: string;         // Captain UID
}

export interface PDLTransferRecord {
  id: string;
  teamId: string;
  type: 'add' | 'remove';
  playerNickname: string;
  playerSteamId: string;
  playerSteamProfileUrl?: string;
  playerRole?: PlayerRole;
  performedAt: string;
  performedBy: string;        // Captain UID
  round?: number;             // Which round/transfer window
  seasonId?: string;
}

export interface PDLRescheduleRequest {
  id: string;
  matchId: string;
  requestedBy: string;        // Team ID
  requestedByName: string;    // Team name
  requestedByCaptainId: string;
  originalDate: string;
  proposedDate: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: string;       // Opponent captain UID
}

// Playoff System Types
export type PlayoffMatchFormat = 'bo1' | 'bo3' | 'bo5';
export type PlayoffMatchStatus = 'scheduled' | 'live' | 'completed' | 'bye';
export type PlayoffBracketType = 'upper' | 'lower' | 'wildcard' | 'final';

export interface PlayoffSlot {
  id: string;
  position: number; // Position in bracket (1-8 for upper, 1-8 for lower, etc.)
  teamId?: string; // null if slot is empty
  bracketType: PlayoffBracketType;
  round: number; // Which round this slot belongs to
}

export interface PlayoffMatch {
  id: string;
  matchId?: string; // Reference to regular Match if created
  bracketType: PlayoffBracketType;
  round: number;
  position: number; // Position within the round
  code?: string; // Abbreviated match code, e.g. "U2C", "L1A", "GF"
  teamASlotId?: string; // Reference to playoff slot
  teamBSlotId?: string; // Reference to playoff slot
  teamA?: { id: string; name: string; logoUrl?: string; };
  teamB?: { id: string; name: string; logoUrl?: string; };
  winnerSlotId?: string; // Where winner advances to
  loserSlotId?: string; // Where loser goes (for upper bracket)
  nextWinnerMatchId?: string; // Match ID where winner advances
  nextWinnerSlot?: 'teamA' | 'teamB'; // Which slot the winner fills
  nextLoserMatchId?: string; // Match ID where loser drops (UB only)
  nextLoserSlot?: 'teamA' | 'teamB'; // Which slot the loser fills
  format: PlayoffMatchFormat; // bo1, bo3, bo5
  status: PlayoffMatchStatus;
  result?: {
    winnerId: string;
    loserId: string;
    teamAScore: number;
    teamBScore: number;
    completedAt: string;
  };
  deadline?: string; // ISO date — deadline for match to be played
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayoffBracket {
  id: string;
  name: string; // e.g., "Upper Bracket", "Lower Bracket", "Wildcards"
  type: PlayoffBracketType;
  slots: PlayoffSlot[];
  matches: PlayoffMatch[];
  isActive: boolean;
}

export interface PlayoffData {
  id: string;
  name: string; // Tournament name
  brackets: PlayoffBracket[];
  wildcardSlots: number; // Number of wildcard spots (default 2)
  isSetup: boolean; // Whether admin has completed initial setup
  createdAt: string;
  updatedAt: string;
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

export type NotificationType = 
  | 'standin_approval_required'
  | 'reschedule_approval_required'
  | 'admin_message'
  | 'match_reminder_24h'
  | 'transfer_window_opened'
  | 'transfer_window_closing'
  | 'standin_request_approved'
  | 'standin_request_denied'
  | 'reschedule_request_approved'
  | 'reschedule_request_denied'
  | 'admin_announcement'
  | 'promotion_relegation_match';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export type NotificationRecipientType = 'team' | 'player' | 'captain';

export interface NotificationMetadata {
  // Standin-related
  requestId?: string;
  standinName?: string;
  standinSteamId?: string;
  opponentTeamName?: string;
  denialReason?: string;

  // Match-related
  matchId?: string;
  matchTime?: string;
  opponentName?: string;
  checklistComplete?: boolean;

  // Reschedule-related
  originalDate?: string;
  proposedDate?: string;
  newDate?: string;
  approvedBy?: 'opponent' | 'admin';
  deniedBy?: 'opponent' | 'admin';

  // Transfer window
  windowCloses?: string;
  maxTransfers?: number;
  remainingTransfers?: number;

  // Promotion/Relegation
  matchType?: 'promotion' | 'relegation';
  divisionMovement?: string;

  // Admin message
  requiresResponse?: boolean;
  responseDeadline?: string;
}

export interface Notification {
  id: string;
  tournamentId: string;
  type: NotificationType;
  priority: NotificationPriority;
  recipientType: NotificationRecipientType;
  recipientId: string; // teamId or userId depending on recipientType
  title: string;
  message: string;
  metadata: NotificationMetadata;
  createdAt: string;
  expiresAt?: string;
  read: boolean;
  dismissed: boolean;
  actionable: boolean;
  actionTaken?: boolean;
  actionTakenAt?: string;
}
