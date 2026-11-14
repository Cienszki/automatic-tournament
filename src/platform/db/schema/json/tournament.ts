// JSON columns of `app.tournaments` (SCHEMA.md 4.1 to 4.5).

import { z } from 'zod';
import { id, isoTime, steam64, url } from './common';

const color = z.string().max(100);
const font = z.string().max(200);

// 4.1 ------------------------------------------------------------------------------------------

export const customFontSchema = z.object({
  id: z.string(),
  family: z.string(),
  type: z.enum(['google', 'local']),
  variants: z.array(z.string()),
  category: z.string(),
  path: z.string().optional(),
}).strict();

export const themeSchema = z.object({
  version: z.literal(1),
  colors: z.object({
    primary: color, secondary: color, accent: color, background: color, backgroundGradient: color.optional(),
    card: color, text: color, mutedText: color, border: color, glow: color.optional(), heading: color.optional(),
    link: color.optional(), title: color.optional(), sectionHeader: color.optional(), primaryText: color.optional(),
    secondaryText: color.optional(), navbar: color.optional(), navbarText: color.optional(),
  }).strict(),
  fonts: z.object({
    header: font, body: font, text: font.optional(), readable: font.optional(), rulesContent: font.optional(),
    navbar: font.optional(), custom: z.array(customFontSchema),
  }).strict(),
  background: z.object({
    imageUrl: url.optional(), overlayColor: color.optional(), overlayOpacity: z.number().min(0).max(100).optional(),
    blur: z.number().min(0).optional(), position: z.string().optional(), size: z.string().optional(),
  }).strict(),
  navbar: z.object({
    style: z.enum(['solid', 'transparent', 'blur']),
    opacity: z.number().min(0).max(100).optional(),
    blur: z.number().min(0).optional(),
  }).strict(),
  card: z.object({
    opacity: z.number().min(0).max(100).optional(), blur: z.number().min(0).optional(), radius: z.string().optional(),
  }).strict(),
  mode: z.enum(['dark', 'light', 'auto']),
  logos: z.object({
    main: url.optional(), inline: url.optional(), organizer: url.optional(), favicon: url.optional(),
  }).strict(),
}).strict();
export type Theme = z.infer<typeof themeSchema>;

/** An organization's defaults: any part of a theme. */
export const brandingSchema = themeSchema.partial();

// 4.2 ------------------------------------------------------------------------------------------

const heroVideo = z.object({
  url, mobileUrl: url.optional(), posterUrl: url.optional(), bunnyVideoId: z.string().optional(),
}).strict();
const heroSlot = z.object({ type: z.enum(['image', 'video']).optional(), video: heroVideo.optional() }).strict();

export const presentationSchema = z.object({
  hero: z.object({
    title: z.string().optional(),
    layout: z.enum(['logo-promo', 'three-images', 'video']).optional(),
    leftImageUrl: url.optional(), rightImageUrl: url.optional(), promoImageUrl: url.optional(),
    media: z.object({
      logo: heroSlot.optional(), promo: heroSlot.optional(), left: heroSlot.optional(),
      right: heroSlot.optional(), full: heroSlot.optional(),
    }).strict().optional(),
    videoCrt: z.boolean().optional(),
    trailerUrl: url.optional(),
  }).strict(),
  sponsor: z.object({
    enabled: z.boolean(),
    slides: z.array(z.object({
      id: z.string(), type: z.enum(['text', 'image']), content: z.string(), altText: z.string().optional(),
    }).strict()),
    url: url.optional(), intervalMs: z.number().int().positive().optional(), widthPx: z.number().int().positive().optional(),
  }).strict(),
  links: z.object({
    twitch: url.optional(), discord: url.optional(), youtube: url.optional(), instagram: url.optional(), tiktok: url.optional(),
  }).strict(),
  prizesPage: z.object({ displayMode: z.string().optional(), imageUrl: url.optional() }).strict(),
}).strict();
export type Presentation = z.infer<typeof presentationSchema>;

