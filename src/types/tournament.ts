// src/types/tournament.ts
// Core tournament types for the multi-tournament platform

/**
 * Tournament type determines the format and features available
 *
 * - 'mmr-limited' — group stage + playoffs, teams capped by summed player MMR
 * - 'league'      — divisions, round-robin season, promotion/relegation
 * - 'swiss'       — Swiss-system pairing on score, seeded by self-reported team
 *                   average MMR, optional cut to playoffs
 *
 * When branching on this, always test for the type you mean. A negation such as
 * `!isLeague` predates the third type and silently treats Swiss as MMR-limited.
 */
export type TournamentType = 'mmr-limited' | 'league' | 'swiss';

/**
 * Tournament status for visibility and functionality
 */
export type TournamentStatus = 'draft' | 'registration' | 'active' | 'completed' | 'archived';

/**
 * Tournament visibility in navigation
 */
export type TournamentVisibility = 'active' | 'inactive' | 'archived';

/**
 * Match format options
 */
export type MatchFormat = 'bo1' | 'bo2' | 'bo3' | 'bo5' | 'bo7';

/**
 * Scheduling method for matches
 */
export type SchedulingMethod = 'captain-scheduled' | 'admin-scheduled' | 'fixed-schedule';

/**
 * Fantasy system type
 */
export type FantasyType = 'round-based' | 'season-long';

/**
 * Coach registration mode
 */
export type CoachMode = 'disabled' | 'pre-season' | 'per-game' | 'flexible';

/**
 * Division configuration for league tournaments
 */
export interface DivisionConfig {
  id: string;
  name: string;
  tier: number; // 1 = top division (Elite), 2 = second (Challenger), etc.
  teamsCount?: number;
  matchday?: string; // e.g., "Thursday 20:00"
  color?: string; // For UI display
}

/**
 * A single slide in the navbar sponsor section
 */
export interface NavbarSponsorSlide {
  id: string;            // unique id for React keys / upload paths
  type: 'text' | 'image';
  content: string;       // text string OR image URL
  altText?: string;      // alt text for image slides
}

/**
 * Navbar sponsor section configuration
 */
export interface NavbarSponsorConfig {
  enabled: boolean;
  slides?: NavbarSponsorSlide[];  // Dynamic slides to cycle through
  url?: string;                   // Optional click URL for the whole section
  intervalMs?: number;            // Milliseconds between slide transitions (default: 5000)
  widthPx?: number;               // Fixed pixel width of the sponsor container (default: 200)
  // Legacy fields kept for backward compatibility (not used in new admin UI)
  sponsorName?: string;
  sponsorImageUrl?: string;
  sponsorUrl?: string;
  secondaryText?: string;
}

/**
 * Theme configuration for tournament branding
 */
export interface TournamentTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  backgroundGradient?: string;
  cardColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  headerFont: string;
  bodyFont: string;
  textFont?: string; // Additional font option for body text
  readableFont?: string; // Font for improved readability
  rulesContentFont?: string; // Font specifically for rules page paragraph content
  logoUrl: string;
  inlineLogoUrl?: string | null;
  organizerLogoUrl?: string | null; // Tournament organizer / brand logo (shown on diplomas etc.)
  faviconUrl?: string;
  backgroundImageUrl?: string;
  // Extended theming options
  backgroundOverlayColor?: string; // Overlay color on top of background image (e.g., 'rgba(0,0,0,0.7)')
  backgroundOverlayOpacity?: number; // 0-100 opacity for background image
  backgroundBlur?: number; // px blur applied to background image
  backgroundPosition?: string; // CSS background-position (e.g., 'center top')
  backgroundSize?: string; // CSS background-size (e.g., 'cover', 'contain')
  navbarStyle?: 'solid' | 'transparent' | 'blur'; // Navbar visual style
  navbarColor?: string; // Custom navbar background color
  navbarOpacity?: number; // 0-100 opacity for navbar background (100 = fully opaque)
  navbarBlur?: number; // Backdrop blur amount in px for navbar (only active when navbarStyle='blur')
  navbarTextColor?: string; // Custom text color for navbar links
  navbarFont?: string; // Font key for navbar (overrides global header font)
  cardOpacity?: number; // 0-100 opacity for card backgrounds
  cardBlur?: number; // Backdrop blur for cards (glassmorphism)
  cardBorderRadius?: string; // Border radius for cards (e.g., '0.75rem')
  glowColor?: string; // Glow/accent highlight color for interactive elements
  headingColor?: string; // Custom color for headings (defaults to textColor)
  linkColor?: string; // Custom color for links (defaults to primaryColor)
  themeStyle?: 'dark' | 'light' | 'auto'; // Overall dark/light mode
  // Text hierarchy colors (for my-team page and general content)
  titleColor?: string; // Main title / team name color (e.g. "Test1")
  sectionHeaderColor?: string; // Section header text color (e.g. "Postęp Sezonu")
  primaryTextColor?: string; // Primary label text color (e.g. "Punkty", "Dywizja")
  secondaryTextColor?: string; // Secondary / muted text color (e.g. "0 rund pozostało")
}

