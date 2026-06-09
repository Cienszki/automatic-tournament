// src/lib/bot/bot-agent.ts
// Dota 2 Bot Agent — interfaces and control layer for the Dota 2 game client
//
// ARCHITECTURE NOTE:
// The actual Dota 2 connection runs in a SEPARATE Node.js process (the "bot-worker")
// because node-dota2 + node-steam requires a persistent connection that can't live
// inside a Next.js serverless function. The bot-worker process is orchestrated by
// the bot-runner service (see /bot-worker/ directory).
//
// This file defines:
// 1. The command interface between the Next.js app and the bot-worker process
// 2. Lobby control abstractions
// 3. The message protocol for communication

import type {
  LobbySettings,
  LobbySession,
  TournamentBotConfig,
  LateArrivalPolicyConfig,
} from '@/types/lobby-bot';
import { DOTA_GAME_MODE_IDS, DOTA_SERVER_REGION_IDS } from '@/types/lobby-bot';

// ─── Bot Worker Commands ────────────────────────────────────────────────────
// Commands sent from the orchestrator (Next.js API) to the bot-worker process

export type BotCommand =
  | CreateLobbyCommand
  | InvitePlayersCommand
  | SendChatMessageCommand
  | KickPlayerCommand
  | StartGameCommand
  | LeaveLobbyCommand
  | SetTeamsCommand
  | ShutdownCommand;

/**
 * Numeric Dota 2 GC lobby settings as sent to the bot-worker's createLobby().
 * Distinct from LobbySettings (admin-facing string enums) — the worker speaks raw
 * GC enum numbers, so the orchestrator maps strings → numbers before dispatching.
 */
export interface LobbyCreateSettings {
  gameMode: number;
  serverRegion: number;
  visibility: number;
  dotaTvDelay: number;
  seriesType: number;
  leagueId?: number;
  cheatsEnabled: boolean;
  fillWithBots: boolean;
  allowSpectators: boolean;
  pauseSetting: number;
  /** DOTASelectionPriorityRules: 0=Manual (no coin toss), 1=Automatic (coin toss) */
  selectionPriorityRules?: number;
}

export interface CreateLobbyCommand {
  type: 'create_lobby';
  sessionId: string;
  lobbyName: string;
  lobbyPassword: string;
  settings: LobbyCreateSettings;
}

export interface InvitePlayersCommand {
  type: 'invite_players';
  sessionId: string;
  /** Steam32 account IDs to invite */
  steamIds: string[];
}

export interface SendChatMessageCommand {
  type: 'send_chat';
  sessionId: string;
  message: string;
}

export interface KickPlayerCommand {
  type: 'kick_player';
  sessionId: string;
  steamId32: string;
}

export interface StartGameCommand {
  type: 'start_game';
  sessionId: string;
}

export interface LeaveLobbyCommand {
  type: 'leave_lobby';
  sessionId: string;
}

export interface SetTeamsCommand {
  type: 'set_teams';
  sessionId: string;
  /** Radiant team Steam32 IDs */
  teamA: string[];
  /** Dire team Steam32 IDs */
  teamB: string[];
  /** Additional Steam32 IDs allowed in lobby (commentators, observers) */
  whitelist?: string[];
}

export interface ShutdownCommand {
  type: 'shutdown';
}

// ─── Bot Worker Events ──────────────────────────────────────────────────────
// Events sent from the bot-worker back to the orchestrator

export type BotEvent =
  | LobbyCreatedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerSlotChangedEvent
  | ChatMessageEvent
  | LobbyStateUpdateEvent
  | GameStartedEvent
  | GameEndedEvent
  | ForfeitDeclaredEvent
  | WaitVotePassedEvent
  | BotErrorEvent
  | BotHeartbeatEvent;

export interface ForfeitDeclaredEvent {
  type: 'forfeit_declared';
  sessionId: string;
  forfeitType: 'game1' | 'series';
  forfeitedTeam: 'radiant' | 'dire';
  forfeitedTeamName: string;
  winnerTeamName: string;
  timestamp: string;
}

export interface WaitVotePassedEvent {
  type: 'wait_vote_passed';
  sessionId: string;
  /** ISO timestamp until which the orchestrator should not time out the session */
  waitUntil: string;
  timestamp: string;
}

export interface LobbyCreatedEvent {
  type: 'lobby_created';
  sessionId: string;
  dotaLobbyId: string;
  timestamp: string;
}

export interface PlayerJoinedEvent {
  type: 'player_joined';
  sessionId: string;
  steamId32: string;
  slotIndex: number;
  teamSide: 'radiant' | 'dire' | 'spectator' | 'unassigned';
  timestamp: string;
}

export interface PlayerLeftEvent {
  type: 'player_left';
  sessionId: string;
  steamId32: string;
  timestamp: string;
}

export interface PlayerSlotChangedEvent {
  type: 'player_slot_changed';
  sessionId: string;
  steamId32: string;
  oldSlot: number;
  newSlot: number;
  teamSide: 'radiant' | 'dire' | 'spectator' | 'unassigned';
  timestamp: string;
}

export interface ChatMessageEvent {
  type: 'chat_message';
  sessionId: string;
  steamId32: string;
  playerName: string;
  message: string;
  /** Current lobby player state at the moment the message was sent (from bot-worker's live snapshot) */
  currentPlayers?: Array<{
    steamId32: string;
    teamSide: 'radiant' | 'dire' | 'spectator' | 'unassigned';
  }>;
  timestamp: string;
}

export interface LobbyStateUpdateEvent {
  type: 'lobby_state_update';
  sessionId: string;
  players: Array<{
    steamId32: string;
    slotIndex: number;
    teamSide: 'radiant' | 'dire' | 'spectator' | 'unassigned';
  }>;
  radiantTeamName: string;
  direTeamName: string;
  timestamp: string;
}

export interface GameStartedEvent {
  type: 'game_started';
  sessionId: string;
  dotaMatchId: number;
  timestamp: string;
}

export interface GameEndedEvent {
  type: 'game_ended';
  sessionId: string;
  dotaMatchId: number;
  radiantWin: boolean;
  duration: number;
  timestamp: string;
}

