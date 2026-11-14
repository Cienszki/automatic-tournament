// Schema `bot`: the only tables the bot's role may use (with an insert into `app.jobs`). No foreign
// key points into `app`, so the website's schema can change without the bot (ADR-10, SCHEMA.md 2.4).

import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, smallint, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { bot, bytea, createdAt, oneOf, steam64Check, tstz, updatedAt } from './_columns';
import type { JsonObject } from './json/common';
import type { LobbyProgress, LobbyRequest, lobbyErrorSchema } from './json/bot';
import type { z } from 'zod';

export const ACCOUNT_STATUSES = ['idle', 'assigned', 'connecting', 'in_lobby', 'in_game', 'error', 'offline'] as const;
export const SESSION_STATES = [
  'pending', 'claimed', 'lobby_creating', 'lobby_open', 'ready_check', 'requirements_met', 'coin_toss',
  'in_game', 'post_game', 'between_games', 'completed', 'cancelled', 'error',
] as const;
export const TERMINAL_SESSION_STATES = ['completed', 'cancelled', 'error'] as const;

export const workers = bot.table('workers', {
  id: text('id').primaryKey(),
  host: text('host'),
  version: text('version').notNull(),
  startedAt: tstz('started_at').notNull().defaultNow(),
  heartbeatAt: tstz('heartbeat_at').notNull().defaultNow(),
  capacity: smallint('capacity').notNull(),
  activeSessions: smallint('active_sessions').notNull().default(0),
  details: jsonb('details').$type<JsonObject>().notNull().default({}),
}, (t) => [index('workers_heartbeat_idx').on(t.heartbeatAt)]).enableRLS();

export const lobbySessions = bot.table('lobby_sessions', {
  id: text('id').primaryKey(),
  // Written by the website: the request.
  tournamentId: text('tournament_id').notNull(),
  matchId: text('match_id').notNull(),
  revision: integer('revision').notNull().default(1),
  request: jsonb('request').$type<LobbyRequest>().notNull(),
  createLobbyAt: tstz('create_lobby_at').notNull(),
  cancelledAt: tstz('cancelled_at'),
  // Written by the bot: the state.
  state: text('state', { enum: SESSION_STATES }).notNull().default('pending'),
  workerId: text('worker_id').references(() => workers.id, { onDelete: 'set null' }),
  accountId: text('account_id'),
  claimedAt: tstz('claimed_at'),
  currentGameNumber: smallint('current_game_number').notNull().default(1),
  dotaLobbyId: text('dota_lobby_id'),
  progress: jsonb('progress').$type<LobbyProgress>().notNull().default({}),
  error: jsonb('error').$type<z.infer<typeof lobbyErrorSchema>>(),
  completedAt: tstz('completed_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('lobby_sessions_live_match_unique').on(t.tournamentId, t.matchId)
    .where(sql`"state" not in ('completed', 'cancelled', 'error')`),
  index('lobby_sessions_due_idx').on(t.createLobbyAt).where(sql`"state" = 'pending' and "cancelled_at" is null`),
  check('lobby_sessions_state_check', oneOf('state', SESSION_STATES)),
]).enableRLS();

export const accounts = bot.table('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  /** AES-GCM with a key held in the worker's environment (WP-22). Never readable. */
  passwordEncrypted: bytea('password_encrypted').notNull(),
  guardSecretEncrypted: bytea('guard_secret_encrypted'),
  steamId64: text('steam_id64').notNull(),
  displayName: text('display_name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  status: text('status', { enum: ACCOUNT_STATUSES }).notNull().default('idle'),
  leasedSessionId: text('leased_session_id'),
  leasedByWorker: text('leased_by_worker'),
  leaseHeartbeatAt: tstz('lease_heartbeat_at'),
  cooldownUntil: tstz('cooldown_until'),
  lastError: text('last_error'),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('accounts_username_unique').on(t.username),
  index('accounts_enabled_status_idx').on(t.enabled, t.status),
  foreignKey({ name: 'accounts_session_fk', columns: [t.leasedSessionId], foreignColumns: [lobbySessions.id] }).onDelete('set null'),
  foreignKey({ name: 'accounts_worker_fk', columns: [t.leasedByWorker], foreignColumns: [workers.id] }).onDelete('set null'),
  check('accounts_status_check', oneOf('status', ACCOUNT_STATUSES)),
  check('accounts_steam_id64_check', steam64Check('steam_id64')),
]).enableRLS();
