"use strict";
// bot-worker/dist/scheduling.js
// Match scheduling for the Conductor — ported from the old Next.js orchestrator
// (src/app/api/admin/bot/orchestrate/route.ts scheduleUpcomingMatches +
//  src/lib/bot/bot-config-actions.ts buildLobbyTeamAssignments / scheduleLobbyForMatch).
//
// In the rebuild, the Conductor owns scheduling: it watches each bot-enabled
// tournament's matches and creates ONE botLobbySessions doc per match when the match
// enters the pre-warm window. Unlike the old code, a single session now owns the WHOLE
// series (the Runner advances currentGameNumber in-process), so we create one session
// per match, not one per game.
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require('crypto');
const { logger } = require('./logger.js');

function nowIso() { return new Date().toISOString(); }

/** Random, ambiguity-free alphanumeric lobby password (mirror of bot-config-actions). */
function generateLobbyPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 8; i++) p += chars.charAt(crypto.randomInt(0, chars.length));
    return p;
}

function seriesTotals(seriesFormat) {
    const fmt = seriesFormat || 'bo1';
    const totalGames = fmt === 'bo1' ? 1 : fmt === 'bo2' ? 2 : fmt === 'bo3' ? 3 : fmt === 'bo5' ? 5 : 1;
    // Dota 2 lobby series_type: bo1→0 (none), bo2/bo3→1 (BO3), bo5→2 (BO5).
    const lobbySeriesType = fmt === 'bo5' ? 2 : fmt === 'bo1' ? 0 : 1;
    return { fmt, totalGames, lobbySeriesType };
}

/** Registered roster as raw { id, steamId32, nickname } entries (no standins applied). */
function buildBasePlayers(team) {
    return (team.players && team.players.length)
        ? team.players.map((p) => ({ id: p.id, steamId32: p.steamId32 || '', nickname: p.nickname }))
        : Object.entries(team.roster || {}).map(([steamId64, p]) => ({ id: steamId64, steamId32: p.steamId32 || '', nickname: p.nickname }));
}

/**
 * Flat list of approved standins for a match, each tagged with the games it covers.
 * approvedStandins: { reqId: { teamId, replacedPlayerId, steamId32, nickname, gameNumbers? } }
 * gameNumbers omitted/empty = whole series.
 */
function buildStandinAssignments(match) {
    const approvedStandins = match.approvedStandins || {};
    return Object.values(approvedStandins).map((req) => ({
        teamId: req.teamId,
        replacedPlayerId: req.replacedPlayerId,
        steamId32: req.steamId32,
        nickname: req.nickname,
        gameNumbers: Array.isArray(req.gameNumbers) ? req.gameNumbers : [],
    }));
}

/**
 * Effective LobbyExpectedPlayer[] for one team in one game: the registered roster with any
 * standin whose game scope covers `gameNumber` swapped in, then filtered to valid steamId32.
 * A standin with an empty gameNumbers list applies to every game (whole-series, legacy).
 */
function buildExpectedPlayersForGame(basePlayers, standinAssignments, teamId, gameNumber) {
    const teamStandins = {};
    for (const s of (standinAssignments || [])) {
        if (s.teamId !== teamId) continue;
        const covers = !s.gameNumbers || s.gameNumbers.length === 0 || s.gameNumbers.includes(gameNumber);
        if (!covers) continue;
        teamStandins[s.replacedPlayerId] = { steamId32: s.steamId32, nickname: s.nickname };
    }
    return (basePlayers || [])
        .filter((p) => {
            // Keep the player only if the final entry has a valid steamId32: either a standin
            // covering this game replaces them, or they have one themselves.
            const standin = teamStandins[p.id];
            return standin ? !!standin.steamId32 : !!p.steamId32;
        })
        .map((player) => {
            const standin = teamStandins[player.id];
            if (standin) {
                return {
                    steamId32: standin.steamId32, nickname: standin.nickname,
                    isStandin: true, replacesPlayerId: player.id, replacesPlayerNickname: player.nickname,
                };
            }
            return { steamId32: player.steamId32, nickname: player.nickname, isStandin: false };
        });
}

/**
 * Build Radiant/Dire team assignments (rosters + approved standins) for a match and a
 * specific game of the series. Supports both the players[] array (PDL) and the roster{} map.
 * Returns { radiant, dire, match, baseRadiantPlayers, baseDirePlayers, standinAssignments }
 * or null if the match/teams can't be read. The base rosters + standinAssignments let the
 * runner recompute the effective roster for any game without re-reading the match doc.
 */
