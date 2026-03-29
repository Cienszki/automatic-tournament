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
  DotaGameMode,
  DotaServerRegion,
  DOTA_GAME_MODE_IDS,
  DOTA_SERVER_REGION_IDS,
} from '@/types/lobby-bot';

// ─── Bot Worker Commands ────────────────────────────────────────────────────
// Commands sent from the orchestrator (Next.js API) to the bot-worker process

export type BotCommand =
  | CreateLobbyCommand
  | InvitePlayersCommand
  | SendChatMessageCommand
  | KickPlayerCommand
  | StartGameCommand
  | LeaveLobbyCommand
  | ShutdownCommand;

export interface CreateLobbyCommand {
  type: 'create_lobby';
  sessionId: string;
  lobbyName: string;
  lobbyPassword: string;
  settings: LobbySettings;
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
  | BotErrorEvent
  | BotHeartbeatEvent;

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
    .limit(50)
    .get();

  let processedCount = 0;

  for (const doc of snapshot.docs) {
    const eventDoc = { id: doc.id, ...doc.data() } as BotEventDocument;

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
      // Delegate to ready check handler
      const session = await getLobbySession(event.sessionId);
      if (session && session.state === 'lobby_open') {
        await handleChatForReadyCheck(session, event);
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
 * Handle a chat message in the context of ready check
 */
async function handleChatForReadyCheck(
  session: LobbySession,
  event: ChatMessageEvent
): Promise<void> {
  const { getTournamentBotConfig, updateLobbySession } = await import(
    './bot-config-actions'
  );
  const {
    isReadyCommand,
    isUnreadyCommand,
    identifyPlayerTeam,
    isReadyCommandAllowed,
  } = await import('./lobby-lifecycle');

  const botConfig = await getTournamentBotConfig(session.tournamentId);
  if (!botConfig) return;

  const team = identifyPlayerTeam(session, event.steamId32);
  if (!team) return; // Not a recognized player

  const readyConfig = botConfig.readyCheck;
  const cooldownSeconds = botConfig.enforcement?.readyCooldownSeconds ?? 5;

  // Check cooldown before processing ready/unready commands
  const isReady = isReadyCommand(event.message, readyConfig.readyCommands);
  const isUnready = isUnreadyCommand(event.message, readyConfig.unreadyCommands);

  if (!isReady && !isUnready) return;

  if (!isReadyCommandAllowed(session, event.steamId32, cooldownSeconds)) {
    // Silently ignore — player is spamming
    return;
  }

  if (isReady) {
    const updatedReadyState = { ...session.readyState };
    const updatedCooldowns = { ...(session.readyCooldowns || {}) };
    updatedCooldowns[event.steamId32] = new Date().toISOString();

    if (team === 'radiant') {
      updatedReadyState.radiantReady = true;
      updatedReadyState.radiantReadyBy = event.steamId32;
    } else {
      updatedReadyState.direReady = true;
      updatedReadyState.direReadyBy = event.steamId32;
    }

    const bothReady =
      updatedReadyState.radiantReady && updatedReadyState.direReady;

    await updateLobbySession(session.id, {
      readyState: updatedReadyState,
      readyCooldowns: updatedCooldowns,
      state: bothReady ? 'ready_check' : session.state,
    });

    if (bothReady) {
      // Both teams ready — notify bot to validate and start
      await sendBotCommand(session.botAccountId, {
        type: 'send_chat',
        sessionId: session.id,
        message: botConfig.chatMessages.allReadyMessage,
      });
    } else {
      // Notify that one team is ready
      const teamName =
        team === 'radiant'
          ? session.radiantTeam.teamName
          : session.direTeam.teamName;
      await sendBotCommand(session.botAccountId, {
        type: 'send_chat',
        sessionId: session.id,
        message: `${teamName} is ready! Waiting for the other team...`,
      });
    }
  } else if (isUnready) {
    const updatedReadyState = { ...session.readyState };
    const updatedCooldowns = { ...(session.readyCooldowns || {}) };
    updatedCooldowns[event.steamId32] = new Date().toISOString();

    if (team === 'radiant') {
      updatedReadyState.radiantReady = false;
      updatedReadyState.radiantReadyBy = undefined;
    } else {
      updatedReadyState.direReady = false;
      updatedReadyState.direReadyBy = undefined;
    }

    await updateLobbySession(session.id, {
      readyState: updatedReadyState,
      readyCooldowns: updatedCooldowns,
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

  // ── 3. Update match document with the game result ─────
  const db = getAdminDb();
  const matchRef = db
    .collection('tournaments')
    .doc(session.tournamentId)
    .collection('matches')
    .doc(session.matchId);

  // Append game ID to match.game_ids and update team scores
  const matchSnap = await matchRef.get();
  if (matchSnap.exists) {
    const matchData = matchSnap.data();
    const existingGameIds: number[] = matchData?.game_ids || [];
    const teamAId: string = matchData?.teamA?.id;
    const teamBId: string = matchData?.teamB?.id;

    const matchUpdates: Record<string, unknown> = {
      game_ids: [...existingGameIds, event.dotaMatchId],
    };

    // Sync teamA/teamB scores from the series score
    if (teamAId && teamBId) {
      matchUpdates['teamA.score'] = updatedScore[teamAId] || 0;
      matchUpdates['teamB.score'] = updatedScore[teamBId] || 0;
    }

    await matchRef.update(matchUpdates);
  }

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
 * Handle a player_joined event: immediately kick unauthorized players.
 * This runs on every join so unauthorized players are ejected fast.
 */
async function handlePlayerJoinedEnforcement(
  session: LobbySession,
  event: PlayerJoinedEvent,
  botAccountId: string
): Promise<void> {
  const { getTournamentBotConfig, updateLobbySession } = await import('./bot-config-actions');
  const { getAllAuthorizedSteamIds } = await import('./lobby-lifecycle');

  const botConfig = await getTournamentBotConfig(session.tournamentId);
  if (!botConfig?.enforcement?.autoKickUnauthorized) return;

  const whitelist = botConfig.whitelist ?? [];
  const authorized = getAllAuthorizedSteamIds(session, whitelist);

  if (!authorized.has(event.steamId32)) {
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
  }
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

  const actions = evaluateEnforcement(session, players, enforcementConfig, whitelist);

  // Execute kicks
  for (const kick of actions.kickPlayers) {
    await sendBotCommand(botAccountId, {
      type: 'kick_player',
      sessionId: session.id,
      steamId32: kick.steamId32,
    });
  }

  // Execute reinvites (for wrong-slot kicks)
  if (actions.reinvitePlayers.length > 0) {
    await sendBotCommand(botAccountId, {
      type: 'invite_players',
      sessionId: session.id,
      steamIds: actions.reinvitePlayers,
    });
  }

  // Send chat messages
  for (const msg of actions.chatMessages) {
    await sendBotCommand(botAccountId, {
      type: 'send_chat',
      sessionId: session.id,
      message: msg,
    });
  }

  // Persist updated wrong-slot warnings
  if (
    JSON.stringify(actions.updatedWrongSlotWarnings) !==
    JSON.stringify(session.wrongSlotWarnings || {})
  ) {
    await updateLobbySession(session.id, {
      wrongSlotWarnings: actions.updatedWrongSlotWarnings,
    });
  }
}