export interface BotErrorEvent {
  type: 'bot_error';
  sessionId: string;
  message: string;
  code?: string;
  timestamp: string;
}

export interface BotHeartbeatEvent {
  type: 'heartbeat';
  botAccountId: string;
  status: string;
  currentSessionId?: string;
  timestamp: string;
}

// ─── Communication Channel ──────────────────────────────────────────────────
// The orchestrator and bot-worker communicate via Firestore documents
// acting as a simple message queue. This avoids the need for WebSocket
// infrastructure and works with serverless deployments.

/**
 * Command document stored in Firestore at:
 * /botCommands/{botAccountId}/queue/{commandId}
 */
export interface BotCommandDocument {
  id: string;
  botAccountId: string;
  command: BotCommand;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Event document stored in Firestore at:
 * /botEvents/{eventId}
 */
export interface BotEventDocument {
  id: string;
  botAccountId: string;
  event: BotEvent;
  processed: boolean;
  createdAt: string;
  processedAt?: string;
}

// ─── Helper: Send command to a bot-worker ───────────────────────────────────

/**
 * Queue a command for a bot-worker to process.
 * The bot-worker watches its command queue in Firestore and picks up new commands.
 */
export async function sendBotCommand(
  botAccountId: string,
  command: BotCommand
): Promise<string> {
  const { getAdminDb } = await import('@/server/lib/admin');
  const db = getAdminDb();

  const docRef = await db
    .collection('botCommands')
    .doc(botAccountId)
    .collection('queue')
    .add({
      botAccountId,
      command,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

  return docRef.id;
}

/**
 * Write a bot event to Firestore for the orchestrator to process.
 * Called by the bot-worker when something happens in the Dota 2 client.
 */
export async function writeBotEvent(
  botAccountId: string,
  event: BotEvent
): Promise<string> {
  const { getAdminDb } = await import('@/server/lib/admin');
  const db = getAdminDb();

  const docRef = await db.collection('botEvents').add({
    botAccountId,
    event,
    processed: false,
    createdAt: new Date().toISOString(),
  });

  return docRef.id;
}

// ─── Orchestrator: Process incoming bot events ──────────────────────────────

/**
 * Process unhandled bot events. Called periodically by the orchestrator.
 * Routes events to the appropriate lobby session handler.
 */
export async function processUnhandledBotEvents(): Promise<number> {
  const { getAdminDb } = await import('@/server/lib/admin');
  const db = getAdminDb();

  const snapshot = await db
    .collection('botEvents')
    .where('processed', '==', false)
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get();

  let processedCount = 0;

  for (const doc of snapshot.docs) {
    const eventDoc = { id: doc.id, ...doc.data() } as BotEventDocument;

    // Defensive: heartbeats must never sit in the processable queue — the worker writes
    // liveness to botAccounts directly. Delete any that slip in (e.g. an old/stale worker)
    // so they can never accumulate and starve lobby lifecycle events (create/invite/ready).
    if (eventDoc.event?.type === 'heartbeat') {
      await doc.ref.delete();
      continue;
    }

    try {
      await handleBotEvent(eventDoc);
      await doc.ref.update({ processed: true, processedAt: new Date().toISOString() });
      processedCount++;
    } catch (error) {
      console.error(`[BotAgent] Failed to process event ${doc.id}:`, error);
    }
  }

  return processedCount;
}

// ─── Session Driver (active lobby lifecycle) ────────────────────────────────

/**
 * Drive active sessions forward each orchestrator cycle:
 *  - `bot_assigned`  → send `create_lobby`, advance to `lobby_creating`
 *  - `ready_check` (both teams ready, not yet launched) → send `start_game` once
 *
 * The `lobby_created` → invite + welcome step is event-driven (see handleBotEvent),
 * firing as soon as the worker reports the lobby exists.
 */
export async function driveActiveSessions(): Promise<{ created: number; started: number }> {
  const { getAdminDb } = await import('@/server/lib/admin');
  const { getTournamentBotConfig, updateLobbySession } = await import('./bot-config-actions');
  const db = getAdminDb();

  let created = 0;
  let started = 0;

  // 1. bot_assigned → create the Dota 2 lobby
  const assignedSnap = await db
    .collection('botLobbySessions')
    .where('state', '==', 'bot_assigned')
    .get();

  for (const doc of assignedSnap.docs) {
    const session = { id: doc.id, ...doc.data() } as LobbySession;
    if (!session.botAccountId) continue;
    try {
      const botConfig = await getTournamentBotConfig(session.tournamentId);
      if (!botConfig) continue;
      const settings = toLobbyCreateSettings(botConfig.lobby, session);
      await sendBotCommand(session.botAccountId, {
        type: 'create_lobby',
        sessionId: session.id,
        lobbyName: session.lobbyName,
        lobbyPassword: session.lobbyPassword,
        settings,
      });
      await updateLobbySession(session.id, { state: 'lobby_creating' });
      created++;
    } catch (err) {
      console.error(`[BotAgent] Failed to dispatch create_lobby for session ${session.id}:`, err);
    }
  }

  // 2. ready_check (both teams ready) → launch the game, exactly once
  const readySnap = await db
    .collection('botLobbySessions')
    .where('state', '==', 'ready_check')
    .get();

  for (const doc of readySnap.docs) {
    const session = { id: doc.id, ...doc.data() } as LobbySession;
    if (session.startGameSentAt) continue; // already launched
    if (!session.botAccountId) continue;
    if (!session.readyState?.radiantReady || !session.readyState?.direReady) continue;
    try {
      const botConfig = await getTournamentBotConfig(session.tournamentId);
      const startMsg = botConfig?.chatMessages?.matchStartMessage;
      if (startMsg) {
        await sendBotCommand(session.botAccountId, {
          type: 'send_chat',
          sessionId: session.id,
          message: startMsg,
        });
      }
      await sendBotCommand(session.botAccountId, {
        type: 'start_game',
        sessionId: session.id,
      });
      // Mark launched but keep state `ready_check` so the ready-check timeout still
      // applies as a safety net until the game_started event moves us to `in_game`.
      await updateLobbySession(session.id, { startGameSentAt: new Date().toISOString() });
      started++;
    } catch (err) {
      console.error(`[BotAgent] Failed to dispatch start_game for session ${session.id}:`, err);
    }
  }

  return { created, started };
}

/**
 * Map admin-facing string lobby settings → the numeric GC enums the worker expects.
 * series_type comes from the session (carried across games of a series).
 */
function toLobbyCreateSettings(
  lobby: LobbySettings,
  session: LobbySession
): LobbyCreateSettings {
  const visMap: Record<string, number> = { public: 0, friends_only: 1, unlisted: 2 };
  const pauseMap: Record<string, number> = { unlimited: 0, limited: 1, disabled: 2 };
  return {
    gameMode: DOTA_GAME_MODE_IDS[lobby.gameMode] ?? 2,
    serverRegion: DOTA_SERVER_REGION_IDS[lobby.serverRegion] ?? 8,
    visibility: visMap[lobby.visibility] ?? 2,
    dotaTvDelay: lobby.dotaTvDelay ?? 120,
    seriesType: session.lobbySeriesType ?? 0,
    leagueId: lobby.leagueId,
    cheatsEnabled: lobby.cheatsEnabled ?? false,
    fillWithBots: lobby.fillWithBots ?? false,
    allowSpectators: lobby.allowSpectators ?? true,
    pauseSetting: pauseMap[lobby.pauseSetting] ?? 1,
    // Default to Automatic (coin toss) for official matches.
    selectionPriorityRules: lobby.selectionPriorityRules ?? 1,
  };
}

/**
 * Invite only the players REGISTERED for this match — both teams' rosters (incl. approved
 * standins) and coaches — and post a short instruction message. Called once when the lobby
 * is created. The tournament whitelist (commentators/observers/admins) is deliberately NOT
 * invited; it only exempts those people from being auto-kicked if they join on their own
 * (see getAllAuthorizedSteamIds).
 */
async function inviteRosterAndWelcome(
  session: LobbySession,
  botAccountId: string
): Promise<void> {
  const { getTournamentBotConfig } = await import('./bot-config-actions');
  const botConfig = await getTournamentBotConfig(session.tournamentId);

  const steamIds = new Set<string>();
  for (const p of session.radiantTeam.expectedPlayers) steamIds.add(p.steamId32);
  for (const p of session.direTeam.expectedPlayers) steamIds.add(p.steamId32);
  if (session.radiantTeam.coachSteamId32) steamIds.add(session.radiantTeam.coachSteamId32);
  if (session.direTeam.coachSteamId32) steamIds.add(session.direTeam.coachSteamId32);

  const ids = [...steamIds].filter((id) => id && id !== '0');
  if (ids.length > 0) {
    await sendBotCommand(botAccountId, {
      type: 'invite_players',
      sessionId: session.id,
      steamIds: ids,
    });
  }

  const readyCmd = botConfig?.readyCheck?.readyCommands?.[0] ?? '!ready';
  await sendBotCommand(botAccountId, {
    type: 'send_chat',
    sessionId: session.id,
    message: `[BOT] ${session.lobbyName} — invites sent. Take your team's slots, then type ${readyCmd} once your whole team is seated.`,
  });
}

// ─── Late-arrival forfeit / wait voting ─────────────────────────────────────

/**
 * Per-cycle late-arrival handling for active, not-yet-started sessions.
 *  - Opens a forfeit/wait vote when one team is short past the configured threshold.
 *  - Tallies a vote once its window has closed. A forfeit only happens on an explicit
 *    quorum from the PRESENT team; otherwise a wait extension is granted. This can
 *    never auto-forfeit a team that is actually in the lobby.
 * Opt-in: does nothing unless `lateArrival.enabled` is true for the tournament.
 */
export async function processLateArrival(): Promise<number> {
  const { getAdminDb } = await import('@/server/lib/admin');
  const { getTournamentBotConfig } = await import('./bot-config-actions');
  const db = getAdminDb();

  const snap = await db
    .collection('botLobbySessions')
    .where('state', 'in', ['lobby_open', 'ready_check'])
    .get();
  if (snap.empty) return 0;

  let actions = 0;
  const now = Date.now();

  for (const doc of snap.docs) {
    const session = { id: doc.id, ...doc.data() } as LobbySession;
    try {
      const policy = (await getTournamentBotConfig(session.tournamentId))?.lateArrival;
      if (!policy?.enabled) continue;
      if (session.startGameSentAt) continue; // game already launching

      // Resolve an open vote whose window has closed.
      if (session.lateVote) {
        if (now >= new Date(session.lateVote.closesAt).getTime()) {
          await resolveLateVote(session, policy);
          actions++;
        }
        continue; // one vote at a time per session
      }

      // Otherwise, consider opening a new vote.
      if (!session.scheduledMatchTime) continue;
      if (session.lateWaitUntil && new Date(session.lateWaitUntil).getTime() > now) continue;

      const elapsedMin = (now - new Date(session.scheduledMatchTime).getTime()) / 60000;
      let kind: 'game1' | 'series' | null = null;
      if (elapsedMin >= policy.seriesForfeitMinutes) kind = 'series';
      else if (elapsedMin >= policy.game1ForfeitMinutes) kind = 'game1';
      if (!kind) continue;

      const presence = computeTeamPresence(session);
      const radiantShort = presence.radiant < 5;
      const direShort = presence.dire < 5;
      // Need exactly one short side, with the other present enough to reach quorum.
      let lateSide: 'radiant' | 'dire' | null = null;
      if (radiantShort && !direShort && presence.dire >= policy.requiredVotesForForfeit) lateSide = 'radiant';
      else if (direShort && !radiantShort && presence.radiant >= policy.requiredVotesForForfeit) lateSide = 'dire';
      if (!lateSide) continue;

      await openLateVote(session, policy, kind, lateSide);
      actions++;
    } catch (err) {
      console.error(`[BotAgent] Late-arrival processing failed for session ${session.id}:`, err);
    }
  }
  return actions;
}

/** Count how many of each team's expected players are currently in the lobby. */
function computeTeamPresence(session: LobbySession): { radiant: number; dire: number } {
  const present = new Set((session.lastLobbyPlayers ?? []).map((p) => p.steamId32));
  return {
    radiant: session.radiantTeam.expectedPlayers.filter((p) => present.has(p.steamId32)).length,
    dire: session.direTeam.expectedPlayers.filter((p) => present.has(p.steamId32)).length,
  };
}

async function openLateVote(
  session: LobbySession,
  policy: LateArrivalPolicyConfig,
  kind: 'game1' | 'series',
  lateSide: 'radiant' | 'dire'
): Promise<void> {
  const { updateLobbySession } = await import('./bot-config-actions');
  const now = Date.now();
  const closesAt = new Date(now + (policy.votingWindowSeconds || 60) * 1000).toISOString();

  const lateTeamName = lateSide === 'radiant' ? session.radiantTeam.teamName : session.direTeam.teamName;
  const presentTeamName = lateSide === 'radiant' ? session.direTeam.teamName : session.radiantTeam.teamName;
  const tmpl = kind === 'series' ? policy.lateSeriesAnnouncementTemplate : policy.lateGame1AnnouncementTemplate;
  const minutes = kind === 'series' ? policy.seriesForfeitMinutes : policy.game1ForfeitMinutes;

  await updateLobbySession(session.id, {
    lateVote: { kind, lateSide, openedAt: new Date(now).toISOString(), closesAt, votes: {} },
  });
  await sendBotCommand(session.botAccountId, {
    type: 'send_chat',
    sessionId: session.id,
    message: `[BOT] ${applyLatePlaceholders(tmpl, {
      late_team: lateTeamName,
      present_team: presentTeamName,
      minutes: String(minutes),
      wait_cmd: policy.waitCommands[0] ?? '!wait',
      forfeit_cmd: policy.forfeitCommands[0] ?? '!forfeit',
      window: String(policy.votingWindowSeconds || 60),
      required: String(policy.requiredVotesForForfeit),
    })}`,
  });
}

async function resolveLateVote(
  session: LobbySession,
  policy: LateArrivalPolicyConfig
): Promise<void> {
  const { updateLobbySession } = await import('./bot-config-actions');
  const vote = session.lateVote!;
  const tally = Object.values(vote.votes);
  const forfeitVotes = tally.filter((v) => v === 'forfeit').length;

  const lateTeamName = vote.lateSide === 'radiant' ? session.radiantTeam.teamName : session.direTeam.teamName;
  const winnerSide: 'radiant' | 'dire' = vote.lateSide === 'radiant' ? 'dire' : 'radiant';
  const winnerTeamName = winnerSide === 'radiant' ? session.radiantTeam.teamName : session.direTeam.teamName;

  if (forfeitVotes >= policy.requiredVotesForForfeit) {
    // Quorum reached → reuse the existing forfeit handler (schedules next game / finalizes).
    await updateLobbySession(session.id, { lateVote: undefined });
    const msgTmpl = vote.kind === 'series' ? policy.forfeitSeriesTemplate : policy.forfeitGame1Template;
    await sendBotCommand(session.botAccountId, {
      type: 'send_chat',
      sessionId: session.id,
      message: `[BOT] ${applyLatePlaceholders(msgTmpl, { winner_team: winnerTeamName, loser_team: lateTeamName })}`,
    });
    await handleForfeitDeclared(
      { ...session, lateVote: undefined },
      {
        type: 'forfeit_declared',
        sessionId: session.id,
        forfeitType: vote.kind,
        forfeitedTeam: vote.lateSide,
        forfeitedTeamName: lateTeamName,
        winnerTeamName,
        timestamp: new Date().toISOString(),
      },
      session.botAccountId
    );
  } else {
    // No forfeit quorum → grant a wait extension (safe default; never forfeits).
    const waitUntil = new Date(Date.now() + (policy.waitExtensionMinutes || 10) * 60000).toISOString();
    await updateLobbySession(session.id, { lateVote: undefined, lateWaitUntil: waitUntil });
    const tmpl = tally.length === 0 ? policy.noVoteResultTemplate : policy.waitResultTemplate;
    await sendBotCommand(session.botAccountId, {
      type: 'send_chat',
      sessionId: session.id,
      message: `[BOT] ${applyLatePlaceholders(tmpl, {
        present_team: winnerTeamName,
        extra: String(policy.waitExtensionMinutes || 10),
        votes: String(forfeitVotes),
        required: String(policy.requiredVotesForForfeit),
      })}`,
    });
  }
}

async function handleLateVoteChat(
  session: LobbySession,
  event: ChatMessageEvent
): Promise<void> {
  const vote = session.lateVote;
  if (!vote) return;
  if (Date.now() >= new Date(vote.closesAt).getTime()) return;

  const { getTournamentBotConfig, updateLobbySession } = await import('./bot-config-actions');
  const { identifyPlayerTeam } = await import('./lobby-lifecycle');
  const policy = (await getTournamentBotConfig(session.tournamentId))?.lateArrival;
  if (!policy) return;

  // Only the PRESENT (non-late) team may vote.
  const voterTeam = identifyPlayerTeam(session, event.steamId32);
  if (!voterTeam || voterTeam === vote.lateSide) return;

  const msg = event.message.trim().toLowerCase();
  const isForfeit = policy.forfeitCommands.some((c) => c.toLowerCase() === msg);
  const isWait = policy.waitCommands.some((c) => c.toLowerCase() === msg);
  if (!isForfeit && !isWait) return;

  const votes: Record<string, 'forfeit' | 'wait'> = {
    ...vote.votes,
    [event.steamId32]: isForfeit ? 'forfeit' : 'wait',
  };
  await updateLobbySession(session.id, { lateVote: { ...vote, votes } });
}

/** Replace {placeholder} tokens; unknown tokens are left intact. */
function applyLatePlaceholders(tmpl: string, ctx: Record<string, string>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_m, k) => (ctx[k] !== undefined ? ctx[k] : `{${k}}`));
}

/**
 * Handle a single bot event and update the corresponding lobby session
 */
async function handleBotEvent(eventDoc: BotEventDocument): Promise<void> {
  const { updateLobbySession, getLobbySession } = await import('./bot-config-actions');
  const { updateBotAccountStatus } = await import('./bot-config-actions');
  const event = eventDoc.event;

  switch (event.type) {
    case 'lobby_created': {
      await updateLobbySession(event.sessionId, {
        state: 'lobby_open',
        dotaLobbyId: event.dotaLobbyId,
        lobbyCreatedAt: event.timestamp,
      });
      await updateBotAccountStatus(
        eventDoc.botAccountId,
        'lobby_active',
        undefined,
        undefined
      );
      // Now that the lobby exists, invite the registered roster (+ coaches; NOT the
      // whitelist) and post instructions on how to ready up.
      const createdSession = await getLobbySession(event.sessionId);
      if (createdSession) {
        await inviteRosterAndWelcome(createdSession, eventDoc.botAccountId);
      }
      break;
    }

    case 'player_joined': {
      // Enforce security on player join — immediate kick if unauthorized
      const joinSession = await getLobbySession(event.sessionId);
      if (joinSession && ['lobby_open', 'ready_check'].includes(joinSession.state)) {
        await handlePlayerJoinedEnforcement(joinSession, event, eventDoc.botAccountId);
      }
      break;
    }

    case 'lobby_state_update': {
      // Periodic enforcement check on every lobby state update
      const stateSession = await getLobbySession(event.sessionId);
      if (stateSession && ['lobby_open', 'ready_check'].includes(stateSession.state)) {
        await handleLobbyStateEnforcement(stateSession, event as LobbyStateUpdateEvent, eventDoc.botAccountId);
      }
      break;
    }

    case 'chat_message': {
      const session = await getLobbySession(event.sessionId);
      if (session) {
        if (session.state === 'lobby_open') {
          await handleChatForReadyCheck(session, event);
        }
        // Late-arrival forfeit/wait votes are accepted whenever a vote is open.
        if (session.lateVote) {
          await handleLateVoteChat(session, event);
        }
      }
      break;
    }

    case 'game_started': {
      await updateLobbySession(event.sessionId, {
        state: 'in_game',
        gameStartedAt: event.timestamp,
      });
      await updateBotAccountStatus(
        eventDoc.botAccountId,
        'in_game',
        undefined,
        undefined
      );
      break;
    }

    case 'game_ended': {
      const session = await getLobbySession(event.sessionId);
      if (session) {
        await handleGameEnded(session, event, eventDoc.botAccountId);
      }
      break;
    }

    case 'wait_vote_passed': {
      // Players voted to wait for the late team — extend the orchestrator timeout
      await updateLobbySession(event.sessionId, {
        lateWaitUntil: event.waitUntil,
      });
      break;
    }

    case 'forfeit_declared': {
      const forfeitSession = await getLobbySession(event.sessionId);
      if (forfeitSession) {
        await handleForfeitDeclared(forfeitSession, event, eventDoc.botAccountId);
      }
      break;
    }

    case 'bot_error': {
      await updateLobbySession(event.sessionId, {
        state: 'error',
        error: {
          message: event.message,
          code: event.code,
          timestamp: event.timestamp,
        },
      });
      break;
    }

    case 'heartbeat': {
      await updateBotAccountStatus(
        eventDoc.botAccountId,
        event.status as import('@/types/lobby-bot').BotAccountStatus,
        undefined,
        undefined
      );
      break;
    }

    default:
      // Log unhandled event types
      console.log(`[BotAgent] Unhandled event type: ${(event as BotEvent).type}`);
  }
}

/**
 * Resolve the effective chat message config for a specific bot account,
 * merging per-bot personality overrides on top of the tournament defaults.
 */
function getEffectiveChatMessages(
  botConfig: TournamentBotConfig,
  botAccountId: string
): TournamentBotConfig['chatMessages'] {
  const overrides = botConfig.perBotMessages?.[botAccountId];
  if (!overrides) return botConfig.chatMessages;
  return { ...botConfig.chatMessages, ...overrides };
}

/**
 * Replace known placeholders in a message string.
 */
function applyPlaceholders(
  message: string,
  ctx: { player_name?: string; team_name?: string; missing?: string }
): string {
  return message
    .replace(/\{player_name\}/g, ctx.player_name ?? '')
    .replace(/\{team_name\}/g, ctx.team_name ?? '')
    .replace(/\{missing\}/g, ctx.missing ?? '');
}

/**
 * Handle a chat message in the context of ready check
 */
async function handleChatForReadyCheck(
  session: LobbySession,
  event: ChatMessageEvent
): Promise<void> {
  const { getTournamentBotConfig, updateLobbySession } = await import(
    './bot-config-actions'
  );
  const { isReadyCommand, isUnreadyCommand, identifyPlayerTeam } = await import(
    './lobby-lifecycle'
  );

  const botConfig = await getTournamentBotConfig(session.tournamentId);
  if (!botConfig) return;

  const team = identifyPlayerTeam(session, event.steamId32);
  if (!team) return; // Not a recognized player

  const readyConfig = botConfig.readyCheck;
  const chatMessages = getEffectiveChatMessages(botConfig, session.botAccountId);

  const isReady = isReadyCommand(event.message, readyConfig.readyCommands);
  const isUnready = isUnreadyCommand(event.message, readyConfig.unreadyCommands);

  if (!isReady && !isUnready) return;

  // Resolve the player's nickname for {player_name} placeholder
  const expectedPlayers = [
    ...session.radiantTeam.expectedPlayers,
    ...session.direTeam.expectedPlayers,
  ];
  const playerRecord = expectedPlayers.find((p) => p.steamId32 === event.steamId32);
  const playerName = playerRecord?.nickname ?? event.playerName;
  const teamAssignment = team === 'radiant' ? session.radiantTeam : session.direTeam;
  const teamName = teamAssignment.teamName;

  if (isReady) {
    // ── Slot validation ─────────────────────────────────────────────────────
    // Check that all expected players from this team are seated on the correct side.
    // Uses the live snapshot included in the event by the bot-worker.
    if (event.currentPlayers) {
      const expectedSteamIds = teamAssignment.expectedPlayers.map((p) => p.steamId32);
      const playersOnCorrectSide = new Set(
        event.currentPlayers
          .filter((p) => p.teamSide === team)
          .map((p) => p.steamId32)
      );

      const missingPlayers = teamAssignment.expectedPlayers.filter(
        (p) => !playersOnCorrectSide.has(p.steamId32)
      );

      if (missingPlayers.length > 0 || expectedSteamIds.length > playersOnCorrectSide.size) {
        const missingNames = missingPlayers.map((p) => p.nickname).join(', ');
        const notReadyMsg = applyPlaceholders(
          chatMessages.teamNotReadyMessage,
          { player_name: playerName, team_name: teamName, missing: missingNames }
        );
        await sendBotCommand(session.botAccountId, {
          type: 'send_chat',
          sessionId: session.id,
          message: notReadyMsg,
        });
        return; // Do not mark the team as ready
      }
    }

    const updatedReadyState = { ...session.readyState };

    if (team === 'radiant') {
      updatedReadyState.radiantReady = true;
      updatedReadyState.radiantReadyBy = event.steamId32;
    } else {
      updatedReadyState.direReady = true;
      updatedReadyState.direReadyBy = event.steamId32;
    }

    const bothReady = updatedReadyState.radiantReady && updatedReadyState.direReady;

    await updateLobbySession(session.id, {
      readyState: updatedReadyState,
      state: bothReady ? 'ready_check' : session.state,
    });

    if (bothReady) {
      await sendBotCommand(session.botAccountId, {
        type: 'send_chat',
        sessionId: session.id,
        message: applyPlaceholders(chatMessages.allReadyMessage, { player_name: playerName, team_name: teamName }),
      });
    } else {
      await sendBotCommand(session.botAccountId, {
        type: 'send_chat',
        sessionId: session.id,
        message: applyPlaceholders(chatMessages.teamReadyMessage, { player_name: playerName, team_name: teamName }),
      });
    }
  } else if (isUnready) {
    const updatedReadyState = { ...session.readyState };

    if (team === 'radiant') {
      updatedReadyState.radiantReady = false;
      updatedReadyState.radiantReadyBy = undefined;
    } else {
      updatedReadyState.direReady = false;
      updatedReadyState.direReadyBy = undefined;
    }

    await updateLobbySession(session.id, {
      readyState: updatedReadyState,
      state: 'lobby_open',
    });
  }
}

/**
 * Schedule a match sync to run after the configured delay
 */
function scheduleMatchSync(session: LobbySession, dotaMatchId: number): void {
  // In a production environment, this would use a job scheduler (e.g., Cloud Tasks,
  // Bull queue, or a simple setTimeout in the bot-worker process).
  // For now, we'll use the Firestore-based approach: write a sync task document
  // that gets picked up by a periodic sync worker.

  import('@/server/lib/admin').then(async ({ getAdminDb }) => {
    const db = getAdminDb();

    // Get bot config for sync delay
    const botConfig = await import('./bot-config-actions').then((m) =>
      m.getTournamentBotConfig(session.tournamentId)
    );
    const delayMinutes = botConfig?.postMatch.syncDelayMinutes ?? 5;
    const syncAt = new Date(
      Date.now() + delayMinutes * 60 * 1000
    ).toISOString();

    await db.collection('botSyncTasks').add({
      sessionId: session.id,
      matchId: session.matchId,
      tournamentId: session.tournamentId,
      dotaMatchId,
      syncAt,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    console.log(
      `[BotAgent] Scheduled match sync for dotaMatchId=${dotaMatchId} at ${syncAt}`
    );
  });
}

// ─── Series Game-End Handler ────────────────────────────────────────────────

/**
 * Handle the end of a game within a series.
 * Records the result, updates session & match, then either:
 *  - Schedules the next game lobby (series continues), or
 *  - Marks the series as decided and finalizes the match
 */
async function handleGameEnded(
  session: LobbySession,
  event: GameEndedEvent,
  botAccountId: string
): Promise<void> {
  const {
    updateLobbySession,
    updateBotAccountStatus,
    scheduleNextGameInSeries,
  } = await import('./bot-config-actions');
  const { calculateSeriesResult, formatSeriesScore, getNextGameNumber } = await import(
    './lobby-lifecycle'
  );
  const { getAdminDb } = await import('@/server/lib/admin');

  // ── 1. Determine game winner ──────────────────────────
  const gameWinnerSide: 'radiant' | 'dire' = event.radiantWin ? 'radiant' : 'dire';
  const gameWinnerTeamId = event.radiantWin
    ? session.radiantTeam.teamId
    : session.direTeam.teamId;

  // ── 2. Build updated session fields ───────────────────
  const updatedGameIds = [...session.completedGameIds, event.dotaMatchId];
  const updatedWinners: Array<'radiant' | 'dire'> = [
    ...session.completedGameWinners,
    gameWinnerSide,
  ];
  const updatedScore = { ...session.seriesScore };
  updatedScore[gameWinnerTeamId] = (updatedScore[gameWinnerTeamId] || 0) + 1;

  // Persist updated game data to the current session before making decisions
  await updateLobbySession(session.id, {
    state: 'post_game',
    gameEndedAt: event.timestamp,
    completedGameIds: updatedGameIds,
    completedGameWinners: updatedWinners,
    seriesScore: updatedScore,
  });
  await updateBotAccountStatus(botAccountId, 'post_game', undefined, undefined);

  // ── 3. Declare match reference — used in series completion block below ──────
  // Match data (game_ids, scores) is written by the pendingSync pipeline;
  // we do NOT manually write intermediate per-game data here.
  const db = getAdminDb();
  const matchRef = db
    .collection('tournaments')
    .doc(session.tournamentId)
    .collection('matches')
    .doc(session.matchId);

  // Build a virtual updated session for series calculation
  const updatedSession: LobbySession = {
    ...session,
    completedGameIds: updatedGameIds,
    completedGameWinners: updatedWinners,
    seriesScore: updatedScore,
  };

  // ── 4. Check if series is decided ─────────────────────
  const result = calculateSeriesResult(updatedSession);
  const scoreText = formatSeriesScore(updatedSession);

  // Schedule match data sync for the completed game
  scheduleMatchSync(session, event.dotaMatchId);

  if (result.decided) {
    // ── SERIES DECIDED ──────────────────────────────────
    const winnerTeamName = result.winnerId
      ? result.winnerId === session.radiantTeam.teamId
        ? session.radiantTeam.teamName
        : session.direTeam.teamName
      : null;

    // Finalize match document
    const finalMatchUpdates: Record<string, unknown> = {
      status: 'completed',
      completed_at: event.timestamp,
    };
    if (result.winnerId) {
      finalMatchUpdates.winnerId = result.winnerId;
    } else if (result.isDraw) {
      finalMatchUpdates.winnerId = null; // BO2 draw
    }
    await matchRef.update(finalMatchUpdates);

    // Complete the session
    await updateLobbySession(session.id, {
      state: 'completed',
      completedAt: event.timestamp,
    });
    await updateBotAccountStatus(botAccountId, 'idle', undefined, undefined);

    // Announce series result in lobby chat
    const seriesMessage = result.isDraw
      ? `Series complete! Draw: ${scoreText}`
      : `Series decided! ${winnerTeamName} wins ${scoreText}`;
    await sendBotCommand(botAccountId, {
      type: 'send_chat',
      sessionId: session.id,
      message: seriesMessage,
    });

    // Leave the lobby
    await sendBotCommand(botAccountId, {
      type: 'leave_lobby',
      sessionId: session.id,
    } as BotCommand);

    console.log(
      `[BotAgent] Series decided for match ${session.matchId}: ${scoreText} (winner: ${result.winnerId || 'draw'})`
    );
  } else {
    // ── SERIES CONTINUES ────────────────────────────────
    const nextGame = getNextGameNumber(updatedSession);

    if (nextGame === null) {
      // Safety fallback — shouldn't happen if calculateSeriesResult is correct
      console.error(
        `[BotAgent] getNextGameNumber returned null but series not decided for session ${session.id}`
      );
      return;
    }

    // Announce score and next game
    const gameWinnerName =
      gameWinnerSide === 'radiant'
        ? session.radiantTeam.teamName
        : session.direTeam.teamName;
    await sendBotCommand(botAccountId, {
      type: 'send_chat',
      sessionId: session.id,
      message: `Game ${session.currentGameNumber} complete! ${gameWinnerName} wins. Score: ${scoreText}. Opening lobby for Game ${nextGame}...`,
    });

    // Leave current lobby
    await sendBotCommand(botAccountId, {
      type: 'leave_lobby',
      sessionId: session.id,
    } as BotCommand);

    // Mark current session complete and free the bot
    await updateLobbySession(session.id, {
      state: 'completed',
      completedAt: event.timestamp,
    });
    await updateBotAccountStatus(botAccountId, 'idle', undefined, undefined);

    // Schedule the next game lobby
    const nextResult = await scheduleNextGameInSeries(updatedSession, nextGame);
    if (nextResult.success) {
      console.log(
        `[BotAgent] Scheduled Game ${nextGame} for match ${session.matchId} (new session: ${nextResult.sessionId})`
      );
    } else {
      console.error(
        `[BotAgent] Failed to schedule Game ${nextGame} for match ${session.matchId}: ${nextResult.error}`
      );
    }
  }
}

// ─── Enforcement Handlers ───────────────────────────────────────────────────

/**
 * Handle a player_joined event: kick unauthorized players, welcome eligible ones.
 * This runs on every join so unauthorized players are ejected fast.
 */
async function handlePlayerJoinedEnforcement(
  session: LobbySession,
  event: PlayerJoinedEvent,
  botAccountId: string
): Promise<void> {
  const { getTournamentBotConfig } = await import('./bot-config-actions');
  const { getAllAuthorizedSteamIds } = await import('./lobby-lifecycle');

  const botConfig = await getTournamentBotConfig(session.tournamentId);
  const whitelist = botConfig?.whitelist ?? [];
  const authorized = getAllAuthorizedSteamIds(session, whitelist);

  if (!authorized.has(event.steamId32)) {
    if (!botConfig?.enforcement?.autoKickUnauthorized) return;
    // Unauthorized player — kick immediately
    await sendBotCommand(botAccountId, {
      type: 'kick_player',
      sessionId: session.id,
      steamId32: event.steamId32,
    });
    await sendBotCommand(botAccountId, {
      type: 'send_chat',
      sessionId: session.id,
      message: `Player (Steam32: ${event.steamId32}) is not registered for this match and has been removed.`,
    });
    return;
  }

  // Eligible player joined — look up their display name and send welcome message
  if (!botConfig) return;
  const effectiveChat = getEffectiveChatMessages(botConfig, botAccountId);
  const welcomeTemplate = effectiveChat.welcomeMessage;
  if (!welcomeTemplate) return;

  // Find name from expected players (registered or approved standin)
  const allExpected = [
    ...session.radiantTeam.expectedPlayers,
    ...session.direTeam.expectedPlayers,
  ];
  const playerRecord = allExpected.find((p) => p.steamId32 === event.steamId32);
  const playerName = playerRecord?.nickname ?? `Steam32:${event.steamId32}`;

  // Apply {player_name} placeholder; prefix name for a personal welcome
  const welcomeMsg = applyPlaceholders(welcomeTemplate, { player_name: playerName });
  await sendBotCommand(botAccountId, {
    type: 'send_chat',
    sessionId: session.id,
    message: `${playerName}: ${welcomeMsg}`,
  });
}

/**
 * Handle a lobby_state_update event: full enforcement check.
 * Kicks unauthorized players and warns/kicks wrong-slot players.
 */
async function handleLobbyStateEnforcement(
  session: LobbySession,
  event: LobbyStateUpdateEvent,
  botAccountId: string
): Promise<void> {
  const { getTournamentBotConfig, updateLobbySession } = await import('./bot-config-actions');
  const { evaluateEnforcement } = await import('./lobby-lifecycle');
  const { DEFAULT_ENFORCEMENT_CONFIG } = await import('@/types/lobby-bot');

  const botConfig = await getTournamentBotConfig(session.tournamentId);
  const enforcementConfig = botConfig?.enforcement ?? DEFAULT_ENFORCEMENT_CONFIG;
  const whitelist = botConfig?.whitelist ?? [];

  // Convert event players to LobbySlotInfo format
  const players = event.players.map((p) => ({
    slotIndex: p.slotIndex,
    steamId32: p.steamId32,
    teamSide: p.teamSide,
  }));

  // Persist current occupancy so the late-arrival timer can see who's present.
  await updateLobbySession(session.id, {
    lastLobbyPlayers: players.map((p) => ({ steamId32: p.steamId32, teamSide: p.teamSide })),
  });

  const actions = evaluateEnforcement(session, players, enforcementConfig, whitelist);

  // Execute kicks for unauthorized players only (wrong-slot is informational, not a kick)
  for (const kick of actions.kickPlayers) {
    if (kick.reason !== 'not_registered') continue;
    await sendBotCommand(botAccountId, {
      type: 'kick_player',
      sessionId: session.id,
      steamId32: kick.steamId32,
    });
  }

  // When both teams have said !ready, check slot cohesion and inform players
  if (session.state === 'ready_check') {
    await validateAndAnnounceSlots(session, players, botAccountId);
  }

  // Note: wrong-slot reinvites and warnings are intentionally omitted — sides are
  // interchangeable (coin toss decides radiant/dire), so only same-team cohesion matters.
}

/**
 * Send an informational slot-cohesion message when both teams have declared ready.
 * Teams A and B can sit on either side (Radiant or Dire), but each team's players
 * must all be on the SAME side. If they're split, let them know.
 */
async function validateAndAnnounceSlots(
  session: LobbySession,
  players: Array<{ steamId32: string; teamSide: 'radiant' | 'dire' | 'spectator' | 'unassigned' }>,
  botAccountId: string
): Promise<void> {
  const teams: Array<{ assignment: Set<string>; name: string }> = [
    {
      assignment: new Set(session.radiantTeam.expectedPlayers.map((p) => p.steamId32)),
      name: session.radiantTeam.teamName,
    },
    {
      assignment: new Set(session.direTeam.expectedPlayers.map((p) => p.steamId32)),
      name: session.direTeam.teamName,
    },
  ];

  const splitTeams: string[] = [];

  for (const { assignment, name } of teams) {
    const seated = players.filter(
      (p) =>
        assignment.has(p.steamId32) &&
        (p.teamSide === 'radiant' || p.teamSide === 'dire')
    );
    const onRadiant = seated.filter((p) => p.teamSide === 'radiant').length;
    const onDire = seated.filter((p) => p.teamSide === 'dire').length;
    if (onRadiant > 0 && onDire > 0) {
      splitTeams.push(name);
    }
  }

  if (splitTeams.length > 0) {
    for (const teamName of splitTeams) {
      await sendBotCommand(botAccountId, {
        type: 'send_chat',
        sessionId: session.id,
        message: `[BOT] ${teamName}: your players are split across Radiant and Dire slots. Please sit together on one side before the game starts.`,
      });
    }
  }
}

/**
 * Handle a forfeit_declared event from the bot-worker.
 *
 * game1 forfeit  → award +1 to the winner, record in forfeitedGames,
 *                  schedule the next game, close current lobby.
 * series forfeit → mark match as completed with the winner, close lobby.
 */
async function handleForfeitDeclared(
  session: LobbySession,
  event: ForfeitDeclaredEvent,
  botAccountId: string
): Promise<void> {
  const {
    updateLobbySession,
    updateBotAccountStatus,
    scheduleNextGameInSeries,
  } = await import('./bot-config-actions');
  const { getNextGameNumber } = await import('./lobby-lifecycle');
  const { getAdminDb } = await import('@/server/lib/admin');

  // Derive winner side and team ID from the forfeited side
  const winnerSide: 'radiant' | 'dire' =
    event.forfeitedTeam === 'radiant' ? 'dire' : 'radiant';
  const winnerTeamId =
    winnerSide === 'radiant'
      ? session.radiantTeam.teamId
      : session.direTeam.teamId;

  // Update series score in the session
  const updatedScore = { ...session.seriesScore };
  updatedScore[winnerTeamId] = (updatedScore[winnerTeamId] || 0) + 1;

  const newForfeitEntry = {
    gameNumber: session.currentGameNumber,
    forfeitedTeam: event.forfeitedTeam,
    winnerTeam: winnerSide,
  };
  const updatedForfeitedGames = [
    ...(session.forfeitedGames ?? []),
    newForfeitEntry,
  ];

  if (event.forfeitType === 'game1') {
    // Close current session, schedule next game
    await updateLobbySession(session.id, {
      state: 'completed',
      completedAt: new Date().toISOString(),
      seriesScore: updatedScore,
      forfeitedGames: updatedForfeitedGames,
    });
    await updateBotAccountStatus(botAccountId, 'idle', undefined, undefined);

    await sendBotCommand(botAccountId, {
      type: 'leave_lobby',
      sessionId: session.id,
    } as BotCommand);

    const virtualSession: LobbySession = {
      ...session,
      seriesScore: updatedScore,
      forfeitedGames: updatedForfeitedGames,
    };

    const nextGame = getNextGameNumber(virtualSession);
    if (nextGame !== null) {
      const result = await scheduleNextGameInSeries(virtualSession, nextGame);
      if (!result.success) {
        console.error(
          `[BotAgent] Failed to schedule Game ${nextGame} after forfeit for match ${session.matchId}: ${result.error}`
        );
      } else {
        console.log(
          `[BotAgent] Scheduled Game ${nextGame} after Game 1 forfeit for match ${session.matchId} (session: ${result.sessionId})`
        );
      }
    }
  } else {
    // Series forfeit — finalize everything
    await updateLobbySession(session.id, {
      state: 'completed',
      completedAt: new Date().toISOString(),
      seriesScore: updatedScore,
      forfeitedGames: updatedForfeitedGames,
    });
    await updateBotAccountStatus(botAccountId, 'idle', undefined, undefined);

    const db = getAdminDb();
    await db
      .collection('tournaments')
      .doc(session.tournamentId)
      .collection('matches')
      .doc(session.matchId)
      .update({
        status: 'completed',
        winnerId: winnerTeamId,
        completed_at: new Date().toISOString(),
        forfeit: true,
      });

    await sendBotCommand(botAccountId, {
      type: 'leave_lobby',
      sessionId: session.id,
    } as BotCommand);

    console.log(
      `[BotAgent] Series forfeited: ${event.winnerTeamName} wins match ${session.matchId}`
    );
  }
}
