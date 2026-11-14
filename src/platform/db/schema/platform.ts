// Global tables (SCHEMA.md 2.1): people, their links, Steam players, the audit log, jobs, rate
// limits, notifications and platform settings. None of these carries a tournament in its key.

import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, primaryKey, smallint, text, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { app, createdAt, oneOf, steam64Check, tstz, updatedAt } from './_columns';
import type { JsonObject, JsonValue } from './json/common';
import { notifyPrefsSchema, topHeroesSchema } from './json/people';
import type { z } from 'zod';

export const AVATAR_SOURCES = ['google', 'discord', 'steam', 'url'] as const;
export const LINK_PROVIDERS = ['discord', 'steam'] as const;
export const STEAM_LINK_SOURCES = ['discord', 'inhouse', 'steam'] as const;
export const JOB_STATUSES = ['waiting', 'running', 'done', 'failed'] as const;
export const DM_STATUSES = ['sent', 'blocked', 'failed', 'skipped'] as const;

export const users = app.table('users', {
  /** The Firebase user id. */
  id: text('id').primaryKey(),
  email: text('email'),
  displayName: text('display_name'),
  nickname: text('nickname'),
  photoUrl: text('photo_url'),
  avatarSource: text('avatar_source', { enum: AVATAR_SOURCES }),
  avatarUrl: text('avatar_url'),
  streamUrl: text('stream_url'),
  platformRole: text('platform_role', { enum: ['admin'] }),
  canCreateTournaments: boolean('can_create_tournaments').notNull().default(false),
  notifyPrefs: jsonb('notify_prefs').$type<z.infer<typeof notifyPrefsSchema>>().notNull().default({}),
  dmProblem: text('dm_problem'),
  /** Made by the import only because data refers to this id; filled in from the owner's export. */
  isStub: boolean('is_stub').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('users_email_idx').on(sql`lower(${t.email})`),
  check('users_avatar_source_check', oneOf('avatar_source', AVATAR_SOURCES)),
  check('users_platform_role_check', oneOf('platform_role', ['admin'])),
]).enableRLS();

export const userLinks = app.table('user_links', {
  provider: text('provider', { enum: LINK_PROVIDERS }).notNull(),
  /** Discord user id, or Steam64. */
  externalId: text('external_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  source: text('source', { enum: STEAM_LINK_SOURCES }),
  linkedAt: tstz('linked_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.provider, t.externalId] }),
  uniqueIndex('user_links_user_provider_unique').on(t.userId, t.provider),
  check('user_links_provider_check', oneOf('provider', LINK_PROVIDERS)),
  check('user_links_source_check', oneOf('source', STEAM_LINK_SOURCES)),
  check('user_links_steam_id_check', sql`"provider" <> 'steam' or "external_id" ~ '^[0-9]{17}$'`),
]).enableRLS();

export const players = app.table('players', {
  steamId64: text('steam_id64').primaryKey(),
  nickname: text('nickname'),
  personaName: text('persona_name'),
  avatarUrl: text('avatar_url'),
  avatarMediumUrl: text('avatar_medium_url'),
  avatarFullUrl: text('avatar_full_url'),
  topHeroes: jsonb('top_heroes').$type<z.infer<typeof topHeroesSchema>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, () => [check('players_steam_id64_check', steam64Check('steam_id64'))]).enableRLS();

export const auditLog = app.table('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: tstz('at').notNull().defaultNow(),
  actorUserId: text('actor_user_id'),
  /** No foreign key: the log outlives a deleted tournament. */
  tournamentId: text('tournament_id'),
  organizationId: text('organization_id'),
  action: text('action').notNull(),
  targetKind: text('target_kind'),
  targetId: text('target_id'),
  reason: text('reason'),
  data: jsonb('data').$type<JsonObject>().notNull().default({}),
}, (t) => [
  index('audit_log_tournament_at_idx').on(t.tournamentId, t.at.desc()),
  index('audit_log_target_idx').on(t.targetKind, t.targetId),
]).enableRLS();

export const jobs = app.table('jobs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  type: text('type').notNull(),
  /** Null for platform jobs. No foreign key, so the bot's role can insert without reading tournaments. */
  tournamentId: text('tournament_id'),
  payload: jsonb('payload').$type<JsonObject>().notNull().default({}),
  status: text('status', { enum: JOB_STATUSES }).notNull().default('waiting'),
  runAt: tstz('run_at').notNull().defaultNow(),
  attempts: smallint('attempts').notNull().default(0),
  maxAttempts: smallint('max_attempts').notNull().default(5),
  dedupeKey: text('dedupe_key'),
  lockedBy: text('locked_by'),
  lockedAt: tstz('locked_at'),
  lastError: text('last_error'),
  createdAt: createdAt(),
  finishedAt: tstz('finished_at'),
}, (t) => [
  uniqueIndex('jobs_waiting_dedupe_unique').on(t.dedupeKey).where(sql`"status" = 'waiting'`),
  index('jobs_waiting_run_at_idx').on(t.runAt).where(sql`"status" = 'waiting'`),
  index('jobs_tournament_status_idx').on(t.tournamentId, t.status),
  check('jobs_status_check', oneOf('status', JOB_STATUSES)),
]).enableRLS();

export const rateLimits = app.table('rate_limits', {
  bucket: text('bucket').primaryKey(),
  windowStart: tstz('window_start').notNull(),
  count: integer('count').notNull(),
  expiresAt: tstz('expires_at').notNull(),
}, (t) => [index('rate_limits_expires_at_idx').on(t.expiresAt)]).enableRLS();

export const inbox = app.table('inbox', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** sha1 of `key|user`, as today: sending an event twice is a no-op. */
  id: text('id').notNull(),
  type: text('type').notNull(),
  key: text('key').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  href: text('href'),
  tournamentId: text('tournament_id'),
  dmStatus: text('dm_status', { enum: DM_STATUSES }),
  readAt: tstz('read_at'),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  index('inbox_user_created_idx').on(t.userId, t.createdAt.desc()),
  check('inbox_dm_status_check', oneOf('dm_status', DM_STATUSES)),
]).enableRLS();

export const dmLog = app.table('dm_log', {
  discordId: text('discord_id').notNull(),
  key: text('key').notNull(),
  dmStatus: text('dm_status', { enum: DM_STATUSES }),
  at: tstz('at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.discordId, t.key] }),
  check('dm_log_dm_status_check', oneOf('dm_status', DM_STATUSES)),
]).enableRLS();

export const platformSettings = app.table('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<JsonValue>().notNull(),
  updatedAt: updatedAt(),
}).enableRLS();