/**
 * Fantasy scoring configuration
 */
export interface FantasyScoringConfig {
  killPoints: number;
  deathPoints: number;
  assistPoints: number;
  lastHitPoints: number;
  gpmPoints: number;
  xpmPoints: number;
  towerKillPoints: number;
  roshanKillPoints: number;
  obsPlacedPoints: number;
  senPlacedPoints: number;
  teamWinPoints: number;
  mvpBonusPoints?: number;
  // Role-specific multipliers (optional, for MMR tournaments)
  roleMultipliers?: {
    carry?: { kills: number; deaths: number; gold: number };
    mid?: { kills: number; deaths: number; assists: number };
    offlane?: { kills: number; deaths: number; assists: number };
    softSupport?: { kills: number; deaths: number; assists: number };
    hardSupport?: { kills: number; deaths: number; assists: number };
  };
}

/**
 * Fantasy configuration for a tournament
 */
export interface FantasyConfig {
  enabled: boolean;
  type: FantasyType;
  rosterSize: number;
  budget: number; // For season-long: currency units, for round-based: MMR cap
  maxTransfersPerRound?: number;
  lockBeforeMatchday: boolean;
  scoring: FantasyScoringConfig;
  priceChangePercentage?: number; // How much prices change based on transfers
}

/**
 * Pick'em configuration
 */
export interface PickemConfig {
  enabled: boolean;
  matchPredictions: boolean;
  standingsPredictions: boolean;
  playoffBracket: boolean;
  mvpPredictions: boolean;
  lockTime: 'before-season' | 'before-round' | 'before-match';
  // MMR tournaments: number of synthetic BYE entries locked to the lowest placement basket.
  byeTeamsCount?: number;
  // Optional tournament-specific instructions shown above the drag-and-drop board.
  instructionsMarkdown?: string;
  // Optional absolute deadline after which users cannot submit Pick'em predictions.
  submissionDeadline?: string;
}

/**
 * Standin configuration
 */
export interface StandinConfig {
  enabled: boolean;
  requireRegistration: boolean; // MMR tournaments require pre-registration
  requireOpponentApproval: boolean; // League tournaments need captain approval
  adminCanOverride: boolean;
  maxPerMatch: number;
  maxPerRound?: number; // Same standin can only play once per round
  mmrRestrictions: boolean;
}

/**
 * Group configuration for MMR-limited tournaments
 * Groups are manually created/named and teams are manually assigned by admin
 */
export interface GroupConfig {
  id: string;
  name: string; // e.g. "Group A", "Group B"
  teams: string[]; // Team IDs assigned to this group
  teamsToUpperBracket: number; // How many teams advance to UB
  teamsToLowerBracket: number; // How many teams advance to LB
  wildcardSpots: number; // How many teams go to wildcard bracket
}

/**
 * Swiss-system configuration.
 *
 * Swiss rounds are generated one at a time — round N+1's pairings depend on
 * round N's results — so most of the per-round detail lives on the
 * `tournaments/{id}/swissRounds/{round}` documents rather than here.
 */