// 4.3 ------------------------------------------------------------------------------------------

export const settingsSchema = z.object({
  registration: z.object({
    enabled: z.boolean(), opensAt: isoTime.optional(), closesAt: isoTime.optional(),
    maxTeams: z.number().int().positive().optional(), requireApproval: z.boolean(),
  }).strict(),
  teams: z.object({
    size: z.number().int().positive(),
    minPlayers: z.number().int().positive().optional(), maxPlayers: z.number().int().positive().optional(),
    allowSubstitutes: z.boolean().optional(), maxSubstitutes: z.number().int().min(0).optional(),
    mmrCap: z.number().int().positive().optional(), mmrVerification: z.boolean(),
    coachMode: z.enum(['disabled', 'pre-season', 'per-game', 'flexible']),
    requireCoach: z.boolean().optional(),
  }).strict(),
  scheduling: z.object({
    method: z.enum(['captain', 'admin', 'fixed']),
    rescheduleRangeDays: z.number().int().min(0).optional(),
    rescheduleFinalAt: isoTime.optional(),
    rescheduleEarlierOnly: z.boolean().optional(),
    forfeitMinutes: z.number().int().min(0).optional(),
    lateGraceMinutes: z.number().int().min(0).optional(),
  }).strict(),
  standins: z.object({
    enabled: z.boolean(), requireRegistration: z.boolean(), requireOpponentApproval: z.boolean(),
    adminCanOverride: z.boolean(), maxPerMatch: z.number().int().min(0), maxPerRound: z.number().int().min(0).optional(),
    mmrRestrictions: z.boolean(),
  }).strict(),
  transfers: z.object({
    windowOpen: z.boolean(), maxPerWindow: z.number().int().min(0).optional(), maxPerSeason: z.number().int().min(0).optional(),
  }).strict(),
  discord: z.object({ guildId: z.string().regex(/^\d{15,22}$/).optional(), requireMember: z.boolean().optional() }).strict(),
  lobby: z.object({
    leagueName: z.string().optional(), gameMode: z.string().optional(), server: z.string().optional(),
    visibility: z.string().optional(), dotatvDelayMinutes: z.number().int().min(0).optional(),
    latePenaltyGameMinutes: z.number().int().min(0).optional(), latePenaltySeriesMinutes: z.number().int().min(0).optional(),
    botLobbyEnabled: z.boolean().optional(), selectionPriorityRules: z.number().int().optional(),
  }).strict(),
}).strict();
export type TournamentSettings = z.infer<typeof settingsSchema>;

// 4.4 ------------------------------------------------------------------------------------------

/** Today's per-tournament fantasy numbers, kept only to check old seasons against their preset. */
const legacyScoring = z.record(z.union([z.number(), z.record(z.record(z.number()))]));

export const featuresSchema = z.object({
  fantasy: z.object({
    enabled: z.boolean(), type: z.enum(['round-based', 'season-long']), rosterSize: z.number().int().positive(),
    budget: z.number(), budgetType: z.string().optional(), maxTransfersPerRound: z.number().int().min(0).optional(),
    lockBeforeMatchday: z.boolean(), lockTime: z.string().optional(), priceChangePercentage: z.number().optional(),
    legacyScoring: legacyScoring.optional(),
  }).strict(),
  pickem: z.object({
    enabled: z.boolean(), matchPredictions: z.boolean(), standingsPredictions: z.boolean(), playoffBracket: z.boolean(),
    mvpPredictions: z.boolean(), lockTime: z.enum(['before-season', 'before-round', 'before-match']),
    byeTeamsCount: z.number().int().min(0).optional(), instructionsMarkdown: z.string().optional(),
    submissionDeadline: isoTime.optional(),
  }).strict(),
  cards: z.object({
    enabled: z.boolean(), roundPacks: z.number().int().min(0), howTo: z.string().optional(), twitchChannels: z.array(z.string()),
  }).strict(),
  prizes: z.object({ enabled: z.boolean() }).strict(),
}).strict();
export type TournamentFeatures = z.infer<typeof featuresSchema>;

