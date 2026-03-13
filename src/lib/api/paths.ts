// src/lib/api/paths.ts
// Centralized Firestore collection and document reference helpers.
// All tournament-scoped paths go through here so collection names
// are defined in exactly one place.

import { collection, doc, CollectionReference, DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Helper that returns typed Firestore collection/document references
 * scoped to a given tournament.
 *
 * @example
 * ```ts
 * const refs = tournamentRefs('pdl-s1');
 * const teamsCol = refs.teams();
 * const teamDoc = refs.team('abc');
 * ```
 */
export function tournamentRefs(tournamentId: string) {
  const root = () => doc(db, 'tournaments', tournamentId);

  return {
    /** tournaments/{id} */
    root,

    // ── Teams ──────────────────────────────────────────
    /** tournaments/{id}/teams */
    teams: (): CollectionReference => collection(db, 'tournaments', tournamentId, 'teams'),
    /** tournaments/{id}/teams/{teamId} */
    team: (teamId: string): DocumentReference => doc(db, 'tournaments', tournamentId, 'teams', teamId),
    /** tournaments/{id}/teams/{teamId}/players */
    teamPlayers: (teamId: string): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'teams', teamId, 'players'),
    /** tournaments/{id}/teams/{teamId}/players/{playerId} */
    teamPlayer: (teamId: string, playerId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'teams', teamId, 'players', playerId),

    // ── Matches ────────────────────────────────────────
    /** tournaments/{id}/matches */
    matches: (): CollectionReference => collection(db, 'tournaments', tournamentId, 'matches'),
    /** tournaments/{id}/matches/{matchId} */
    match: (matchId: string): DocumentReference => doc(db, 'tournaments', tournamentId, 'matches', matchId),
    /** tournaments/{id}/matches/{matchId}/games */
    matchGames: (matchId: string): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'matches', matchId, 'games'),
    /** tournaments/{id}/matches/{matchId}/games/{gameId} */
    matchGame: (matchId: string, gameId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'matches', matchId, 'games', gameId),
    /** tournaments/{id}/matches/{matchId}/games/{gameId}/performances */
    gamePerformances: (matchId: string, gameId: string): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'matches', matchId, 'games', gameId, 'performances'),

    // ── Divisions ──────────────────────────────────────
    /** tournaments/{id}/divisions */
    divisions: (): CollectionReference => collection(db, 'tournaments', tournamentId, 'divisions'),
    /** tournaments/{id}/divisions/{divisionId} */
    division: (divisionId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'divisions', divisionId),

    // ── Announcements ──────────────────────────────────
    /** tournaments/{id}/announcements */
    announcements: (): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'announcements'),
    /** tournaments/{id}/announcements/{announcementId} */
    announcement: (announcementId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'announcements', announcementId),

    // ── Standings ──────────────────────────────────────
    /** tournaments/{id}/standings */
    standings: (): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'standings'),

    // ── Standin Requests ───────────────────────────────
    /** tournaments/{id}/standinRequests */
    standinRequests: (): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'standinRequests'),
    /** tournaments/{id}/standinRequests/{requestId} */
    standinRequest: (requestId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'standinRequests', requestId),

    // ── Rules ──────────────────────────────────────────
    /** tournaments/{id}/rules */
    rules: (): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'rules'),
    /** tournaments/{id}/rules/{ruleId}/paragraphs */
    ruleParagraphs: (ruleId: string): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'rules', ruleId, 'paragraphs'),

    // ── Playoff Matches ────────────────────────────────
    /** tournaments/{id}/playoff_matches */
    playoffMatches: (): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'playoff_matches'),
    /** tournaments/{id}/playoff_matches/{matchId} */
    playoffMatch: (matchId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'playoff_matches', matchId),

    // ── Fantasy ────────────────────────────────────────
    /** tournaments/{id}/fantasyLineups/{userId} */
    fantasyLineup: (userId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'fantasyLineups', userId),

    // ── Pick'em ────────────────────────────────────────
    /** tournaments/{id}/pickems/{userId} */
    pickem: (userId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'pickems', userId),

    // ── Stats ─────────────────────────────────────────
    /** tournaments/{id}/stats/players/{playerId} */
    playerStats: (playerId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'stats', 'players', playerId),
    /** tournaments/{id}/stats/teams/{teamId} */
    teamStats: (teamId: string): DocumentReference =>
      doc(db, 'tournaments', tournamentId, 'stats', 'teams', teamId),

    // ── Commentators ──────────────────────────────────
    /** tournaments/{id}/commentators */
    commentators: (): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'commentators'),
    /** tournaments/{id}/commentatorRequests */
    commentatorRequests: (): CollectionReference =>
      collection(db, 'tournaments', tournamentId, 'commentatorRequests'),

    // ── Admins ────────────────────────────────────────
    /** admins/{tournamentId}/{userId} */
    admin: (userId: string): DocumentReference =>
      doc(db, 'admins', tournamentId, userId),
  } as const;
}

// ── Platform-level references ─────────────────────────

/** /users/{userId} */
export function userRef(userId: string): DocumentReference {
  return doc(db, 'users', userId);
}

/** /users collection */
export function usersCollection(): CollectionReference {
  return collection(db, 'users');
}

/** /superAdmins/{userId} */
export function superAdminRef(userId: string): DocumentReference {
  return doc(db, 'superAdmins', userId);
}

/** /tournaments collection (platform-wide) */
export function tournamentsCollection(): CollectionReference {
  return collection(db, 'tournaments');
}