async function buildLobbyTeamAssignments(db, tournamentId, matchId, gameNumber = 1) {
    const matchDoc = await db.collection('tournaments').doc(tournamentId).collection('matches').doc(matchId).get();
    if (!matchDoc.exists) return null;
    const match = matchDoc.data();
    if (!match.teamA?.id || !match.teamB?.id) return null;

    const [teamADoc, teamBDoc] = await Promise.all([
        db.collection('tournaments').doc(tournamentId).collection('teams').doc(match.teamA.id).get(),
        db.collection('tournaments').doc(tournamentId).collection('teams').doc(match.teamB.id).get(),
    ]);
    if (!teamADoc.exists || !teamBDoc.exists) return null;
    const teamA = teamADoc.data();
    const teamB = teamBDoc.data();

    const baseRadiantPlayers = buildBasePlayers(teamA);
    const baseDirePlayers = buildBasePlayers(teamB);
    const standinAssignments = buildStandinAssignments(match);

    const radiant = {
        teamId: match.teamA.id, teamName: match.teamA.name,
        expectedPlayers: buildExpectedPlayersForGame(baseRadiantPlayers, standinAssignments, match.teamA.id, gameNumber),
        coachNickname: teamA.coach?.nickname,
    };
    const dire = {
        teamId: match.teamB.id, teamName: match.teamB.name,
        expectedPlayers: buildExpectedPlayersForGame(baseDirePlayers, standinAssignments, match.teamB.id, gameNumber),
        coachNickname: teamB.coach?.nickname,
    };
    if (match.coachInfo) {
        if (match.coachInfo[match.teamA.id]) radiant.coachNickname = match.coachInfo[match.teamA.id].nickname;
        if (match.coachInfo[match.teamB.id]) dire.coachNickname = match.coachInfo[match.teamB.id].nickname;
    }
    return { radiant, dire, match, baseRadiantPlayers, baseDirePlayers, standinAssignments };
}

/** Does the match already have a non-terminal session? */
async function hasActiveSession(db, matchId) {
    const snap = await db.collection('botLobbySessions').where('matchId', '==', matchId).get();
    return snap.docs.some((d) => !['completed', 'cancelled', 'error'].includes(d.data().state));
}

/**
 * Create pending lobby sessions for all matches of a tournament that are inside the
 * pre-warm window. Returns the number of sessions created.
 */
async function scheduleUpcomingMatches(db, tournamentId, botConfig, tournamentDoc) {
    if (!botConfig?.enabled) return 0;
    const leadMs = (botConfig.lobbyCreationLeadMinutes || 10) * 60 * 1000;
    const ts = Date.now();
    const windowEnd = ts + leadMs;

    const matchesSnap = await db.collection('tournaments').doc(tournamentId).collection('matches')
        .where('status', 'in', ['scheduled', 'upcoming', 'pending']).get();
    if (matchesSnap.empty) return 0;

    const lobbyPrefix = tournamentDoc?.lobbySettings?.leagueName || tournamentDoc?.name || 'Tournament';
    let created = 0;

    for (const matchDoc of matchesSnap.docs) {
        const match = matchDoc.data();
        const matchTime = match.scheduledFor ? new Date(match.scheduledFor).getTime() : null;
        // Skip: no time, too far out, or more than 30 min past.
        if (!matchTime || matchTime > windowEnd || matchTime < ts - 30 * 60 * 1000) continue;
        // Skip decided/completed matches.
        if (match.winnerId != null || match.status === 'completed') continue;
        // One series = one session: skip if any active session already exists.
        if (await hasActiveSession(db, matchDoc.id)) continue;

        const assignments = await buildLobbyTeamAssignments(db, tournamentId, matchDoc.id);
        if (!assignments) { logger.warn(`[Scheduling] Could not build assignments for match ${matchDoc.id}`); continue; }

        // Mirror the fallback used in admin-match-actions-server.ts: group matches default
        // to BO2, playoff matches to BO3. The plain 'bo1' fallback in seriesTotals() is wrong
        // for tournaments where series_format is not explicitly stored on the match doc.
        const resolvedFormat = match.series_format || (match.group_id ? 'bo2' : 'bo3');
        const { fmt, totalGames, lobbySeriesType } = seriesTotals(resolvedFormat);
        const lobbyName = `${lobbyPrefix} - ${match.teamA?.name || 'TBA'} vs ${match.teamB?.name || 'TBA'}`;
        // Use the admin-configured fixed password if set, otherwise generate a random one.
        const fixedPassword = (botConfig.lobby?.password || '').trim();

        const session = {
            matchId: matchDoc.id,
            tournamentId,
            botAccountId: '',
            state: 'pending',
            lobbyName,
            lobbyPassword: fixedPassword || generateLobbyPassword(),
            radiantTeam: assignments.radiant,
            direTeam: assignments.dire,
            // Per-game roster source: registered rosters (no standins) + standin scopes.
            // The runner recomputes radiantTeam/direTeam.expectedPlayers from these for each
            // game so a standin can be limited to specific games of the series.
            baseRadiantPlayers: assignments.baseRadiantPlayers,
            baseDirePlayers: assignments.baseDirePlayers,
            standinAssignments: assignments.standinAssignments,
            readyState: { radiantReady: false, direReady: false },
            validationErrors: [],
            seriesFormat: fmt,
            currentGameNumber: 1,
            totalGames,
            seriesScore: { [assignments.radiant.teamId]: 0, [assignments.dire.teamId]: 0 },
            completedGameIds: [],
            completedGameWinners: [],
            lobbySeriesType,
            lobbyRadiantWins: 0,
            lobbyDireWins: 0,
            scheduledMatchTime: match.scheduledFor,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };

        const ref = await db.collection('botLobbySessions').add(session);
        created++;
        logger.info(`[Scheduling] Created session ${ref.id} for match ${matchDoc.id} (${session.lobbyName}, ${fmt})`);
    }
    return created;
}

module.exports = {
    generateLobbyPassword,
    seriesTotals,
    buildBasePlayers,
    buildStandinAssignments,
    buildExpectedPlayersForGame,
    buildLobbyTeamAssignments,
    hasActiveSession,
    scheduleUpcomingMatches,
};
