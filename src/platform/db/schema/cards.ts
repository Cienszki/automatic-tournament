// The card game, moved as it is today (SCHEMA.md 2.3, 5; WP-40).

import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, integer, jsonb, primaryKey, smallint, text, date,
} from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { app, createdAt, oneOf, tournamentIdColumn, tstz, updatedAt } from './_columns';
import { users } from './platform';
import { tournaments } from './tournaments';
import type { JsonObject, JsonValue } from './json/common';
import type {
  cardsSchema, deckSlotsSchema, duelPeopleSchema, duelResultSchema, pendingFindSchema,
} from './json/cards';

export const DUEL_KINDS = ['open', 'direct'] as const;
export const DUEL_STATUSES = ['open', 'seated', 'play', 'done', 'cancelled', 'expired'] as const;
export const PACES = ['fast', 'normal', 'calm', 'none'] as const;
export const REWARD_ROUND_STATUSES = ['past', 'ready', 'granted'] as const;
export const GRANT_KINDS = ['round', 'admin'] as const;
export const REPORT_STATUSES = ['new', 'done'] as const;

export const cardCollections = app.table('card_collections', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  packs: smallint('packs').notNull(),
  packsOpened: integer('packs_opened').notNull().default(0),
  cards: jsonb('cards').$type<z.infer<typeof cardsSchema>>().notNull().default([]),
  deckSlots: jsonb('deck_slots').$type<z.infer<typeof deckSlotsSchema>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.userId] }),
  check('card_collections_packs_check', sql`"packs" >= 0`),
]).enableRLS();

export const cardDuels = app.table('card_duels', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  kind: text('kind', { enum: DUEL_KINDS }).notNull(),
  status: text('status', { enum: DUEL_STATUSES }).notNull(),
  pace: text('pace', { enum: PACES }).notNull().default('normal'),
  hostUserId: text('host_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  guestUserId: text('guest_user_id').references(() => users.id, { onDelete: 'set null' }),
  invitedUserId: text('invited_user_id').references(() => users.id, { onDelete: 'set null' }),
  side0UserId: text('side0_user_id').references(() => users.id, { onDelete: 'set null' }),
  side1UserId: text('side1_user_id').references(() => users.id, { onDelete: 'set null' }),
  people: jsonb('people').$type<z.infer<typeof duelPeopleSchema>>().notNull(),
  hostSeenAt: tstz('host_seen_at').notNull(),
  seatUntil: tstz('seat_until'),
  expiresAt: tstz('expires_at').notNull(),
  startedAt: tstz('started_at'),
  game: jsonb('game').$type<JsonObject>(),
  initialGame: jsonb('initial_game').$type<JsonObject>(),
  rated: boolean('rated').notNull().default(false),
  result: jsonb('result').$type<z.infer<typeof duelResultSchema>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  index('card_duels_playing_idx').on(t.tournamentId, t.status, t.updatedAt).where(sql`"status" = 'play'`),
  index('card_duels_host_idx').on(t.hostUserId),
  index('card_duels_invited_idx').on(t.invitedUserId),
  index('card_duels_side0_idx').on(t.side0UserId),
  index('card_duels_side1_idx').on(t.side1UserId),
  index('card_duels_rated_pair_idx').on(t.tournamentId, t.side0UserId, t.side1UserId, t.updatedAt).where(sql`"rated"`),
  check('card_duels_kind_check', oneOf('kind', DUEL_KINDS)),
  check('card_duels_status_check', oneOf('status', DUEL_STATUSES)),
  check('card_duels_pace_check', oneOf('pace', PACES)),
]).enableRLS();

/** What each participant sees. A derived copy kept for the move (SCHEMA.md question 4). */
export const cardDuelViews = app.table('card_duel_views', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  duelId: text('duel_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  view: jsonb('view').$type<JsonObject>().notNull(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.duelId, t.userId] }),
  foreignKey({ name: 'card_duel_views_duel_fk', columns: [t.tournamentId, t.duelId], foreignColumns: [cardDuels.tournamentId, cardDuels.id] }).onDelete('cascade'),
]).enableRLS();

export const cardDuelMoves = app.table('card_duel_moves', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  duelId: text('duel_id').notNull(),
  seq: integer('seq').notNull(),
  at: tstz('at').notNull(),
  side: smallint('side').notNull(),
  action: jsonb('action').$type<JsonObject>().notNull(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.duelId, t.seq] }),
  foreignKey({ name: 'card_duel_moves_duel_fk', columns: [t.tournamentId, t.duelId], foreignColumns: [cardDuels.tournamentId, cardDuels.id] }).onDelete('cascade'),
  check('card_duel_moves_side_check', oneOf('side', [0, 1])),
]).enableRLS();

export const cardRatings = app.table('card_ratings', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: smallint('rating').notNull().default(1000),
  games: smallint('games').notNull().default(0),
  wins: smallint('wins').notNull().default(0),
  losses: smallint('losses').notNull().default(0),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.userId] }),
  index('card_ratings_rating_idx').on(t.tournamentId, t.rating.desc()),
]).enableRLS();

export const cardRewardRounds = app.table('card_reward_rounds', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  roundKey: text('round_key').notNull(),
  status: text('status', { enum: REWARD_ROUND_STATUSES }).notNull(),
  readySince: tstz('ready_since'),
  grantedAt: tstz('granted_at'),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.roundKey] }),
  check('card_reward_rounds_status_check', oneOf('status', REWARD_ROUND_STATUSES)),
]).enableRLS();

export const cardGrants = app.table('card_grants', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  kind: text('kind', { enum: GRANT_KINDS }).notNull(),
  roundKey: text('round_key'),
  label: text('label'),
  packs: smallint('packs').notNull(),
  reason: text('reason'),
  recipientUserIds: text('recipient_user_ids').array().notNull().default(sql`'{}'::text[]`),
  recipientCount: integer('recipient_count').notNull(),
  grantedBy: text('granted_by').references(() => users.id, { onDelete: 'set null' }),
  grantedAt: tstz('granted_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  index('card_grants_granted_idx').on(t.tournamentId, t.grantedAt.desc()),
  check('card_grants_kind_check', oneOf('kind', GRANT_KINDS)),
  check('card_grants_packs_check', sql`"packs" > 0`),
]).enableRLS();

export const cardReports = app.table('card_reports', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  url: text('url'),
  mode: text('mode'),
  duelId: text('duel_id'),
  client: jsonb('client').$type<JsonValue>(),
  log: jsonb('log').$type<JsonValue>(),
  context: jsonb('context').$type<JsonValue>(),
  duelSnapshot: jsonb('duel_snapshot').$type<JsonValue>(),
  status: text('status', { enum: REPORT_STATUSES }).notNull().default('new'),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  index('card_reports_status_idx').on(t.tournamentId, t.status, t.createdAt.desc()),
  check('card_reports_status_check', oneOf('status', REPORT_STATUSES)),
]).enableRLS();

/** Per account, across tournaments (a global table; listed in the schema test). */
export const cardActivity = app.table('card_activity', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  lastBeatAt: tstz('last_beat_at'),
  /** The Warsaw day that `minutes` counts. */
  day: date('day', { mode: 'string' }),
  minutes: smallint('minutes').notNull().default(0),
  finds: tstz('finds').array().notNull().default(sql`'{}'::timestamptz[]`),
  pendingFind: jsonb('pending_find').$type<z.infer<typeof pendingFindSchema>>(),
}).enableRLS();