export interface SwissConfig {
  /** Total rounds the admin intends to play. null = open-ended, ended manually. */
  plannedRounds: number | null;
  /** Highest round generated so far. 0 = not started. */
  currentRound: number;
  /** Default series format for a new round; each round stores its own. */
  defaultMatchFormat: MatchFormat;
  /**
   * When false (the default) a pairing may not repeat the immediately-previous
   * round's opponent. Always satisfiable for 4+ teams, so this cannot deadlock
   * the pairing solver; exposed as an escape hatch for tiny or polarised fields.
   */
  allowConsecutiveRematch: boolean;
  /** Team doc id of the virtual BYE opponent, created only for odd fields. */
  byeTeamId: string | null;
  /** The single auto-created division that holds the whole Swiss field. */
  divisionId: string | null;
}

/**
 * A single generated Swiss round.
 * Stored at `tournaments/{tournamentId}/swissRounds/{round}`.
 */
export interface SwissRound {
  round: number;
  /** 'draft' is a regenerable preview; committing writes the match documents. */
  status: 'draft' | 'committed' | 'complete';
  matchFormat: MatchFormat;
  scheduling: {
    mode: 'fixed' | 'window' | 'free';
    fixedAt?: string;
    windowStart?: string;
    windowEnd?: string;
  };
  pairings: {
    teamAId: string;
    teamBId: string;
    matchId: string;
    isBye: boolean;
  }[];
  /**
   * Standings frozen at commit time, so "why were we paired with them?" stays
   * answerable after later results have moved the table.
   */
  standingsSnapshot: SwissStandingRow[];
  generatedAt: string;
  committedAt?: string;
}

/**
 * One row of the Swiss table. Derived from matches, never stored as the source
 * of truth (except in a round's `standingsSnapshot` audit copy).
 */
export interface SwissStandingRow {
  teamId: string;
  /** The Swiss score: games won across all completed series. */
  points: number;
  gamesWon: number;
  gamesLost: number;
  matchWins: number;
  matchLosses: number;
  /** Sum of opponents' points — schedule strength. Byes contribute 0. */
  buchholz: number;
  opponentIds: string[];
  byeCount: number;
  seedMmr?: number;
  seedPosition?: number;
}

/**
 * Playoff configuration
 */
export interface PlayoffConfig {
  enabled: boolean;
  /** When true the playoffs section/navbar button is visible to all users. */
  playoffsVisible?: boolean;
  format: 'single-elimination' | 'double-elimination';
  teamsCount: number;
  upperBracketTeams?: number; // Teams starting in upper bracket (for double elimination)
  lowerBracketTeams?: number; // Teams starting in lower bracket (for double elimination)
  wildcardSpots: number;
  thirdPlaceMatch: boolean;
  thirdPlaceFormat: MatchFormat;
  semifinalFormat: MatchFormat;
  finalFormat: MatchFormat;
  grandFinalFormat: MatchFormat;
}

/**
 * Main tournament configuration
 */
export interface TournamentConfig {
  // Basic info
  id: string;
  slug: string; // URL-friendly identifier
  name: string;
  heroTitle?: string; // Custom title for the main page hero section (falls back to name)
  shortName?: string;
  description?: string;
  promotionalImageUrl?: string; // Uploadable promotional image shown on the home page hero view
  heroLayout?: 'logo-promo' | 'three-images'; // Which layout to use for VIEW 1 on the home page
  heroLeftImageUrl?: string; // Left side image for the 'three-images' hero layout
  heroRightImageUrl?: string; // Right side image for the 'three-images' hero layout
  organizerId: string;
  
  // Type and status
  type: TournamentType;
  status: TournamentStatus;
  visibility: TournamentVisibility;
  /**
   * Opaque token unlocking a draft tournament for preview at
   * `/[slug]?preview=<token>`. Rotatable from the admin panel.
   */
  previewToken?: string;
  
  // Dates
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Registration slot cap. null/undefined = unlimited. */
  maxTeams?: number | null;
  startDate: string;
  endDate?: string;
  
