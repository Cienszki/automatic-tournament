// Content and viewer features: news, rules, prizes, scrim slots, fantasy and pick'em (SCHEMA.md 2.2).

import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, jsonb, primaryKey, smallint, text, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { app, createdAt, oneOf, POSITIONS, tournamentIdColumn, tstz, updatedAt } from './_columns';
import { players, users } from './platform';
import { groups, tournaments } from './tournaments';
import { teams } from './teams';
import type { PickemPredictions } from './json/results';

export const ANNOUNCEMENT_TONES = ['info', 'success', 'warning'] as const;
export const SCRIM_STATUSES = ['active', 'taken', 'cancelled'] as const;

export const announcements = app.table('announcements', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  excerpt: text('excerpt'),
  imageUrl: text('image_url'),
  tone: text('tone', { enum: ANNOUNCEMENT_TONES }).notNull().default('info'),
  isPinned: boolean('is_pinned').notNull().default(false),
  isImportant: boolean('is_important').notNull().default(false),
  published: boolean('published').notNull().default(true),
  authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  /** Only for imported rows whose author has no user. */
  authorName: text('author_name'),
  publishedAt: tstz('published_at').notNull().defaultNow(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  index('announcements_published_idx').on(t.tournamentId, t.published, t.publishedAt.desc()),
  check('announcements_tone_check', oneOf('tone', ANNOUNCEMENT_TONES)),
]).enableRLS();

export const ruleSections = app.table('rule_sections', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  position: smallint('position').notNull(),
  title: text('title').notNull(),
  updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.tournamentId, t.id] })]).enableRLS();

export const ruleParagraphs = app.table('rule_paragraphs', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  sectionId: text('section_id').notNull(),
  parentId: text('parent_id'),
  position: smallint('position').notNull(),
  body: text('body').notNull(),
  commentary: text('commentary'),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'rule_paragraphs_section_fk', columns: [t.tournamentId, t.sectionId], foreignColumns: [ruleSections.tournamentId, ruleSections.id] }).onDelete('cascade'),
  foreignKey({ name: 'rule_paragraphs_parent_fk', columns: [t.tournamentId, t.parentId], foreignColumns: [t.tournamentId, t.id] }).onDelete('cascade'),
  index('rule_paragraphs_section_idx').on(t.tournamentId, t.sectionId, t.position),
]).enableRLS();

export const prizes = app.table('prizes', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  details: text('details'),
  position: smallint('position').notNull(),
  visible: boolean('visible').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.tournamentId, t.id] })]).enableRLS();

export const scrimSlots = app.table('scrim_slots', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  teamId: text('team_id').notNull(),
  groupId: text('group_id'),
  startsAt: tstz('starts_at').notNull(),
  endsAt: tstz('ends_at').notNull(),
  bestOf: smallint('best_of').notNull(),
  contact: text('contact'),
  notes: text('notes'),
  status: text('status', { enum: SCRIM_STATUSES }).notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'scrim_slots_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }).onDelete('cascade'),
  foreignKey({ name: 'scrim_slots_group_fk', columns: [t.tournamentId, t.groupId], foreignColumns: [groups.tournamentId, groups.id] }),
  index('scrim_slots_starts_idx').on(t.tournamentId, t.startsAt),
  check('scrim_slots_status_check', oneOf('status', SCRIM_STATUSES)),
  check('scrim_slots_time_check', sql`"ends_at" >= "starts_at"`),
]).enableRLS();

export const fantasyRounds = app.table('fantasy_rounds', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  name: text('name').notNull(),
  position: smallint('position').notNull(),
  lockAt: tstz('lock_at'),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  uniqueIndex('fantasy_rounds_one_current_unique').on(t.tournamentId).where(sql`"is_current"`),
]).enableRLS();

/** One pick: a user's player for one position in one round. */
export const fantasyLineups = app.table('fantasy_lineups', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  roundId: text('round_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  position: text('position', { enum: POSITIONS }).notNull(),
  steamId64: text('steam_id64').notNull().references(() => players.steamId64),
  teamId: text('team_id'),
  submittedAt: tstz('submitted_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.roundId, t.userId, t.position] }),
  foreignKey({ name: 'fantasy_lineups_round_fk', columns: [t.tournamentId, t.roundId], foreignColumns: [fantasyRounds.tournamentId, fantasyRounds.id] }).onDelete('cascade'),
  foreignKey({ name: 'fantasy_lineups_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }),
  check('fantasy_lineups_position_check', oneOf('position', POSITIONS)),
]).enableRLS();

export const pickemPicks = app.table('pickem_picks', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  predictions: jsonb('predictions').$type<PickemPredictions>().notNull(),
  submittedAt: tstz('submitted_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.tournamentId, t.userId] })]).enableRLS();
