// src/lib/bot/bot-config-actions.ts
// Server actions for managing bot configuration per tournament
'use server';

import { getAdminDb } from '@/server/lib/admin';
import type {
  TournamentBotConfig,
  BotAccount,
  LobbySession,
  LobbySessionState,
  DEFAULT_TOURNAMENT_BOT_CONFIG,
} from '@/types/lobby-bot';

// ─── Bot Config CRUD ────────────────────────────────────────────────────────

/**
 * Get the bot configuration for a tournament
 */
export async function getTournamentBotConfig(
  tournamentId: string
): Promise<TournamentBotConfig | null> {
  const db = getAdminDb();
  const doc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('config')
    .doc('bot')
    .get();

  if (!doc.exists) return null;
  return doc.data() as TournamentBotConfig;
}

/**
 * Save/update the bot configuration for a tournament
 */
export async function saveTournamentBotConfig(
  tournamentId: string,
  config: TournamentBotConfig,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    const updatedConfig: TournamentBotConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUserId,
    };

    await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('config')
      .doc('bot')
      .set(updatedConfig, { merge: true });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BotConfig] Save failed:', message);
    return { success: false, error: message };
  }
}

// ─── Bot Account Management (Super Admin) ───────────────────────────────────

/**
 * Get all registered bot accounts
 */
export async function getAllBotAccounts(): Promise<BotAccount[]> {
  const db = getAdminDb();
  const snapshot = await db.collection('botAccounts').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BotAccount);
}

/**
 * Get available (idle) bot accounts
 */
export async function getAvailableBotAccounts(): Promise<BotAccount[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection('botAccounts')
    .where('enabled', '==', true)
    .where('status', '==', 'idle')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BotAccount);
}

/**
 * Register a new bot account (super admin only)
 */