  // Dota 2 integration
  leagueId?: number; // Valve League ID

  // Lobby / match rules configuration
  lobbySettings?: {
    leagueName?: string;         // e.g. "PDL Season 1" — used as lobby name prefix
    gameMode?: string;           // e.g. "Captains Mode"
    server?: string;             // e.g. "EU West"
    visibility?: string;         // e.g. "Publiczna"
    dotatvDelayMinutes?: number; // e.g. 5
    latePenaltyGameMinutes?: number;   // forfeit one game, default 15
    latePenaltySeriesMinutes?: number; // forfeit series, default 30
    botLobbyEnabled?: boolean;   // when true, bot creates lobby automatically (instead of captain)
    selectionPriorityRules?: number; // 1=Automatic (coin toss), 0=Manual (no coin toss)
  };

  // Social/Streaming
  twitchUrl?: string; // Full Twitch URL (e.g., https://www.twitch.tv/pd2ih)
  discordUrl?: string; // Full Discord invite URL (e.g., https://discord.gg/pd2ih)
  youtubeUrl?: string; // Full YouTube channel URL
  instagramUrl?: string; // Full Instagram profile URL
  tiktokUrl?: string; // Full TikTok profile URL
  trailerUrl?: string; // YouTube trailer/promo video URL (shown as button on homepage)
  
  // Legacy field for backwards compatibility
  twitchChannel?: string; // @deprecated Use twitchUrl instead
  
  // Team configuration
  teamSize: number;
  mmrCap?: number; // Only for mmr-limited tournaments
  mmrVerificationRequired: boolean;
  coachMode: CoachMode;
  
  // Match configuration
  defaultMatchFormat: MatchFormat;
  schedulingMethod: SchedulingMethod;
  rescheduleRangeDays?: number | null; // max days captains can shift a match date (null = unlimited, default: 3)
  rescheduleFinalDate?: string;        // hard cutoff ISO date after which no reschedule requests are allowed
  
  // Division configuration (for leagues)
  divisions?: DivisionConfig[];
  roundsPerSeason?: number;
  currentRound?: number; // Current round number for tracking progress
  promotionRelegationEnabled?: boolean;
  
  // Group stage configuration (for MMR tournaments)
  groupsCount?: number;
  teamsPerGroup?: number;
  groupMatchFormat?: MatchFormat; // Match format for group stage (bo1, bo2, bo3...)

  // Swiss configuration (for swiss tournaments)
  swiss?: SwissConfig;

  // Feature configurations
  fantasy: FantasyConfig;
  pickem: PickemConfig;
  standins: StandinConfig;
  playoffs: PlayoffConfig;
  
  // Transfer/roster configuration (for leagues)
  transferWindowOpen?: boolean; // Whether the transfer window is currently open
  maxTransfersPerWindow?: number; // Max allowed roster changes per transfer window (default: 2)
  maxTransfersPerSeason?: number; // Max allowed roster changes per entire season (default: 6)
  
  // Custom fonts (Google Fonts + Local Fonts integration)
  customFonts?: Array<{
    id: string;
    family: string;
    type: 'google' | 'local';
    variants: string[];
    category: string;
    path?: string; // For local fonts
  }>;
  
  // Branding
  theme: TournamentTheme;

