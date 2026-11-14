// Teams, rosters, group membership, stand-in registrations and captain-change codes (SCHEMA.md 2.2).

import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, primaryKey, smallint, text, uniqueIndex } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { app, createdAt, oneOf, POSITIONS, tournamentIdColumn, tstz, updatedAt } from './_columns';
import { players, users } from './platform';
import { groups, tournaments } from './tournaments';
import type { smurfAccountsSchema } from './json/people';

export const TEAM_STATUSES = ['pending', 'verified', 'rejected', 'warning', 'banned', 'eliminated'] as const;
export const MEMBER_KINDS = ['player', 'substitute', 'coach'] as const;
export const LEFT_REASONS = ['transfer', 'removed', 'captain_change'] as const;
export const STANDIN_REGISTRATION_STATUSES = ['pending', 'verified'] as const;

export const teams = app.table('teams', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  name: text('name').notNull(),
  tag: text('tag'),
  logoUrl: text('logo_url'),
  motto: text('motto'),
  status: text('status', { enum: TEAM_STATUSES }).notNull().default('pending'),
  captainUserId: text('captain_user_id').references(() => users.id, { onDelete: 'set null' }),
  /** The Discord name the captain gave at registration (private, for admins). */
  captainDiscord: text('captain_discord'),
  /** Swiss: self-reported average MMR. Never shown publicly. */
  seedMmr: integer('seed_mmr'),
  mmrCapAtRegistration: integer('mmr_cap_at_registration'),
  bannedAt: tstz('banned_at'),
  bannedBy: text('banned_by').references(() => users.id, { onDelete: 'set null' }),
  banReason: text('ban_reason'),
  registeredAt: tstz('registered_at').notNull().defaultNow(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  uniqueIndex('teams_name_unique').on(t.tournamentId, sql`lower(${t.name})`),
  index('teams_captain_idx').on(t.tournamentId, t.captainUserId),
  check('teams_status_check', oneOf('status', TEAM_STATUSES)),
]).enableRLS();

/** Which teams play in a group. */
export const groupTeams = app.table('group_teams', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull(),
  teamId: text('team_id').notNull(),
  seed: smallint('seed'),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.groupId, t.teamId] }),
  foreignKey({ name: 'group_teams_group_fk', columns: [t.tournamentId, t.groupId], foreignColumns: [groups.tournamentId, groups.id] }).onDelete('cascade'),
  foreignKey({ name: 'group_teams_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }).onDelete('cascade'),
  index('group_teams_team_idx').on(t.tournamentId, t.teamId),
]).enableRLS();

/** A roster entry. A player who left keeps the row with `left_at` set: that is the transfer history. */
export const teamMembers = app.table('team_members', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  /** The Firestore player document id (Letnia and older PDL performances refer to it). */
  id: text('id').notNull(),
  teamId: text('team_id').notNull(),
  steamId64: text('steam_id64').references(() => players.steamId64),
  kind: text('kind', { enum: MEMBER_KINDS }).notNull().default('player'),
  position: text('position', { enum: POSITIONS }),
  nickname: text('nickname').notNull(),
  mmr: integer('mmr'),
  mmrProofUrl: text('mmr_proof_url'),
  /** Only when a Steam profile link could not be turned into a Steam64. */
  profileUrl: text('profile_url'),
  smurfAccounts: jsonb('smurf_accounts').$type<z.infer<typeof smurfAccountsSchema>>().notNull().default([]),
  joinedAt: tstz('joined_at').notNull().defaultNow(),
  leftAt: tstz('left_at'),
  leftReason: text('left_reason', { enum: LEFT_REASONS }),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'team_members_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }).onDelete('cascade'),
  uniqueIndex('team_members_one_roster_unique').on(t.tournamentId, t.steamId64)
    .where(sql`"left_at" is null and "kind" <> 'coach'`),
  index('team_members_team_idx').on(t.tournamentId, t.teamId),
  index('team_members_steam_idx').on(t.steamId64),
  check('team_members_kind_check', oneOf('kind', MEMBER_KINDS)),
  check('team_members_position_check', oneOf('position', POSITIONS)),
  check('team_members_left_reason_check', oneOf('left_reason', LEFT_REASONS)),
  check('team_members_steam_check', sql`"steam_id64" is not null or "kind" = 'coach'`),
]).enableRLS();

export const standinRegistrations = app.table('standin_registrations', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  steamId64: text('steam_id64').notNull().references(() => players.steamId64),
  nickname: text('nickname').notNull(),
  discordUsername: text('discord_username'),
  mmr: integer('mmr'),
  mmrProofUrl: text('mmr_proof_url'),
  positions: text('positions').array().notNull().default(sql`'{}'::text[]`),
  description: text('description'),
  status: text('status', { enum: STANDIN_REGISTRATION_STATUSES }).notNull().default('pending'),
  verifiedAt: tstz('verified_at'),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.userId] }),
  index('standin_registrations_status_mmr_idx').on(t.tournamentId, t.status, t.mmr.desc()),
  check('standin_registrations_status_check', oneOf('status', STANDIN_REGISTRATION_STATUSES)),
  check('standin_registrations_description_check', sql`char_length("description") <= 300`),
]).enableRLS();

export const captainChangeCodes = app.table('captain_change_codes', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  teamId: text('team_id').notNull(),
  previousCaptainUserId: text('previous_captain_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  redeemedBy: text('redeemed_by').references(() => users.id, { onDelete: 'set null' }),
  redeemedAt: tstz('redeemed_at'),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.code] }),
  foreignKey({ name: 'captain_change_codes_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }).onDelete('cascade'),
  uniqueIndex('captain_change_codes_code_unique').on(t.code),
  uniqueIndex('captain_change_codes_live_unique').on(t.tournamentId, t.teamId).where(sql`"redeemed_at" is null`),
]).enableRLS();
