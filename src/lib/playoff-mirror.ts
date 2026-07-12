/**
 * playoff-mirror.ts
 *
 * Builds the "mirror" document that lives in `tournaments/{id}/matches` for a playoff bracket
 * match. The mirror shares the SAME doc id as the `playoff_matches` doc, so the whole existing
 * match lifecycle (lobby bot, result sync, stats, rankings, fantasy, schedule) treats a playoff
 * match exactly like a group match, and standin requests keyed by the playoff id keep resolving.
 *
 * Pure object builders — no Firestore — so both the client (firebase/firestore) and the server
 * (firebase-admin) can persist the result with their own SDK.
 */

import type { PlayoffMatch } from './definitions';
import { isByeMatch } from './playoff-bracket-generator';

const PLAYOFF_FORMAT_TO_BEST_OF: Record<string, number> = { bo1: 1, bo3: 3, bo5: 5 };

/**
 * A playoff match is mirrored only when it is actually playable: not a bye, and both teams are
 * resolved. Later-round matches get their mirror once advancement fills both slots.
 */
export function shouldMirror(pm: PlayoffMatch): boolean {
  return !isByeMatch(pm) && !!pm.teamA?.id && !!pm.teamB?.id;
}

/**
 * Full document for CREATING a new mirror (doc does not exist yet). Includes score/status derived
 * from any existing bracket result, and an unscheduled scheduling state.
 */
export function buildMirrorCreateData(pm: PlayoffMatch): Record<string, unknown> {
  const status: 'scheduled' | 'live' | 'completed' =
    pm.status === 'completed' || pm.status === 'bye'
      ? 'completed'
      : pm.status === 'live'
        ? 'live'
        : 'scheduled';

  const now = new Date().toISOString();
  return {
    teamA: {
      id: pm.teamA?.id ?? '',
      name: pm.teamA?.name ?? 'TBA',
      score: pm.result?.teamAScore ?? 0,
      logoUrl: pm.teamA?.logoUrl ?? '',
    },
    teamB: {
      id: pm.teamB?.id ?? '',
      name: pm.teamB?.name ?? 'TBA',
      score: pm.result?.teamBScore ?? 0,
      logoUrl: pm.teamB?.logoUrl ?? '',
    },
    teams: [pm.teamA?.id, pm.teamB?.id].filter(Boolean),
    status,
    scheduledFor: pm.scheduledFor ?? '',
    schedulingStatus: pm.scheduledFor ? 'confirmed' : 'unscheduled',
    ...(pm.result?.winnerId ? { winnerId: pm.result.winnerId } : {}),
    ...(pm.deadline ? { deadline: pm.deadline } : {}),
    series_format: pm.format,
    bestOf: PLAYOFF_FORMAT_TO_BEST_OF[pm.format] ?? 3,
    isPlayoff: true,
    playoff_match_id: pm.id,
    // Buckets every playoff game under a single "playoffs" fantasy round across all fantasy
    // scoring paths (they key off group_id || roundId || round), so playoff games award points.
    roundId: 'playoffs',
    playoff_round: pm.round,
    ...(pm.code ? { playoffCode: pm.code } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Non-volatile patch for an EXISTING mirror (merge:true). Updates only the team identity, format,
 * deadline and code — deliberately OMITS score / status / scheduledFor / schedulingStatus so a
 * captain-agreed time or an already-synced score is never reset by an admin bracket re-save.
 * Note: teamA/teamB are provided WITHOUT `score`, so merge leaves the existing score untouched.
 */
export function buildMirrorTeamsPatch(pm: PlayoffMatch): Record<string, unknown> {
  return {
    teamA: { id: pm.teamA?.id ?? '', name: pm.teamA?.name ?? 'TBA', logoUrl: pm.teamA?.logoUrl ?? '' },
    teamB: { id: pm.teamB?.id ?? '', name: pm.teamB?.name ?? 'TBA', logoUrl: pm.teamB?.logoUrl ?? '' },
    teams: [pm.teamA?.id, pm.teamB?.id].filter(Boolean),
    ...(pm.deadline ? { deadline: pm.deadline } : {}),
    series_format: pm.format,
    bestOf: PLAYOFF_FORMAT_TO_BEST_OF[pm.format] ?? 3,
    isPlayoff: true,
    playoff_match_id: pm.id,
    ...(pm.code ? { playoffCode: pm.code } : {}),
    updatedAt: new Date().toISOString(),
  };
}
