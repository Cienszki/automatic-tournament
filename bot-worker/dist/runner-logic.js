"use strict";
// bot-worker/dist/runner-logic.js
// Pure, side-effect-free lobby logic used by the Lobby Runner.
//
// Ported from the old orchestrator's src/lib/bot/lobby-lifecycle.ts and the
// helpers in src/lib/bot/bot-agent.ts. The runner now owns this logic in-process
// (no Firestore event queue), so these functions take plain data and return
// decisions — kicks, ready transitions, series outcomes, settings maps — that the
// runner then acts on against the DotaClient. Keeping them pure makes them unit-
// testable and safe to re-run on a restart (every decision re-derives from state).
Object.defineProperty(exports, "__esModule", { value: true });

// ─── Dota 2 enum maps (mirror of src/types/lobby-bot.ts) ────────────────────
// Server region values are the node-dota2 EServerRegion enum (authoritative):
// europe_west = EUROPE (3); Stockholm (8) is Europe East.
const DOTA_GAME_MODE_IDS = {
    all_pick: 1,
    captains_mode: 2,
    captains_draft: 16,
    random_draft: 6,
    single_draft: 4,
    all_random: 3,
    turbo: 23,
};
const DOTA_SERVER_REGION_IDS = {
    us_west: 1,
    us_east: 2,
    europe_west: 3,
    europe_east: 8,
    russia: 8,
    southeast_asia: 5,
    south_america: 10,
    australia: 7,
    dubai: 6,
    chile: 14,
    peru: 15,
    india: 16,
    japan: 19,
    south_africa: 11,
};

/**
 * Map admin-facing string lobby settings → the numeric GC enums the DotaClient
 * expects. series_type / series wins come from the session (carried across games).
 */
function toLobbyCreateSettings(lobby, session) {
    const visMap = { public: 0, friends_only: 1, unlisted: 2 };
    const pauseMap = { unlimited: 0, limited: 1, disabled: 2 };
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
        // Pre-populate the series score for game 2+ (shows in the Dota 2 lobby UI).
        radiantSeriesWins: session.lobbyRadiantWins ?? 0,
        direSeriesWins: session.lobbyDireWins ?? 0,
    };
}

// ─── Authorization / team identity ──────────────────────────────────────────

/**
 * Every Steam32 id allowed in this lobby: both rosters, coaches, and the
 * tournament-level whitelist (commentators/observers/admins).
 */
function getAllAuthorizedSteamIds(session, whitelist = []) {
    const authorized = new Set();
    for (const p of session.radiantTeam.expectedPlayers) authorized.add(p.steamId32);
    for (const p of session.direTeam.expectedPlayers) authorized.add(p.steamId32);
    if (session.radiantTeam.coachSteamId32) authorized.add(session.radiantTeam.coachSteamId32);
    if (session.direTeam.coachSteamId32) authorized.add(session.direTeam.coachSteamId32);
    for (const entry of whitelist) authorized.add(entry.steamId32);
    return authorized;
}

/** 'radiant' | 'dire' | null — which side a player is expected on (null = not a player). */
function getExpectedTeamSide(session, steamId32) {
    if (session.radiantTeam.expectedPlayers.some((p) => p.steamId32 === steamId32)) return 'radiant';
    if (session.direTeam.expectedPlayers.some((p) => p.steamId32 === steamId32)) return 'dire';
    return null;
}

/** Same as getExpectedTeamSide — kept under the orchestrator's old name for ready-check code. */
function identifyPlayerTeam(session, steamId32) {
    return getExpectedTeamSide(session, steamId32);
}

function getPlayerNickname(session, steamId32) {
    const r = session.radiantTeam.expectedPlayers.find((p) => p.steamId32 === steamId32);
    if (r) return r.nickname;
    const d = session.direTeam.expectedPlayers.find((p) => p.steamId32 === steamId32);
    if (d) return d.nickname;
    return steamId32;
}

// ─── Chat command matching ──────────────────────────────────────────────────

function isReadyCommand(message, readyCommands) {
    const normalized = message.trim().toLowerCase();
    return (readyCommands || []).some((cmd) => normalized === cmd.toLowerCase());
}

