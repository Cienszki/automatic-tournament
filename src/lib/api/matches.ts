// src/lib/api/matches.ts
// Data access functions for tournament matches.

import {
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
} from 'firebase/firestore';
import { tournamentRefs } from './paths';
import type { Match } from '@/lib/definitions';

/** Options for filtering the matches list */
interface GetMatchesOptions {
  /** Filter by status. */
  status?: 'scheduled' | 'completed' | 'live';
  /** Filter by division. */
  divisionId?: string;
  /** Filter by round number. */
  round?: number;
  /** Filter matches involving a specific team ID. */
  teamId?: string;
  /** Order by field. Default: 'scheduledFor'. */
  orderByField?: string;
}

/**
 * Fetch all matches for a tournament, with optional filtering.
 */
export async function getTournamentMatches(
  tournamentId: string,
  options: GetMatchesOptions = {}
): Promise<Match[]> {
  const refs = tournamentRefs(tournamentId);
  const constraints: QueryConstraint[] = [];

  if (options.status) {
    constraints.push(where('status', '==', options.status));
  }
  if (options.divisionId) {
    constraints.push(where('divisionId', '==', options.divisionId));
  }
  if (options.round !== undefined) {
    constraints.push(where('round', '==', options.round));
  }
  if (options.teamId) {
    constraints.push(where('teams', 'array-contains', options.teamId));
  }
  if (options.orderByField) {
    constraints.push(orderBy(options.orderByField));
  }

  const q = constraints.length > 0
    ? query(refs.matches(), ...constraints)
    : refs.matches();

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Match[];
}

/**
 * Fetch a single match by ID.
 * Returns null if the match doesn't exist.
 */
export async function getMatchById(
  tournamentId: string,
  matchId: string
): Promise<Match | null> {
  const refs = tournamentRefs(tournamentId);
  const snap = await getDoc(refs.match(matchId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Match;
}

/**
 * Update fields on a match document.
 */
export async function updateMatch(
  tournamentId: string,
  matchId: string,
  data: Partial<Omit<Match, 'id'>>
): Promise<void> {
  const refs = tournamentRefs(tournamentId);
  await updateDoc(refs.match(matchId), data);
}

/**
 * Get all completed matches for a team across a tournament.
 * Useful for stats and match history pages.
 */
export async function getTeamCompletedMatches(
  tournamentId: string,
  teamId: string
): Promise<Match[]> {
  return getTournamentMatches(tournamentId, {
    teamId,
    status: 'completed',
  });
}
