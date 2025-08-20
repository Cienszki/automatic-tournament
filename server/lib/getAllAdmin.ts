import { getAdminDb } from './admin';
import type { Team, TournamentPlayer, Group } from '../../src/lib/definitions';

export async function getAllTeamsAdmin(): Promise<Team[]> {
  const db = getAdminDb();
  const teamsCollection = db.collection('teams');
  const teamsSnapshot = await teamsCollection.get();
  const teams = await Promise.all(teamsSnapshot.docs.map(async (d) => {
    const teamData = d.data();
    const playersCollection = db.collection('teams').doc(d.id).collection('players');
    const playersSnapshot = await playersCollection.get();
    const players = playersSnapshot.docs.map(playerDoc => ({
      ...playerDoc.data(),
      id: playerDoc.id
    }));
    return {
      id: d.id,
      ...teamData,
      players,
    } as Team;
  }));
  return teams;
}

export async function getAllTournamentPlayersAdmin(): Promise<TournamentPlayer[]> {
  const teams = await getAllTeamsAdmin();
  return teams.flatMap(team =>
    (team.players || []).map(player => ({
      ...player,
      teamId: team.id,
      teamName: team.name,
      teamTag: team.tag
    }))
  );
}

export async function getAllGroupsAdmin(): Promise<Group[]> {
  const db = getAdminDb();
  const groupsCollection = db.collection('groups');
  const groupsSnapshot = await groupsCollection.get();
  return groupsSnapshot.docs.map(d => ({
    id: d.id,
    ...d.data(),
  }) as Group);
}