function isUnreadyCommand(message, unreadyCommands) {
    const normalized = message.trim().toLowerCase();
    return (unreadyCommands || []).some((cmd) => normalized === cmd.toLowerCase());
}

// ─── Enforcement ────────────────────────────────────────────────────────────

/**
 * Decide which players to kick given the current lobby occupancy.
 * Only "unauthorized" kicks are acted on by the runner; wrong-slot is handled
 * informationally (sides are interchangeable under coin toss). Returns the list
 * of kicks with reasons; the runner executes the not_registered ones.
 */
function evaluateEnforcement(session, players, config, whitelist = []) {
    const action = { kickPlayers: [], chatMessages: [] };
    if (!config) return action;
    const authorized = getAllAuthorizedSteamIds(session, whitelist);

    for (const player of players) {
        const { steamId32, teamSide } = player;
        if (!steamId32 || steamId32 === '0') continue; // bot / empty slot

        const isAuthorized = authorized.has(steamId32);
        const inTeamSlot = teamSide === 'radiant' || teamSide === 'dire';
        const isSpectator = teamSide === 'spectator';
        const isUnassigned = teamSide === 'unassigned';

        if (!isAuthorized && config.autoKickUnauthorized) {
            if (inTeamSlot || isSpectator) {
                action.kickPlayers.push({ steamId32, reason: 'not_registered' });
                action.chatMessages.push(
                    `Player (Steam32: ${steamId32}) is not registered for this match and has been removed.`
                );
                continue;
            }
            if (isUnassigned) {
                action.kickPlayers.push({ steamId32, reason: 'not_registered' });
                continue;
            }
        }
    }
    return action;
}

/**
 * Team-cohesion check used once both teams declare ready: each team's players
 * must all sit on the SAME side (radiant or dire — the side itself is decided by
 * coin toss). Returns the names of teams whose players are split across sides.
 */
function findSplitTeams(session, players) {
    const teams = [
        { ids: new Set(session.radiantTeam.expectedPlayers.map((p) => p.steamId32)), name: session.radiantTeam.teamName },
        { ids: new Set(session.direTeam.expectedPlayers.map((p) => p.steamId32)), name: session.direTeam.teamName },
    ];
    const split = [];
    for (const { ids, name } of teams) {
        const seated = players.filter((p) => ids.has(p.steamId32) && (p.teamSide === 'radiant' || p.teamSide === 'dire'));
        const onRadiant = seated.filter((p) => p.teamSide === 'radiant').length;
        const onDire = seated.filter((p) => p.teamSide === 'dire').length;
        if (onRadiant > 0 && onDire > 0) split.push(name);
    }
    return split;
}

/**
 * The single Dota side ('radiant' | 'dire') that ALL of a team's expected players occupy,
 * or null if not everyone is seated on a team slot yet, or they're split across both sides.
 * Sides are NOT pre-assigned — a team may sit on either side (the coin toss decides), so this
 * is how we both gate the ready-check (team must be cohesive) and learn the team→side mapping.
 */
function teamSeatedSide(teamAssignment, players) {
    const ids = new Set(teamAssignment.expectedPlayers.map((p) => p.steamId32));
    const seated = players.filter((p) => ids.has(p.steamId32) && (p.teamSide === 'radiant' || p.teamSide === 'dire'));
    if (seated.length < teamAssignment.expectedPlayers.length) return null; // not everyone seated
    const sides = new Set(seated.map((p) => p.teamSide));
    if (sides.size !== 1) return null; // split across both sides
    return [...sides][0];
}

/** Count how many of each team's expected players are currently seated/in the lobby. */
function computeTeamPresence(session, lobbyPlayers) {
    const present = new Set((lobbyPlayers ?? session.lastLobbyPlayers ?? []).map((p) => p.steamId32));
    return {
        radiant: session.radiantTeam.expectedPlayers.filter((p) => present.has(p.steamId32)).length,
        dire: session.direTeam.expectedPlayers.filter((p) => present.has(p.steamId32)).length,
    };
}

// ─── Series math ────────────────────────────────────────────────────────────

