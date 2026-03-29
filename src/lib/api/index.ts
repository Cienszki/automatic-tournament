// src/lib/api/index.ts
// Barrel export for the data access layer.
// Import from '@/lib/api' instead of using firebase/firestore directly.

export { tournamentRefs, userRef, usersCollection, superAdminRef, tournamentsCollection } from './paths';
export { getTournamentTeams, getTeamById, updateTeam, getTeamByCaptain } from './teams';
export { getTournamentMatches, getMatchById, updateMatch, getTeamCompletedMatches } from './matches';
export { fetchTournaments, fetchTournamentBySlug, createTournament, updateTournamentStatus, isSlugAvailable } from './tournaments';
export { getGroups, getGroupById, saveGroup, deleteGroup, assignTeamToGroup, calculateGroupStandings } from './groups';
export type { GroupDoc, TeamForStandings, MatchForStandings } from './groups';