  // Navbar sponsor section
  navbarSponsor?: NavbarSponsorConfig;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Tournament summary for listing
 */
export interface TournamentSummary {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  type: TournamentType;
  status: TournamentStatus;
  visibility: TournamentVisibility;
  logoUrl: string;
  primaryColor: string;
  startDate: string;
  endDate?: string;
  teamsCount: number;
  organizerId: string;
}

/**
 * Season configuration for league tournaments
 */
export interface SeasonConfig {
  id: string;
  tournamentId: string;
  seasonNumber: number;
  name: string; // e.g., "Season 1", "Winter 2026"
  startDate: string;
  endDate: string;
  leagueId?: number;
  divisions: DivisionConfig[];
  currentRound: number;
  totalRounds: number;
  status: 'upcoming' | 'active' | 'playoffs' | 'completed';
}

/**
 * Division standings entry
 */
export interface DivisionStanding {
  teamId: string;
  teamName: string;
  teamLogoUrl: string;
  divisionId: string;
  position: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor?: number; // Total kills in Dota context
  goalsAgainst?: number; // Total deaths
  goalDifference?: number;
  headToHead: Record<string, 'win' | 'loss' | 'draw' | null>;
  neustadtlScore: number; // Sonnenborn-Berger tiebreaker
  form: ('W' | 'D' | 'L')[]; // Last 5 matches
}

/**
 * Promotion/Relegation match
 */
export interface PromotionMatch {
  id: string;
  seasonId: string;
  round: number;
  upperDivisionId: string;
  lowerDivisionId: string;
  upperDivisionTeamId: string;
  lowerDivisionTeamId: string;
  matchId?: string; // Reference to the actual match
  status: 'pending' | 'scheduled' | 'completed';
  winnerId?: string;
  promoted?: boolean; // True if lower team won
}

/**
 * Commentator profile
 */
export interface Commentator {
  userId: string;
  displayName: string;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  matchesCast: number;
  bio?: string;
  twitchUrl?: string;
  discordUsername: string;
}

/**
 * Commentator match request
 */
export interface CommentatorRequest {
  id: string;
  commentatorId: string;
  matchId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
  respondedBy?: string;
}

/**
 * Coach registration
 */
export interface Coach {
  id: string;
  teamId: string;
  userId: string;
  displayName: string;
  discordUsername: string;
  registeredAt: string;
  validFrom?: string; // For per-game registration
  validUntil?: string;
  approvedBy?: string;
}

/**
 * User achievement/badge
 */
export interface Achievement {
  id: string;
  userId: string;
  type: 'tournament-winner' | 'season-champion' | 'mvp' | 'custom';
  tournamentId: string;
  seasonId?: string;
  name: string;
  description: string;
  iconUrl?: string;
  awardedAt: string;
}

/**
 * Organizer profile
 */
export interface Organizer {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  discordUrl?: string;
  twitchUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  createdAt: string;
}

// Default configurations for quick tournament setup
export const DEFAULT_MMR_TOURNAMENT_CONFIG: Partial<TournamentConfig> = {
  type: 'mmr-limited',
  teamSize: 5,
  mmrCap: 24000,
  mmrVerificationRequired: true,
  coachMode: 'disabled',
  defaultMatchFormat: 'bo2',
  schedulingMethod: 'captain-scheduled',
  groupMatchFormat: 'bo2',
  fantasy: {
    enabled: true,
    type: 'round-based',
    rosterSize: 5,
    budget: 24000,
    lockBeforeMatchday: true,
    scoring: {
      killPoints: 2.5,
      deathPoints: -2.5,
      assistPoints: 1,
      lastHitPoints: 0.003,
      gpmPoints: 0.002,
      xpmPoints: 0.002,
      towerKillPoints: 1,
      roshanKillPoints: 3,
      obsPlacedPoints: 0.5,
      senPlacedPoints: 0.25,
      teamWinPoints: 10,
    },
  },
  pickem: {
    enabled: true,
    matchPredictions: true,
    standingsPredictions: true,
    playoffBracket: true,
    mvpPredictions: false,
    lockTime: 'before-round',
  },
  standins: {
    enabled: true,
    requireRegistration: true,
    requireOpponentApproval: false,
    adminCanOverride: true,
    maxPerMatch: 2,
    mmrRestrictions: true,
  },
  playoffs: {
    enabled: true,
    format: 'double-elimination',
    teamsCount: 8,
    wildcardSpots: 2,
    thirdPlaceMatch: false,
    thirdPlaceFormat: 'bo3',
    semifinalFormat: 'bo3',
    finalFormat: 'bo3',
    grandFinalFormat: 'bo5',
  },
};

export const DEFAULT_LEAGUE_CONFIG: Partial<TournamentConfig> = {
  type: 'league',
  teamSize: 5,
  mmrVerificationRequired: false,
  coachMode: 'per-game',
  defaultMatchFormat: 'bo2',
  schedulingMethod: 'admin-scheduled',
  promotionRelegationEnabled: true,
  fantasy: {
    enabled: true,
    type: 'season-long',
    rosterSize: 5,
    budget: 100,
    maxTransfersPerRound: 2,
    lockBeforeMatchday: true,
    priceChangePercentage: 4,
    scoring: {
      killPoints: 0.3,
      deathPoints: 0,
      assistPoints: 0.15,
      lastHitPoints: 0.003,
      gpmPoints: 0.002,
      xpmPoints: 0.002,
      towerKillPoints: 0.75,
      roshanKillPoints: 0.5,
      obsPlacedPoints: 0.05,
      senPlacedPoints: 0.05,
      teamWinPoints: 4,
    },
  },
  pickem: {
    enabled: true,
    matchPredictions: false,
    standingsPredictions: true,
    playoffBracket: true,
    mvpPredictions: false,
    lockTime: 'before-season',
  },
  standins: {
    enabled: true,
    requireRegistration: false,
    requireOpponentApproval: true,
    adminCanOverride: true,
    maxPerMatch: 1,
    maxPerRound: 1,
    mmrRestrictions: false,
  },
  playoffs: {
    enabled: true,
    format: 'single-elimination',
    teamsCount: 4,
    wildcardSpots: 0,
    thirdPlaceMatch: false,
    thirdPlaceFormat: 'bo3',
    semifinalFormat: 'bo3',
    finalFormat: 'bo3',
    grandFinalFormat: 'bo5',
  },
};

export const DEFAULT_SWISS_CONFIG: Partial<TournamentConfig> = {
  type: 'swiss',
  teamSize: 5,
  // No cap, and no per-player MMR is collected — a team self-reports one average
  // for seeding, so there is nothing to verify against.
  mmrCap: null as unknown as undefined,
  mmrVerificationRequired: false,
  coachMode: 'disabled',
  defaultMatchFormat: 'bo2',
  // The admin picks a scheduling mode per round; this is only the default.
  schedulingMethod: 'captain-scheduled',
  swiss: {
    plannedRounds: null,
    currentRound: 0,
    defaultMatchFormat: 'bo2',
    allowConsecutiveRematch: false,
    byeTeamId: null,
    divisionId: null,
  },
  // Fantasy prices players by MMR, which Swiss does not collect. Pick'em needs a
  // known schedule, but Swiss round N+1 does not exist until round N completes.
  // Both stay off; see the plan's "Known limitations".
  fantasy: {
    enabled: false,
    type: 'round-based',
    rosterSize: 5,
    budget: 100,
    lockBeforeMatchday: true,
    scoring: {
      killPoints: 3,
      deathPoints: -3,
      assistPoints: 1.5,
      lastHitPoints: 0.015,
      gpmPoints: 1,
      xpmPoints: 0,
      towerKillPoints: 0.75,
      roshanKillPoints: 0.5,
      obsPlacedPoints: 0.05,
      senPlacedPoints: 0.05,
      teamWinPoints: 4,
    },
  },
  pickem: {
    enabled: false,
    matchPredictions: true,
    standingsPredictions: false,
    playoffBracket: false,
    mvpPredictions: false,
    lockTime: 'before-round',
  },
  standins: {
    enabled: true,
    requireRegistration: false,
    requireOpponentApproval: true,
    adminCanOverride: true,
    maxPerMatch: 1,
    maxPerRound: 1,
    mmrRestrictions: false,
  },
  // Optional for Swiss — a future organiser may run Swiss with no playoff stage.
  // Seeding into the bracket stays fully manual in PlayoffsTab.
  playoffs: {
    enabled: true,
    format: 'single-elimination',
    teamsCount: 4,
    wildcardSpots: 0,
    thirdPlaceMatch: false,
    thirdPlaceFormat: 'bo3',
    semifinalFormat: 'bo3',
    finalFormat: 'bo3',
    grandFinalFormat: 'bo5',
  },
};