// 4.5 ------------------------------------------------------------------------------------------

export const lobbySettingsSchema = z.object({
  gameMode: z.enum(['all_pick', 'captains_mode', 'captains_draft', 'random_draft', 'single_draft', 'all_random', 'turbo']),
  serverRegion: z.enum([
    'us_west', 'us_east', 'europe_west', 'europe_east', 'russia', 'southeast_asia', 'south_america', 'australia',
    'dubai', 'chile', 'peru', 'india', 'japan', 'south_africa',
  ]),
  visibility: z.enum(['public', 'friends_only', 'unlisted']),
  cheatsEnabled: z.boolean(),
  fillWithBots: z.boolean(),
  dotaTvDelay: z.number().int().min(0),
  allowSpectators: z.boolean(),
  pauseSetting: z.enum(['unlimited', 'limited', 'disabled']),
  leagueId: z.number().int().positive().optional(),
  password: z.string().optional(),
  selectionPriorityRules: z.number().int().optional(),
}).strict();

export const readyCheckSchema = z.object({
  readyCommands: z.array(z.string()), unreadyCommands: z.array(z.string()), captainOnly: z.boolean(),
}).strict();

export const chatMessagesSchema = z.object({
  welcomeMessage: z.string(), teamNotReadyMessage: z.string(), teamReadyMessage: z.string(), allReadyMessage: z.string(),
  requirementsNotMetPrefix: z.string(), rulesReminder: z.string().optional(), matchStartMessage: z.string().optional(),
  unauthorizedKickMessage: z.string().optional(),
  customCommands: z.array(z.object({ trigger: z.string(), response: z.string() }).strict()),
}).strict();

export const enforcementSchema = z.object({
  autoKickUnauthorized: z.boolean(), autoKickWrongSlot: z.boolean(), wrongSlotGracePeriodSeconds: z.number().int().min(0),
}).strict();

export const lateArrivalSchema = z.object({
  enabled: z.boolean(), game1ForfeitMinutes: z.number().int().min(0), seriesForfeitMinutes: z.number().int().min(0),
  waitCommands: z.array(z.string()), forfeitCommands: z.array(z.string()), votingWindowSeconds: z.number().int().min(0),
  requiredVotesForForfeit: z.number().int().min(0), waitExtensionMinutes: z.number().int().min(0),
  lateGame1AnnouncementTemplate: z.string(), lateSeriesAnnouncementTemplate: z.string(), waitResultTemplate: z.string(),
  forfeitGame1Template: z.string(), forfeitSeriesTemplate: z.string(), noVoteResultTemplate: z.string(),
  interGameBreakMinutes: z.number().int().min(0),
}).strict();

export const botSettingsSchema = z.object({
  enabled: z.boolean(),
  lobby: lobbySettingsSchema,
  readyCheck: readyCheckSchema,
  chatMessages: chatMessagesSchema,
  postMatch: z.object({ syncDelayMinutes: z.number().int().min(0), autoSyncEnabled: z.boolean() }).strict(),
  enforcement: enforcementSchema,
  lateArrival: lateArrivalSchema,
  lobbyCreationLeadMinutes: z.number().int().min(0),
  pendingSessionTimeoutMinutes: z.number().int().min(0),
  botAssignedTimeoutMinutes: z.number().int().min(0),
  lobbyOpenWarningMinutes: z.number().int().min(0),
  lobbyOpenTimeoutMinutes: z.number().int().min(0),
  readyCheckTimeoutMinutes: z.number().int().min(0),
  perBotMessages: z.record(chatMessagesSchema.partial()).optional(),
  passwordVisibleToPlayers: z.boolean(),
  /** Entries added by hand; casters are added per session from the tournament's members. */
  whitelist: z.array(z.object({
    steamId64: steam64, displayName: z.string(), note: z.string().optional(), addedAt: isoTime, addedBy: id,
  }).strict()),
}).strict();
export type BotSettings = z.infer<typeof botSettingsSchema>;
