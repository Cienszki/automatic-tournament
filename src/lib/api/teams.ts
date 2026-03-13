// src/lib/api/teams.ts
// Data access functions for tournament teams.
// Wraps Firestore calls so consumers never import firebase/firestore directly.

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
import type { Team } from '@/lib/definitions';

/** Options for filtering the teams list */
interface GetTeamsOptions {
  /** Only return teams with this status (e.g. 'verified'). */
  status?: string;
  /** Only return teams in this division. */
  divisionId?: string;
  /** Order by field. Default: 'name'. */
  orderByField?: string;
}

/**
 * Fetch all teams for a tournament, with optional filtering.
 */
export async function getTournamentTeams(
  tournamentId: string,
  options: GetTeamsOptions = {}
): Promise<Team[]> {
  const refs = tournamentRefs(tournamentId);
  const constraints: QueryConstraint[] = [];

  if (options.status) {
    constraints.push(where('status', '==', options.status));
  }
  if (options.divisionId) {
    constraints.push(where('divisionId', '==', options.divisionId));
  }
  if (options.orderByField) {
    constraints.push(orderBy(options.orderByField));
  }

  const q = constraints.length > 0
    ? query(refs.teams(), ...constraints)
    : refs.teams();

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Team[];
}

/**
 * Fetch a single team by ID.
 * Returns null if the team doesn't exist.
 */
export async function getTeamById(
  tournamentId: string,
  teamId: string
): Promise<Team | null> {
  const refs = tournamentRefs(tournamentId);
  const snap = await getDoc(refs.team(teamId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Team;
}

/**
 * Update fields on a team document.
 */
export async function updateTeam(
  tournamentId: string,
  teamId: string,
  data: Partial<Omit<Team, 'id'>>
): Promise<void> {
  const refs = tournamentRefs(tournamentId);
  await updateDoc(refs.team(teamId), data);
}

/**
 * Find a team where the given user is captain.
 * Returns null if the user isn't a captain of any team.
 */
export async function getTeamByCaptain(
  tournamentId: string,
  userId: string
): Promise<Team | null> {
  const refs = tournamentRefs(tournamentId);
  const q = query(refs.teams(), where('captainId', '==', userId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Team;
}
