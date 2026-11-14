// Matches, games, performances, and what hangs on a match: casters, coaches, stand-ins and
// reschedule requests (SCHEMA.md 2.2 and 3).

import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, foreignKey, index, integer, jsonb, primaryKey, smallint, text, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { app, BEST_OF, createdAt, oneOf, tournamentIdColumn, tstz, updatedAt } from './_columns';
import { players, users } from './platform';
import { groups, stages, tournaments } from './tournaments';
import { standinRegistrations, teamMembers, teams } from './teams';
import type { draftPenaltiesSchema, PerformanceExtra, picksBansSchema } from './json/results';

export const MATCH_KINDS = ['regular', 'tiebreak', 'rematch', 'showmatch', 'other'] as const;
export const MATCH_STATUSES = ['scheduled', 'live', 'completed', 'bye', 'void'] as const;
export const SCHEDULE_STATES = ['unscheduled', 'proposed', 'confirmed'] as const;
export const SCHEDULING_METHODS = ['captain', 'admin', 'fixed'] as const;
export const FORFEIT_SCOPES = ['series', 'games'] as const;
export const BRACKET_SIDES = ['upper', 'lower', 'final', 'wildcard', 'third_place'] as const;
export const SLOTS = ['a', 'b'] as const;
export const GAME_SOURCES = ['league-sync', 'bot', 'manual', 'opendota-id'] as const;
export const STANDIN_STATUSES = ['pending', 'approved', 'rejected', 'appeal_pending', 'appeal_approved', 'appeal_rejected'] as const;
export const RESCHEDULE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export const matches = app.table('matches', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  stageId: text('stage_id').notNull(),
  groupId: text('group_id'),
  round: smallint('round').notNull(),
  matchday: smallint('matchday'),
  kind: text('kind', { enum: MATCH_KINDS }).notNull().default('regular'),
  kindNote: text('kind_note'),
  replacesMatchId: text('replaces_match_id'),
  /** The tie a tiebreak match settles; the same value as `tieDecisions[].tieRef` in `stages.state`. */
  tieRef: text('tie_ref'),
  teamAId: text('team_a_id'),
  teamBId: text('team_b_id'),
  bestOf: smallint('best_of').notNull(),
  status: text('status', { enum: MATCH_STATUSES }).notNull().default('scheduled'),
  scheduleState: text('schedule_state', { enum: SCHEDULE_STATES }).notNull().default('unscheduled'),
  schedulingMethod: text('scheduling_method', { enum: SCHEDULING_METHODS }),
  scheduledAt: tstz('scheduled_at'),
  deadlineAt: tstz('deadline_at'),
  rescheduleLatestAt: tstz('reschedule_latest_at'),
  rescheduleMaxHoursLater: smallint('reschedule_max_hours_later'),
  scoreA: smallint('score_a'),
  scoreB: smallint('score_b'),
  winnerTeamId: text('winner_team_id'),
  completedAt: tstz('completed_at'),
  forfeitTeamId: text('forfeit_team_id'),
  forfeitScope: text('forfeit_scope', { enum: FORFEIT_SCOPES }),
  forfeitReason: text('forfeit_reason'),
  bracketSide: text('bracket_side', { enum: BRACKET_SIDES }),
  bracketPosition: smallint('bracket_position'),
  /** Bracket code (`U1A`, `GF`, `lb-r1-m3`) or LAN qualifier slot (`o1`, `w`, `d`). */
  code: text('code'),
  nextWinnerMatchId: text('next_winner_match_id'),
  nextWinnerSlot: text('next_winner_slot', { enum: SLOTS }),
  nextLoserMatchId: text('next_loser_match_id'),
  nextLoserSlot: text('next_loser_slot', { enum: SLOTS }),
  draftPenalties: jsonb('draft_penalties').$type<z.infer<typeof draftPenaltiesSchema>>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'matches_stage_fk', columns: [t.tournamentId, t.stageId], foreignColumns: [stages.tournamentId, stages.id] }),
  foreignKey({ name: 'matches_group_fk', columns: [t.tournamentId, t.groupId], foreignColumns: [groups.tournamentId, groups.id] }),
  foreignKey({ name: 'matches_team_a_fk', columns: [t.tournamentId, t.teamAId], foreignColumns: [teams.tournamentId, teams.id] }),
  foreignKey({ name: 'matches_team_b_fk', columns: [t.tournamentId, t.teamBId], foreignColumns: [teams.tournamentId, teams.id] }),
  foreignKey({ name: 'matches_winner_fk', columns: [t.tournamentId, t.winnerTeamId], foreignColumns: [teams.tournamentId, teams.id] }),
  foreignKey({ name: 'matches_forfeit_team_fk', columns: [t.tournamentId, t.forfeitTeamId], foreignColumns: [teams.tournamentId, teams.id] }),
  foreignKey({ name: 'matches_replaces_fk', columns: [t.tournamentId, t.replacesMatchId], foreignColumns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'matches_next_winner_fk', columns: [t.tournamentId, t.nextWinnerMatchId], foreignColumns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'matches_next_loser_fk', columns: [t.tournamentId, t.nextLoserMatchId], foreignColumns: [t.tournamentId, t.id] }),
  uniqueIndex('matches_replaces_unique').on(t.tournamentId, t.replacesMatchId),
  index('matches_stage_group_round_idx').on(t.tournamentId, t.stageId, t.groupId, t.round),
  index('matches_scheduled_idx').on(t.tournamentId, t.scheduledAt),
  index('matches_team_a_idx').on(t.tournamentId, t.teamAId),
  index('matches_team_b_idx').on(t.tournamentId, t.teamBId),
  check('matches_kind_check', oneOf('kind', MATCH_KINDS)),
  check('matches_status_check', oneOf('status', MATCH_STATUSES)),
  check('matches_schedule_state_check', oneOf('schedule_state', SCHEDULE_STATES)),
  check('matches_scheduling_method_check', oneOf('scheduling_method', SCHEDULING_METHODS)),
  check('matches_forfeit_scope_check', oneOf('forfeit_scope', FORFEIT_SCOPES)),
  check('matches_bracket_side_check', oneOf('bracket_side', BRACKET_SIDES)),
  check('matches_next_winner_slot_check', oneOf('next_winner_slot', SLOTS)),
  check('matches_next_loser_slot_check', oneOf('next_loser_slot', SLOTS)),
  check('matches_best_of_check', oneOf('best_of', BEST_OF)),
  check('matches_two_teams_check', sql`"team_a_id" is null or "team_b_id" is null or "team_a_id" <> "team_b_id"`),
  check('matches_next_winner_pair_check', sql`("next_winner_match_id" is null) = ("next_winner_slot" is null)`),
  check('matches_next_loser_pair_check', sql`("next_loser_match_id" is null) = ("next_loser_slot" is null)`),
  check('matches_rematch_check', sql`"replaces_match_id" is null or "kind" = 'rematch'`),
]).enableRLS();

