// JSON columns of the `bot` schema (SCHEMA.md 4.14, 4.15). These are the shapes of the contract
// between the website and the lobby bot; WP-21 moves them to `contract/`, where both sides import
// them, and this file then re-exports them.

import { z } from 'zod';
import { id, isoTime, jsonObject, seriesFormat, steam32 } from './common';
import {
  chatMessagesSchema, enforcementSchema, lateArrivalSchema, lobbySettingsSchema, readyCheckSchema,
} from './tournament';

const lobbyTeam = z.object({
  teamId: id,
  name: z.string(),
  tag: z.string().optional(),
  players: z.array(z.object({ memberId: id, steamId32: steam32, nickname: z.string() }).strict()),
  coach: z.object({ steamId32: steam32, nickname: z.string() }).strict().optional(),
}).strict();

export const lobbyRequestSchema = z.object({
  version: z.literal(1),
  tournamentName: z.string(),
  lobbyName: z.string(),
  password: z.string(),
  scheduledAt: isoTime,
  seriesFormat,
  totalGames: z.number().int().positive(),
  teams: z.object({ a: lobbyTeam, b: lobbyTeam }).strict(),
  standins: z.array(z.object({
    teamId: id, replacedMemberId: id, steamId32: steam32, nickname: z.string(),
    gameNumbers: z.array(z.number().int().positive()),
  }).strict()),
  casters: z.array(z.object({ steamId32: steam32, name: z.string() }).strict()),
  whitelist: z.array(z.object({ steamId32: steam32, displayName: z.string() }).strict()),
  lobby: lobbySettingsSchema,
  readyCheck: readyCheckSchema,
  chatMessages: chatMessagesSchema,
  enforcement: enforcementSchema,
  lateArrival: lateArrivalSchema,
  timeouts: z.object({
    pending: z.number().int().min(0), assigned: z.number().int().min(0), openWarning: z.number().int().min(0),
    open: z.number().int().min(0), readyCheck: z.number().int().min(0),
  }).strict(),
  draftPenalties: z.array(z.object({
    teamId: id, games: z.array(z.number().int().positive()), level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }).strict()),
  /** Games already settled by the website (a result or a forfeit), by game number: the side that won. */
  gamesDecided: z.record(z.enum(['a', 'b'])),
}).strict();
export type LobbyRequest = z.infer<typeof lobbyRequestSchema>;

const side = z.enum(['radiant', 'dire']);

export const lobbyProgressSchema = z.object({
  sides: z.object({ radiant: z.enum(['a', 'b']) }).strict().optional(),
  readyState: z.object({
    radiantReady: z.boolean(), direReady: z.boolean(), radiantReadyBy: z.string().optional(), direReadyBy: z.string().optional(),
  }).strict().optional(),
  validationErrors: z.array(z.string()).optional(),
  wrongSlotWarnings: z.record(isoTime).optional(),
  readyCooldowns: z.record(isoTime).optional(),
  lastLobbyPlayers: z.array(z.object({
    steamId32: steam32, teamSide: z.enum(['radiant', 'dire', 'spectator', 'unassigned']),
  }).strict()).optional(),
  lateVote: z.object({
    kind: z.enum(['game1', 'series']), lateSide: side, openedAt: isoTime, closesAt: isoTime,
    votes: z.record(z.enum(['forfeit', 'wait'])),
  }).strict().optional(),
  lateWaitUntil: isoTime.optional(),
  completedGames: z.array(z.object({
    number: z.number().int().positive(), dotaMatchId: z.number().int().positive(), winner: side,
  }).strict()).optional(),
  forfeitedGames: z.array(z.object({
    number: z.number().int().positive(), forfeitedSide: side, winnerSide: side,
  }).strict()).optional(),
  lobbySeriesType: z.number().int().optional(),
  lobbyRadiantWins: z.number().int().optional(),
  lobbyDireWins: z.number().int().optional(),
  times: z.object({
    lobbyCreatedAt: isoTime.optional(), readyCheckStartedAt: isoTime.optional(), startGameSentAt: isoTime.optional(),
    gameStartedAt: isoTime.optional(), gameEndedAt: isoTime.optional(), syncTriggeredAt: isoTime.optional(),
    timeoutWarningSentAt: isoTime.optional(),
  }).strict().optional(),
}).strict();
export type LobbyProgress = z.infer<typeof lobbyProgressSchema>;

export const lobbyErrorSchema = z.object({ message: z.string(), code: z.string().optional(), at: isoTime }).strict();

export const workerDetailsSchema = jsonObject;
