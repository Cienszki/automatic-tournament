// The zod schema of every jsonb column, by `schema.table.column`. A test walks the table
// definitions and fails if a jsonb column is missing here, so no JSON column goes unvalidated.

import type { ZodTypeAny } from 'zod';
import { jsonObject, jsonValue } from './common';
import {
  botSettingsSchema, brandingSchema, featuresSchema, presentationSchema, settingsSchema, themeSchema,
} from './tournament';
import { advancementSchema, groupSettingsSchema, stageSettingsSchema, stageStateSchema } from './formats';
import { notifyPrefsSchema, organizationLinksSchema, smurfAccountsSchema, topHeroesSchema } from './people';
import { draftPenaltiesSchema, performanceExtraSchema, picksBansSchema, pickemPredictionsSchema } from './results';
import {
  cardsSchema, deckSlotsSchema, duelPeopleSchema, duelResultSchema, engineStateSchema, pendingFindSchema, reportPayloadSchema,
} from './cards';
import { lobbyErrorSchema, lobbyProgressSchema, lobbyRequestSchema, workerDetailsSchema } from './bot';

export const jsonColumnSchemas = {
  'app.users.notify_prefs': notifyPrefsSchema,
  'app.players.top_heroes': topHeroesSchema,
  'app.audit_log.data': jsonObject,
  'app.jobs.payload': jsonObject,
  'app.platform_settings.value': jsonValue,
  'app.organizations.links': organizationLinksSchema,
  'app.organizations.branding': brandingSchema,
  'app.tournaments.theme': themeSchema,
  'app.tournaments.presentation': presentationSchema,
  'app.tournaments.settings': settingsSchema,
  'app.tournaments.features': featuresSchema,
  'app.tournaments.bot_settings': botSettingsSchema,
  'app.domains.details': jsonObject,
  'app.stages.settings': stageSettingsSchema,
  'app.stages.state': stageStateSchema,
  /** Parsed by src/features/formats (the ranking rules of WP-13a). */
  'app.stages.ranking': jsonObject,
  'app.stages.advancement': advancementSchema,
  'app.groups.settings': groupSettingsSchema,
  'app.team_members.smurf_accounts': smurfAccountsSchema,
  'app.matches.draft_penalties': draftPenaltiesSchema,
  'app.games.picks_bans': picksBansSchema,
  'app.performances.extra': performanceExtraSchema,
  'app.pickem_picks.predictions': pickemPredictionsSchema,
  'app.card_collections.cards': cardsSchema,
  'app.card_collections.deck_slots': deckSlotsSchema,
  'app.card_duels.people': duelPeopleSchema,
  'app.card_duels.game': engineStateSchema,
  'app.card_duels.initial_game': engineStateSchema,
  'app.card_duels.result': duelResultSchema,
  'app.card_duel_views.view': engineStateSchema,
  'app.card_duel_moves.action': engineStateSchema,
  'app.card_reports.client': reportPayloadSchema,
  'app.card_reports.log': reportPayloadSchema,
  'app.card_reports.context': reportPayloadSchema,
  'app.card_reports.duel_snapshot': reportPayloadSchema,
  'app.card_activity.pending_find': pendingFindSchema,
  'bot.workers.details': workerDetailsSchema,
  'bot.lobby_sessions.request': lobbyRequestSchema,
  'bot.lobby_sessions.progress': lobbyProgressSchema,
  'bot.lobby_sessions.error': lobbyErrorSchema,
} as const satisfies Record<string, ZodTypeAny>;

export type JsonColumn = keyof typeof jsonColumnSchemas;

export * from './common';
export * from './tournament';
export * from './formats';
export * from './people';
export * from './results';
export * from './cards';
export * from './bot';