export const games = app.table('games', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  /** The Dota match id as text; `<matchId>-forfeit-<n>` for a forfeited game. */
  id: text('id').notNull(),
  matchId: text('match_id').notNull(),
  number: smallint('number').notNull(),
  dotaMatchId: bigint('dota_match_id', { mode: 'number' }),
  radiantTeamId: text('radiant_team_id'),
  direTeamId: text('dire_team_id'),
  radiantWin: boolean('radiant_win'),
  isForfeit: boolean('is_forfeit').notNull().default(false),
  forfeitTeamId: text('forfeit_team_id'),
  startedAt: tstz('started_at'),
  durationSeconds: integer('duration_seconds'),
  firstBloodSeconds: integer('first_blood_seconds'),
  picksBans: jsonb('picks_bans').$type<z.infer<typeof picksBansSchema>>().notNull().default([]),
  parsed: boolean('parsed').notNull().default(false),
  source: text('source', { enum: GAME_SOURCES }).notNull(),
  importedBy: text('imported_by').references(() => users.id, { onDelete: 'set null' }),
  importedAt: tstz('imported_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'games_match_fk', columns: [t.tournamentId, t.matchId], foreignColumns: [matches.tournamentId, matches.id] }).onDelete('cascade'),
  foreignKey({ name: 'games_radiant_team_fk', columns: [t.tournamentId, t.radiantTeamId], foreignColumns: [teams.tournamentId, teams.id] }),
  foreignKey({ name: 'games_dire_team_fk', columns: [t.tournamentId, t.direTeamId], foreignColumns: [teams.tournamentId, teams.id] }),
  foreignKey({ name: 'games_forfeit_team_fk', columns: [t.tournamentId, t.forfeitTeamId], foreignColumns: [teams.tournamentId, teams.id] }),
  uniqueIndex('games_match_number_unique').on(t.tournamentId, t.matchId, t.number),
  uniqueIndex('games_dota_match_unique').on(t.tournamentId, t.dotaMatchId),
  check('games_source_check', oneOf('source', GAME_SOURCES)),
  check('games_number_check', sql`"number" > 0`),
  check('games_forfeit_check', sql`"is_forfeit" = ("dota_match_id" is null)`),
]).enableRLS();