/** Wins needed to clinch. BO2 is special — both games are always played. */
function getWinsToWin(seriesFormat) {
    switch (seriesFormat) {
        case 'bo1': return 1;
        case 'bo2': return Infinity;
        case 'bo3': return 2;
        case 'bo5': return 3;
        default: return 1;
    }
}

/** Decide whether the series is over, who won, and the running score. */
function calculateSeriesResult(session) {
    const { seriesFormat, totalGames, seriesScore, completedGameIds, radiantTeam, direTeam } = session;
    const winsToWin = getWinsToWin(seriesFormat);
    const radiantWins = seriesScore[radiantTeam.teamId] || 0;
    const direWins = seriesScore[direTeam.teamId] || 0;
    const gamesPlayed = completedGameIds.length;

    const result = {
        decided: false, winnerId: null, isDraw: false,
        score: { ...seriesScore }, gamesPlayed, maxGames: totalGames, winsToWin,
    };

    if (radiantWins >= winsToWin) { result.decided = true; result.winnerId = radiantTeam.teamId; return result; }
    if (direWins >= winsToWin) { result.decided = true; result.winnerId = direTeam.teamId; return result; }

    if (seriesFormat === 'bo2' && gamesPlayed >= 2) {
        result.decided = true;
        if (radiantWins > direWins) result.winnerId = radiantTeam.teamId;
        else if (direWins > radiantWins) result.winnerId = direTeam.teamId;
        else { result.isDraw = true; result.winnerId = null; }
        return result;
    }

    if (gamesPlayed >= totalGames) {
        result.decided = true;
        if (radiantWins > direWins) result.winnerId = radiantTeam.teamId;
        else if (direWins > radiantWins) result.winnerId = direTeam.teamId;
        else result.isDraw = true;
        return result;
    }

    return result; // not decided — more games to play
}

/** Next game number (1-indexed) or null if the series is complete. */
function getNextGameNumber(session) {
    const result = calculateSeriesResult(session);
    if (result.decided) return null;
    return session.completedGameIds.length + 1;
}

/** "Team Alpha 2 - 1 Team Beta" */
function formatSeriesScore(session) {
    const r = session.seriesScore[session.radiantTeam.teamId] || 0;
    const d = session.seriesScore[session.direTeam.teamId] || 0;
    return `${session.radiantTeam.teamName} ${r} - ${d} ${session.direTeam.teamName}`;
}

// ─── Chat message templating ────────────────────────────────────────────────

/** Merge per-bot personality overrides on top of the tournament chat defaults. */
function getEffectiveChatMessages(botConfig, botAccountId) {
    const overrides = botConfig?.perBotMessages?.[botAccountId];
    if (!overrides) return botConfig?.chatMessages || {};
    return { ...botConfig.chatMessages, ...overrides };
}

/** Replace {player_name}/{team_name}/{missing}; leaves unknown tokens intact. */
function applyPlaceholders(message, ctx) {
    return (message || '')
        .replace(/\{player_name\}/g, ctx.player_name ?? '')
        .replace(/\{team_name\}/g, ctx.team_name ?? '')
        .replace(/\{missing\}/g, ctx.missing ?? '');
}

/** Replace {token} from ctx; unknown tokens are left intact (late-arrival templates). */
function applyLatePlaceholders(tmpl, ctx) {
    return (tmpl || '').replace(/\{(\w+)\}/g, (_m, k) => (ctx[k] !== undefined ? ctx[k] : `{${k}}`));
}

module.exports = {
    DOTA_GAME_MODE_IDS,
    DOTA_SERVER_REGION_IDS,
    toLobbyCreateSettings,
    getAllAuthorizedSteamIds,
    getExpectedTeamSide,
    identifyPlayerTeam,
    getPlayerNickname,
    isReadyCommand,
    isUnreadyCommand,
    evaluateEnforcement,
    findSplitTeams,
    teamSeatedSide,
    computeTeamPresence,
    calculateSeriesResult,
    getNextGameNumber,
    formatSeriesScore,
    getEffectiveChatMessages,
    applyPlaceholders,
    applyLatePlaceholders,
};
