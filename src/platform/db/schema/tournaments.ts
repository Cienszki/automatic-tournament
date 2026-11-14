// The tournament, its domains and members, and its format: stages and groups (SCHEMA.md 2.1, 2.2, 3).

import { sql } from 'drizzle-orm';
import {
  bigint, check, foreignKey, index, jsonb, primaryKey, smallint, text, unique, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { app, BEST_OF, createdAt, oneOf, tournamentIdColumn, tstz, updatedAt } from './_columns';
import { users } from './platform';
import { organizations, series } from './organizations';
import type {
  botSettingsSchema, featuresSchema, presentationSchema, settingsSchema, themeSchema,
} from './json/tournament';
import type {
  Advancement, StageSettings, StageState, groupSettingsSchema,
} from './json/formats';
import type { JsonObject } from './json/common';

export const FORMAT_PRESETS = ['league', 'mmr-limited', 'swiss'] as const;
export const TOURNAMENT_STATUSES = ['draft', 'registration', 'active', 'completed', 'archived'] as const;
export const VISIBILITIES = ['active', 'inactive', 'archived'] as const;
export const SERVING = ['mirror', 'live'] as const;
export const DOMAIN_STATUSES = ['pending', 'verified', 'failed'] as const;
export const TOURNAMENT_ROLES = ['admin', 'referee', 'caster'] as const;
export const STAGE_KINDS = ['round_robin', 'swiss', 'bracket'] as const;
export const STAGE_STATUSES = ['planned', 'active', 'complete'] as const;

export const tournaments = app.table('tournaments', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  seriesId: text('series_id').references(() => series.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  description: text('description'),
  /** The wizard preset the tournament was made from. Labels and defaults only; the structure is in `stages`. */
  formatPreset: text('format_preset', { enum: FORMAT_PRESETS }).notNull(),
  status: text('status', { enum: TOURNAMENT_STATUSES }).notNull().default('draft'),
  visibility: text('visibility', { enum: VISIBILITIES }).notNull().default('active'),
  serving: text('serving', { enum: SERVING }).notNull().default('live'),
  locale: text('locale').notNull().default('pl'),
  timeZone: text('time_zone').notNull().default('Europe/Warsaw'),
  leagueId: bigint('league_id', { mode: 'number' }),
  startsAt: tstz('starts_at'),
  endsAt: tstz('ends_at'),
  redirectToTournamentId: text('redirect_to_tournament_id'),
  previewToken: text('preview_token'),
  fantasyPreset: text('fantasy_preset'),
  theme: jsonb('theme').$type<z.infer<typeof themeSchema>>().notNull(),
  presentation: jsonb('presentation').$type<z.infer<typeof presentationSchema>>().notNull(),
  settings: jsonb('settings').$type<z.infer<typeof settingsSchema>>().notNull(),
  features: jsonb('features').$type<z.infer<typeof featuresSchema>>().notNull(),
  botSettings: jsonb('bot_settings').$type<z.infer<typeof botSettingsSchema>>(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('tournaments_slug_unique').on(t.slug),
  uniqueIndex('tournaments_preview_token_unique').on(t.previewToken),
  index('tournaments_organization_idx').on(t.organizationId),
  index('tournaments_status_visibility_idx').on(t.status, t.visibility),
  foreignKey({ name: 'tournaments_redirect_fk', columns: [t.redirectToTournamentId], foreignColumns: [t.id] }).onDelete('set null'),
  check('tournaments_format_preset_check', oneOf('format_preset', FORMAT_PRESETS)),
  check('tournaments_status_check', oneOf('status', TOURNAMENT_STATUSES)),
  check('tournaments_visibility_check', oneOf('visibility', VISIBILITIES)),
  check('tournaments_serving_check', oneOf('serving', SERVING)),
  check('tournaments_slug_check', sql`"slug" ~ '^[a-z0-9][a-z0-9-]{0,62}$'`),
  check('tournaments_no_self_redirect_check', sql`"redirect_to_tournament_id" <> "id"`),
]).enableRLS();

/** A hostname that serves an organization or a tournament (global; listed in the schema test). */
export const domains = app.table('domains', {
  hostname: text('hostname').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  tournamentId: text('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }),
  status: text('status', { enum: DOMAIN_STATUSES }).notNull().default('pending'),
  verifiedAt: tstz('verified_at'),
  details: jsonb('details').$type<JsonObject>().notNull().default({}),
  createdAt: createdAt(),
}, () => [
  check('domains_one_target_check', sql`num_nonnulls("organization_id", "tournament_id") = 1`),
  check('domains_status_check', oneOf('status', DOMAIN_STATUSES)),
  check('domains_hostname_lower_check', sql`"hostname" = lower("hostname")`),
]).enableRLS();

export const tournamentMembers = app.table('tournament_members', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: TOURNAMENT_ROLES }).notNull(),
  addedBy: text('added_by').references(() => users.id, { onDelete: 'set null' }),
  addedAt: tstz('added_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.userId, t.role] }),
  index('tournament_members_user_idx').on(t.userId),
  check('tournament_members_role_check', oneOf('role', TOURNAMENT_ROLES)),
]).enableRLS();

export const stages = app.table('stages', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  position: smallint('position').notNull(),
  kind: text('kind', { enum: STAGE_KINDS }).notNull(),
  name: text('name').notNull(),
  status: text('status', { enum: STAGE_STATUSES }).notNull().default('planned'),
  defaultBestOf: smallint('default_best_of').notNull(),
  settings: jsonb('settings').$type<StageSettings>().notNull(),
  state: jsonb('state').$type<StageState>().notNull().default({ tieDecisions: [] }),
  /** Ranking rules, parsed by src/features/formats. */
  ranking: jsonb('ranking').$type<JsonObject>(),
  advancement: jsonb('advancement').$type<Advancement>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  unique('stages_position_unique').on(t.tournamentId, t.position),
  check('stages_kind_check', oneOf('kind', STAGE_KINDS)),
  check('stages_status_check', oneOf('status', STAGE_STATUSES)),
  check('stages_default_best_of_check', oneOf('default_best_of', BEST_OF)),
  check('stages_position_check', sql`"position" > 0`),
]).enableRLS();

export const groups = app.table('groups', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  stageId: text('stage_id').notNull(),
  name: text('name').notNull(),
  position: smallint('position').notNull(),
  tier: smallint('tier'),
  color: text('color'),
  settings: jsonb('settings').$type<z.infer<typeof groupSettingsSchema>>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'groups_stage_fk', columns: [t.tournamentId, t.stageId], foreignColumns: [stages.tournamentId, stages.id] }).onDelete('cascade'),
  unique('groups_position_unique').on(t.tournamentId, t.stageId, t.position),
]).enableRLS();