export async function registerBotAccount(
  account: Omit<BotAccount, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currentMatchId' | 'currentTournamentId' | 'lastHeartbeat'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = getAdminDb();
    const now = new Date().toISOString();
    const docRef = await db.collection('botAccounts').add({
      ...account,
      status: 'idle',
      currentMatchId: null,
      currentTournamentId: null,
      lastHeartbeat: null,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id: docRef.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Delete a bot account
 */
export async function deleteBotAccount(
  botAccountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    await db.collection('botAccounts').doc(botAccountId).delete();
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Enable or disable a bot account, or update its display name / notes / username
 */
export async function updateBotAccount(
  botAccountId: string,
  updates: Partial<Pick<BotAccount, 'enabled' | 'displayName' | 'notes' | 'username'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    await db.collection('botAccounts').doc(botAccountId).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update a bot account's status
 */
export async function updateBotAccountStatus(
  botAccountId: string,
  status: BotAccount['status'],
  matchId: string | null = null,
  tournamentId: string | null = null
): Promise<void> {
  const db = getAdminDb();
  await db.collection('botAccounts').doc(botAccountId).update({
    status,
    currentMatchId: matchId,
    currentTournamentId: tournamentId,
    lastHeartbeat: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// ─── Lobby Session Management ───────────────────────────────────────────────

/**
 * Create a new lobby session for an upcoming match
 */
export async function createLobbySession(
  session: Omit<LobbySession, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = getAdminDb();
    const docRef = await db.collection('botLobbySessions').add({
      ...session,
      createdAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get a lobby session by ID
 */
export async function getLobbySession(
  sessionId: string
): Promise<LobbySession | null> {
  const db = getAdminDb();
  const doc = await db.collection('botLobbySessions').doc(sessionId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as LobbySession;
}

/**
 * Get all lobby sessions for a match
 */
export async function getLobbySessionsForMatch(
  matchId: string
): Promise<LobbySession[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection('botLobbySessions')
    .where('matchId', '==', matchId)
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LobbySession);
}

/**
 * Get all pending sessions that need a bot assigned
 */
export async function getPendingLobbySessions(): Promise<LobbySession[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection('botLobbySessions')
    .where('state', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LobbySession);
}

/**
 * Get active sessions (not completed, cancelled, or error)
 */
export async function getActiveLobbySessions(): Promise<LobbySession[]> {
  const db = getAdminDb();
  // Firestore doesn't support "not in" for multiple values elegantly,
  // so we query for each active state
  const activeStates: LobbySessionState[] = [
    'pending',
    'bot_assigned',
    'lobby_creating',
    'lobby_open',
    'ready_check',
    'requirements_met',
    'coin_toss',
    'in_game',
    'post_game',
    'syncing',
  ];

  const snapshot = await db
    .collection('botLobbySessions')
    .where('state', 'in', activeStates)
    .orderBy('createdAt', 'asc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LobbySession);
}

/**
 * Update a lobby session's state and optional fields
 */
export async function updateLobbySession(
  sessionId: string,
  updates: Partial<LobbySession>
): Promise<void> {
  const db = getAdminDb();
  await db.collection('botLobbySessions').doc(sessionId).update(updates);
}

/**
 * Cancel a lobby session
 */
export async function cancelLobbySession(sessionId: string): Promise<void> {
  await updateLobbySession(sessionId, {
    state: 'cancelled',
    completedAt: new Date().toISOString(),
  });
}

// ─── Match → Lobby Session Bridge ───────────────────────────────────────────

/**
 * Build the expected player lists for a match, respecting standins.
 * Fetches team rosters and approved standins from the match document.
 */
export async function buildLobbyTeamAssignments(
  tournamentId: string,
  matchId: string
): Promise<{
  radiant: import('@/types/lobby-bot').LobbyTeamAssignment;
  dire: import('@/types/lobby-bot').LobbyTeamAssignment;
} | null> {
  const db = getAdminDb();

  // Fetch match
  const matchDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')
    .doc(matchId)
    .get();
  if (!matchDoc.exists) return null;
  const match = matchDoc.data() as import('@/lib/definitions').Match;

  // Fetch both teams
  const [teamADoc, teamBDoc] = await Promise.all([
    db.collection('tournaments').doc(tournamentId).collection('teams').doc(match.teamA.id).get(),
    db.collection('tournaments').doc(tournamentId).collection('teams').doc(match.teamB.id).get(),
  ]);
  if (!teamADoc.exists || !teamBDoc.exists) return null;

  const teamA = teamADoc.data() as import('@/lib/definitions').Team;
  const teamB = teamBDoc.data() as import('@/lib/definitions').Team;

  // Build approved standins map: replacedPlayerId → standin info
  const approvedStandins = match.approvedStandins || {};
  const standinsByTeam: Record<string, Record<string, { steamId32: string; nickname: string }>> = {};

  for (const req of Object.values(approvedStandins)) {
    if (!standinsByTeam[req.teamId]) standinsByTeam[req.teamId] = {};
    standinsByTeam[req.teamId][req.replacedPlayerId] = {
      steamId32: req.steamId32,
      nickname: req.nickname,
    };
  }

  function buildPlayerList(
    team: import('@/lib/definitions').Team,
    teamId: string
  ): import('@/types/lobby-bot').LobbyExpectedPlayer[] {
    const teamStandins = standinsByTeam[teamId] || {};

    // Support both players array (PDL) and roster map (wiosenna/MMR tournaments).
    // roster is keyed by steamId64; each entry has { steamId32, nickname, role, ... }.
    const players: { id: string; steamId32: string; nickname: string }[] =
      team.players?.length
        ? team.players.map((p) => ({ id: p.id, steamId32: p.steamId32, nickname: p.nickname }))
        : Object.entries(team.roster ?? {}).map(([steamId64, p]) => ({
            id: steamId64,
            steamId32: p.steamId32,
            nickname: p.nickname,
          }));

    return players.map((player) => {
      const standin = teamStandins[player.id];
      if (standin) {
        return {
          steamId32: standin.steamId32,
          nickname: standin.nickname,
          isStandin: true,
          replacesPlayerId: player.id,
          replacesPlayerNickname: player.nickname,
        };
      }
      return {
        steamId32: player.steamId32,
        nickname: player.nickname,
        isStandin: false,
      };
    });
  }

  // Team A = Radiant, Team B = Dire (default assignment)
  const radiant: import('@/types/lobby-bot').LobbyTeamAssignment = {
    teamId: match.teamA.id,
    teamName: match.teamA.name,
    expectedPlayers: buildPlayerList(teamA, match.teamA.id),
    coachSteamId32: teamA.coach?.steamProfileUrl
      ? undefined // Would need to resolve from coach data
      : undefined,
    coachNickname: teamA.coach?.nickname,
  };

  const dire: import('@/types/lobby-bot').LobbyTeamAssignment = {
    teamId: match.teamB.id,
    teamName: match.teamB.name,
    expectedPlayers: buildPlayerList(teamB, match.teamB.id),
    coachSteamId32: teamB.coach?.steamProfileUrl ? undefined : undefined,
    coachNickname: teamB.coach?.nickname,
  };

  // Resolve coach Steam IDs from coachInfo on match doc
  if (match.coachInfo) {
    if (match.coachInfo[match.teamA.id]) {
      radiant.coachNickname = match.coachInfo[match.teamA.id].nickname;
      // Coach steamId32 would need to be stored; for now use profile URL parsing
    }
    if (match.coachInfo[match.teamB.id]) {
      dire.coachNickname = match.coachInfo[match.teamB.id].nickname;
    }
  }

  return { radiant, dire };
}

/**
 * Schedule a lobby session for an upcoming match.
 * Called by the scheduler when a match approaches its scheduled time.
 */
export async function scheduleLobbyForMatch(
  tournamentId: string,
  matchId: string,
  matchName: string,
  seriesFormat: string,
  scheduledMatchTime?: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  // Check if session already exists for this match
  const existing = await getLobbySessionsForMatch(matchId);
  const activeExisting = existing.filter(
    (s) => !['completed', 'cancelled', 'error'].includes(s.state)
  );
  if (activeExisting.length > 0) {
    return { success: false, error: 'Active lobby session already exists for this match' };
  }

  // Get bot config
  const botConfig = await getTournamentBotConfig(tournamentId);
  if (!botConfig?.enabled) {
    return { success: false, error: 'Bot system is not enabled for this tournament' };
  }

  // Build team assignments
  const assignments = await buildLobbyTeamAssignments(tournamentId, matchId);
  if (!assignments) {
    return { success: false, error: 'Could not build team assignments for this match' };
  }

  // Determine total games from series format
  const seriesFmt = (seriesFormat || 'bo1') as 'bo1' | 'bo2' | 'bo3' | 'bo5';
  const totalGames =
    seriesFmt === 'bo1' ? 1 :
    seriesFmt === 'bo2' ? 2 :
    seriesFmt === 'bo3' ? 3 :
    seriesFmt === 'bo5' ? 5 : 1;

  // Compute Dota 2 lobby series_type: bo1→0 (none), bo2/bo3→1 (BO3), bo5→2 (BO5)
  const lobbySeriesType =
    seriesFmt === 'bo5' ? 2 :
    seriesFmt === 'bo1' ? 0 : 1;

  // Generate a random lobby password
  const password = generateLobbyPassword();

  const session: Omit<LobbySession, 'id'> = {
    matchId,
    tournamentId,
    botAccountId: '', // Will be assigned by the pool manager
    state: 'pending',
    lobbyName: matchName,
    lobbyPassword: password,
    radiantTeam: assignments.radiant,
    direTeam: assignments.dire,
    readyState: {
      radiantReady: false,
      direReady: false,
    },
    validationErrors: [],
    seriesFormat: seriesFmt,
    currentGameNumber: 1,
    totalGames,
    seriesScore: {
      [assignments.radiant.teamId]: 0,
      [assignments.dire.teamId]: 0,
    },
    completedGameIds: [],
    completedGameWinners: [],
    lobbySeriesType,
    lobbyRadiantWins: 0,
    lobbyDireWins: 0,
    scheduledMatchTime,
    createdAt: new Date().toISOString(),
  };

  return createLobbySession(session);
}

/**
 * Schedule the next game in a series by creating a new lobby session.
 * Re-reads approved standins from the match doc to pick up any mid-series changes.
 * Carries over the series score and completed game IDs from the previous session.
 */
export async function scheduleNextGameInSeries(
  previousSession: LobbySession,
  nextGameNumber: number
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const { matchId, tournamentId, seriesFormat, totalGames } = previousSession;

  // Re-build team assignments (picks up any new standins)
  const assignments = await buildLobbyTeamAssignments(tournamentId, matchId);
  if (!assignments) {
    return { success: false, error: 'Could not build team assignments for next game' };
  }

  // Get bot config for lobby name prefix
  const botConfig = await getTournamentBotConfig(tournamentId);
  const gameSuffix = ` - Game ${nextGameNumber}`;
  // Strip any existing " - Game N" suffix
  const baseLobbyName = previousSession.lobbyName.replace(/ - Game \d+$/, '');

  const password = generateLobbyPassword();

  // Compute scheduledMatchTime for the next game based on inter-game break:
  // Give teams <interGameBreakMinutes> after the previous game ended before
  // the late-arrival timer starts measuring for game N+1.
  const interGameBreakMinutes =
    botConfig?.lateArrival?.interGameBreakMinutes ?? 15;
  const scheduledMatchTime =
    previousSession.gameEndedAt
      ? new Date(
          new Date(previousSession.gameEndedAt).getTime() +
            interGameBreakMinutes * 60_000
        ).toISOString()
      : previousSession.scheduledMatchTime; // fallback: keep original if no endedAt yet

  // Radiant/Dire wins to pre-populate in the lobby for game 2+ (shows score in Dota UI)
  const lobbyRadiantWins = previousSession.seriesScore[assignments.radiant.teamId] ?? 0;
  const lobbyDireWins = previousSession.seriesScore[assignments.dire.teamId] ?? 0;

  const session: Omit<LobbySession, 'id'> = {
    matchId,
    tournamentId,
    botAccountId: '', // Will be assigned by the pool manager
    state: 'pending',
    lobbyName: baseLobbyName + gameSuffix,
    lobbyPassword: password,
    radiantTeam: assignments.radiant,
    direTeam: assignments.dire,
    readyState: {
      radiantReady: false,
      direReady: false,
    },
    validationErrors: [],
    seriesFormat,
    currentGameNumber: nextGameNumber,
    totalGames,
    seriesScore: { ...previousSession.seriesScore },
    completedGameIds: [...previousSession.completedGameIds],
    completedGameWinners: [...previousSession.completedGameWinners],
    forfeitedGames: previousSession.forfeitedGames
      ? [...previousSession.forfeitedGames]
      : undefined,
    scheduledMatchTime,
    lobbySeriesType: previousSession.lobbySeriesType,
    lobbyRadiantWins,
    lobbyDireWins,
    createdAt: new Date().toISOString(),
  };

  const result = await createLobbySession(session);
  if (result.success) {
    console.log(
      `[BotConfig] Scheduled game ${nextGameNumber}/${totalGames} for match ${matchId} (session: ${result.id})`
    );
  }
  return { success: result.success, sessionId: result.id, error: result.error };
}

/**
 * Sync lobby session expected players with the latest approved standins
 * from the match document. Called when a standin is approved/revoked while
 * a lobby is already active.
 *
 * Updates ALL active sessions for the match (in case of multi-game series).
 */
export async function syncLobbySessionStandins(
  tournamentId: string,
  matchId: string
): Promise<number> {
  // Re-build the latest team assignments from match doc + approved standins
  const assignments = await buildLobbyTeamAssignments(tournamentId, matchId);
  if (!assignments) return 0;

  // Get tournament whitelist (commentators, observers, admins)
  const botConfig = await getTournamentBotConfig(tournamentId);
  const whitelistIds = (botConfig?.whitelist ?? []).map((e: { steamId32: string }) => e.steamId32);

  const newRadiantIds = assignments.radiant.expectedPlayers.map((p) => p.steamId32);
  const newDireIds = assignments.dire.expectedPlayers.map((p) => p.steamId32);
  const newAllIds = new Set([...newRadiantIds, ...newDireIds]);

  // Find all active (non-terminal) sessions for this match
  const allSessions = await getLobbySessionsForMatch(matchId);
  const activeSessions = allSessions.filter(
    (s) => !['completed', 'cancelled', 'error', 'in_game', 'post_game', 'syncing'].includes(s.state)
  );

  let updated = 0;
  const db = getAdminDb();

  for (const session of activeSessions) {
    // Diff to find which Steam32 IDs were added or removed
    const oldAllIds = new Set([
      ...session.radiantTeam.expectedPlayers.map((p) => p.steamId32),
      ...session.direTeam.expectedPlayers.map((p) => p.steamId32),
    ]);
    const newlyAddedIds = [...newAllIds].filter((id) => !oldAllIds.has(id));
    const removedIds = [...oldAllIds].filter((id) => !newAllIds.has(id));

    // 1. Update Firestore session with new team assignments
    await updateLobbySession(session.id, {
      radiantTeam: assignments.radiant,
      direTeam: assignments.dire,
    });

    // 2. Push bot commands (only when a bot is actually assigned to this session)
    if (session.botAccountId) {
      const queueRef = db
        .collection('botCommands')
        .doc(session.botAccountId)
        .collection('queue');
      const now = new Date().toISOString();

      // Always sync the in-memory allow list so joins/kicks are handled correctly
      await queueRef.add({
        botAccountId: session.botAccountId,
        command: {
          type: 'set_teams',
          sessionId: session.id,
          teamA: newRadiantIds,
          teamB: newDireIds,
          whitelist: whitelistIds,
        },
        status: 'pending',
        createdAt: now,
      });

      // Invite newly added standin(s) when the lobby is still accepting players
      const canInvite = ['lobby_open', 'ready_check', 'requirements_met'].includes(session.state);
      if (canInvite && newlyAddedIds.length > 0) {
        await queueRef.add({
          botAccountId: session.botAccountId,
          command: {
            type: 'invite_players',
            sessionId: session.id,
            steamIds: newlyAddedIds,
          },
          status: 'pending',
          createdAt: now,
        });
      }

      // Proactively kick removed players (best-effort; they may not be in the lobby)
      for (const removedId of removedIds) {
        await queueRef.add({
          botAccountId: session.botAccountId,
          command: {
            type: 'kick_player',
            sessionId: session.id,
            steamId32: removedId,
          },
          status: 'pending',
          createdAt: now,
        });
      }
    }

    updated++;
    console.log(
      `[BotConfig] Synced standins for session ${session.id} (match: ${matchId}, game: ${session.currentGameNumber}): ` +
      `added=[${newlyAddedIds.join(',')}] removed=[${removedIds.join(',')}]`
    );
  }

  return updated;
}

/**
 * Generate a random alphanumeric lobby password
 */
function generateLobbyPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