export const performances = app.table('performances', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  gameId: text('game_id').notNull(),
  steamId64: text('steam_id64').notNull().references(() => players.steamId64),
  /** OpenDota's player slot (0-4 Radiant, 128-132 Dire). None of the captured games has it; new imports set it. */
  playerSlot: smallint('player_slot'),
  teamId: text('team_id'),
  heroId: smallint('hero_id'),
  kills: smallint('kills').notNull().default(0),
  deaths: smallint('deaths').notNull().default(0),
  assists: smallint('assists').notNull().default(0),
  lastHits: smallint('last_hits').notNull().default(0),
  denies: smallint('denies').notNull().default(0),
  gpm: smallint('gpm').notNull().default(0),
  xpm: smallint('xpm').notNull().default(0),
  netWorth: integer('net_worth').notNull().default(0),
  totalGold: integer('total_gold').notNull().default(0),
  goldSpent: integer('gold_spent').notNull().default(0),
  heroDamage: integer('hero_damage').notNull().default(0),
  towerDamage: integer('tower_damage').notNull().default(0),
  heroHealing: integer('hero_healing').notNull().default(0),
  obsPlaced: smallint('obs_placed').notNull().default(0),
  senPlaced: smallint('sen_placed').notNull().default(0),
  observerKills: smallint('observer_kills').notNull().default(0),
  sentryKills: smallint('sentry_kills').notNull().default(0),
  courierKills: smallint('courier_kills').notNull().default(0),
  roshanKills: smallint('roshan_kills').notNull().default(0),
  towerKills: smallint('tower_kills').notNull().default(0),
  neutralKills: smallint('neutral_kills').notNull().default(0),
  laneKills: smallint('lane_kills').notNull().default(0),
  heroKills: smallint('hero_kills').notNull().default(0),
  campsStacked: smallint('camps_stacked').notNull().default(0),
  runesPickedUp: smallint('runes_picked_up').notNull().default(0),
  buybacks: smallint('buybacks').notNull().default(0),
  firstBlood: boolean('first_blood').notNull().default(false),
  highestKillStreak: smallint('highest_kill_streak').notNull().default(0),
  doubleKills: smallint('double_kills').notNull().default(0),
  tripleKills: smallint('triple_kills').notNull().default(0),
  ultraKills: smallint('ultra_kills').notNull().default(0),
  rampages: smallint('rampages').notNull().default(0),
  extra: jsonb('extra').$type<PerformanceExtra>().notNull().default({}),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.gameId, t.steamId64] }),
  foreignKey({ name: 'performances_game_fk', columns: [t.tournamentId, t.gameId], foreignColumns: [games.tournamentId, games.id] }).onDelete('cascade'),
  foreignKey({ name: 'performances_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }),
  uniqueIndex('performances_slot_unique').on(t.tournamentId, t.gameId, t.playerSlot).where(sql`"player_slot" is not null`),
  index('performances_player_idx').on(t.tournamentId, t.steamId64),
  check('performances_player_slot_check', sql`"player_slot" between 0 and 4 or "player_slot" between 128 and 132`),
]).enableRLS();

export const matchCasters = app.table('match_casters', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  matchId: text('match_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isMain: boolean('is_main').notNull().default(false),
  addedAt: tstz('added_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.matchId, t.userId] }),
  foreignKey({ name: 'match_casters_match_fk', columns: [t.tournamentId, t.matchId], foreignColumns: [matches.tournamentId, matches.id] }).onDelete('cascade'),
  uniqueIndex('match_casters_one_main_unique').on(t.tournamentId, t.matchId).where(sql`"is_main"`),
  index('match_casters_user_idx').on(t.tournamentId, t.userId),
]).enableRLS();

export const matchCoaches = app.table('match_coaches', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  matchId: text('match_id').notNull(),
  teamId: text('team_id').notNull(),
  steamId64: text('steam_id64').references(() => players.steamId64),
  profileUrl: text('profile_url'),
  nickname: text('nickname').notNull(),
  assignedBy: text('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: tstz('assigned_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.matchId, t.teamId] }),
  foreignKey({ name: 'match_coaches_match_fk', columns: [t.tournamentId, t.matchId], foreignColumns: [matches.tournamentId, matches.id] }).onDelete('cascade'),
  foreignKey({ name: 'match_coaches_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }).onDelete('cascade'),
]).enableRLS();

