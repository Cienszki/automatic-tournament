// src/lib/bot/standin-roster.ts
// Pure, synchronous helpers for building a lobby's per-game effective roster from the
// registered rosters + approved standins. Kept OUT of bot-config-actions.ts because that
// file is "use server" (every export there must be async). The bot worker has an identical
// copy in bot-worker/dist/scheduling.js — the two MUST stay in sync.

import type { Team, Match } from '@/lib/definitions';
import type { LobbyExpectedPlayer } from '@/types/lobby-bot';

/** A standin tagged with the games of the series it covers (empty = whole series). */
export interface StandinAssignment {
  teamId: string;
  replacedPlayerId: string;
  steamId32: string;
  nickname: string;
  gameNumbers: number[];
}

/** Registered roster as raw { id, steamId32, nickname } entries (no standins applied). */
export function buildBasePlayers(
  team: Team
): { id: string; steamId32: string; nickname: string }[] {
  return team.players?.length
    ? team.players.map((p) => ({ id: p.id, steamId32: p.steamId32 || '', nickname: p.nickname }))
    : Object.entries(team.roster ?? {}).map(([steamId64, p]) => ({
        id: steamId64,
        steamId32: p.steamId32 || '',
        nickname: p.nickname,
      }));
}

/** Flat list of approved standins for a match, each tagged with the games it covers. */
export function buildStandinAssignments(match: Match): StandinAssignment[] {
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
 * MUST stay in sync with the copy in bot-worker/dist/scheduling.js.
 */
export function buildExpectedPlayersForGame(
  basePlayers: { id: string; steamId32: string; nickname: string }[],
  standinAssignments: StandinAssignment[],
  teamId: string,
  gameNumber: number
): LobbyExpectedPlayer[] {
  const teamStandins: Record<string, { steamId32: string; nickname: string }> = {};
  for (const s of standinAssignments || []) {
    if (s.teamId !== teamId) continue;
    const covers = !s.gameNumbers || s.gameNumbers.length === 0 || s.gameNumbers.includes(gameNumber);
    if (!covers) continue;
    teamStandins[s.replacedPlayerId] = { steamId32: s.steamId32, nickname: s.nickname };
  }
  return (basePlayers || [])
    .filter((player) => {
      const standin = teamStandins[player.id];
      return standin ? !!standin.steamId32 : !!player.steamId32;
    })
    .map((player) => {
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
      return { steamId32: player.steamId32, nickname: player.nickname, isStandin: false };
    });
}