export const standinRequests = app.table('standin_requests', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  matchId: text('match_id').notNull(),
  teamId: text('team_id').notNull(),
  requestedBy: text('requested_by').references(() => users.id, { onDelete: 'set null' }),
  replacedMemberId: text('replaced_member_id'),
  replacedMmr: integer('replaced_mmr'),
  standinSteamId64: text('standin_steam_id64').references(() => players.steamId64),
  standinProfileUrl: text('standin_profile_url'),
  standinNickname: text('standin_nickname').notNull(),
  standinMmr: integer('standin_mmr'),
  standinRegistrationUserId: text('standin_registration_user_id'),
  /** Empty = the whole series. */
  gameNumbers: smallint('game_numbers').array().notNull().default(sql`'{}'::smallint[]`),
  status: text('status', { enum: STANDIN_STATUSES }).notNull().default('pending'),
  respondedBy: text('responded_by').references(() => users.id, { onDelete: 'set null' }),
  respondedAt: tstz('responded_at'),
  rejectionReason: text('rejection_reason'),
  appealedAt: tstz('appealed_at'),
  appealResolvedBy: text('appeal_resolved_by').references(() => users.id, { onDelete: 'set null' }),
  appealResolvedAt: tstz('appeal_resolved_at'),
  appealNote: text('appeal_note'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'standin_requests_match_fk', columns: [t.tournamentId, t.matchId], foreignColumns: [matches.tournamentId, matches.id] }).onDelete('cascade'),
  foreignKey({ name: 'standin_requests_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }),
  foreignKey({ name: 'standin_requests_member_fk', columns: [t.tournamentId, t.replacedMemberId], foreignColumns: [teamMembers.tournamentId, teamMembers.id] }),
  foreignKey({
    name: 'standin_requests_registration_fk',
    columns: [t.tournamentId, t.standinRegistrationUserId],
    foreignColumns: [standinRegistrations.tournamentId, standinRegistrations.userId],
  }),
  index('standin_requests_match_idx').on(t.tournamentId, t.matchId),
  index('standin_requests_standin_idx').on(t.tournamentId, t.standinSteamId64),
  check('standin_requests_status_check', oneOf('status', STANDIN_STATUSES)),
]).enableRLS();

export const rescheduleRequests = app.table('reschedule_requests', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  matchId: text('match_id').notNull(),
  teamId: text('team_id').notNull(),
  requestedBy: text('requested_by').references(() => users.id, { onDelete: 'set null' }),
  originalAt: tstz('original_at'),
  proposedAt: tstz('proposed_at').notNull(),
  status: text('status', { enum: RESCHEDULE_STATUSES }).notNull().default('pending'),
  respondedBy: text('responded_by').references(() => users.id, { onDelete: 'set null' }),
  respondedAt: tstz('responded_at'),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'reschedule_requests_match_fk', columns: [t.tournamentId, t.matchId], foreignColumns: [matches.tournamentId, matches.id] }).onDelete('cascade'),
  foreignKey({ name: 'reschedule_requests_team_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [teams.tournamentId, teams.id] }),
  uniqueIndex('reschedule_requests_one_pending_unique').on(t.tournamentId, t.matchId).where(sql`"status" = 'pending'`),
  check('reschedule_requests_status_check', oneOf('status', RESCHEDULE_STATUSES)),
]).enableRLS();

/** Dota matches the sync must not import into this tournament. */
export const ignoredDotaMatches = app.table('ignored_dota_matches', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  dotaMatchId: bigint('dota_match_id', { mode: 'number' }).notNull(),
  reason: text('reason').notNull(),
  ignoredBy: text('ignored_by').references(() => users.id, { onDelete: 'set null' }),
  ignoredAt: tstz('ignored_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.tournamentId, t.dotaMatchId] })]).enableRLS();
