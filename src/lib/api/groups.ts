// src/lib/api/groups.ts
// Data access functions for tournament groups (MMR-limited tournaments).

import {
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
} from 'firebase/firestore';
import { tournamentRefs } from './paths';
import type { Group, GroupStanding } from '@/lib/definitions';

/** Group document shape as stored in Firestore */
export interface GroupDoc {
  id: string;
  name: string;
  order: number; // Display order (1-based)
}

/**
 * Fetch all groups for a tournament.
 */
export async function getGroups(tournamentId: string): Promise<GroupDoc[]> {
  const refs = tournamentRefs(tournamentId);
  const snapshot = await getDocs(refs.groups());
  const groups = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as GroupDoc[];
  return groups.sort((a, b) => a.order - b.order);
}

/**
 * Fetch a single group by ID.
 */
export async function getGroupById(
  tournamentId: string,
  groupId: string,
): Promise<GroupDoc | null> {
  const refs = tournamentRefs(tournamentId);
  const snap = await getDoc(refs.group(groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as GroupDoc;
}

/**
 * Create or overwrite a group document.
 */
export async function saveGroup(
  tournamentId: string,
  group: GroupDoc,
): Promise<void> {
  const refs = tournamentRefs(tournamentId);
  await setDoc(refs.group(group.id), {
    name: group.name,
    order: group.order,
  });
}

/**
 * Delete a group document.
 */
export async function deleteGroup(
  tournamentId: string,
  groupId: string,
): Promise<void> {
  const refs = tournamentRefs(tournamentId);
  await deleteDoc(refs.group(groupId));
}

/**
 * Assign a team to a group by updating the team's `groupId` field.
 */
export async function assignTeamToGroup(
  tournamentId: string,
  teamId: string,
  groupId: string | null,
): Promise<void> {
  const refs = tournamentRefs(tournamentId);
  await updateDoc(refs.team(teamId), { groupId: groupId });
}

/** Minimal match shape needed for standings calculation */
export interface MatchForStandings {
  status: string;
  teamA?: { id: string; name?: string; score?: number };
  teamB?: { id: string; name?: string; score?: number };
}

/** Minimal team shape needed for standings calculation */
export interface TeamForStandings {
  id: string;
  name: string;
  logoUrl?: string;
  groupId?: string;
  players?: Array<{ mmr?: number }>;
}

/**
 * Calculate hydrated Group objects with standings from raw groups, teams, and matches.
 * This is a pure function — no Firestore calls.
 */
export function calculateGroupStandings(
  groupDocs: GroupDoc[],
  teams: TeamForStandings[],
  matches: MatchForStandings[],
): Group[] {
  const teamsMap = new Map(teams.map(t => [t.id, t]));

  // Initialize standings for every team
  const standingsMap = new Map<string, GroupStanding>();
  const initStanding = (teamId: string, team: TeamForStandings): GroupStanding => ({
    teamId,
    teamName: team.name,
    teamLogoUrl: team.logoUrl || '',
    matchesPlayed: 0,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    headToHead: {},
    neustadtlScore: 0,
    status: 'updated',
    totalMMR: (team.players || []).reduce((s, p) => s + (p.mmr || 0), 0),
  });

  // Process completed matches
  for (const m of matches) {
    if (m.status !== 'completed') continue;
    const aId = m.teamA?.id;
    const bId = m.teamB?.id;
    if (!aId || !bId) continue;

    const teamA = teamsMap.get(aId);
    const teamB = teamsMap.get(bId);
    if (!teamA || !teamB) continue;

    if (!standingsMap.has(aId)) standingsMap.set(aId, initStanding(aId, teamA));
    if (!standingsMap.has(bId)) standingsMap.set(bId, initStanding(bId, teamB));

    const sA = standingsMap.get(aId)!;
    const sB = standingsMap.get(bId)!;
    sA.matchesPlayed++;
    sB.matchesPlayed++;

    const scoreA = m.teamA?.score ?? 0;
    const scoreB = m.teamB?.score ?? 0;
    if (scoreA > scoreB) {
      sA.wins++; sA.points += 2; sB.losses++;
      sA.headToHead[bId] = 'win'; sB.headToHead[aId] = 'loss';
    } else if (scoreB > scoreA) {
      sB.wins++; sB.points += 2; sA.losses++;
      sB.headToHead[aId] = 'win'; sA.headToHead[bId] = 'loss';
    } else {
      sA.draws++; sA.points++; sB.draws++; sB.points++;
      sA.headToHead[bId] = 'draw'; sB.headToHead[aId] = 'draw';
    }
  }

  return groupDocs.map(gd => {
    // Teams assigned to this group
    const groupTeamIds = teams.filter(t => t.groupId === gd.id).map(t => t.id);

    const standings: { [teamId: string]: GroupStanding } = {};
    for (const teamId of groupTeamIds) {
      const team = teamsMap.get(teamId);
      if (!team) continue;
      standings[teamId] = standingsMap.get(teamId) || initStanding(teamId, team);
    }

    // Calculate Neustadtl scores within the group
    const vals = Object.values(standings);
    for (const standing of vals) {
      let neustadtl = 0;
      if (standing.headToHead) {
        for (const [oppId, result] of Object.entries(standing.headToHead)) {
          const oppPoints = standings[oppId]?.points || 0;
          if (result === 'win') neustadtl += oppPoints;
          else if (result === 'draw') neustadtl += oppPoints * 0.5;
        }
      }
      standing.neustadtlScore = neustadtl;
    }

    return { id: gd.id, name: gd.name, standings };
  });
}

/** Result returned by generateGroupMatches */
export interface GenerateGroupMatchesResult {
  created: number;
  skipped: number;
}

/**
 * Generate all round-robin matches for a group.
 * Matches are created with schedulingStatus='unscheduled' so captains
 * can propose their own times up to the deadline.
 *
 * @param tournamentId - Tournament ID
 * @param groupId      - Group ID to generate matches for
 * @param deadline     - Match deadline; used as the default scheduledFor time
 */
export async function generateGroupMatches(
  tournamentId: string,
  groupId: string,
  deadline: Date,
): Promise<GenerateGroupMatchesResult> {
  const refs = tournamentRefs(tournamentId);

  // Fetch all teams in this group
  // DivisionsTab stores the group/division assignment in 'divisionId'
  const teamsSnap = await getDocs(query(refs.teams(), where('divisionId', '==', groupId)));
  const teams = teamsSnap.docs.map((d) => {
    const td = d.data();
    return {
      id: d.id,
      name: td.name as string,
      tag: (td.tag as string) || '',
      logoUrl: (td.logoUrl as string) || '',
    };
  });

  if (teams.length < 2) {
    return { created: 0, skipped: 0 };
  }

  // Fetch existing matches for this group to skip already-created pairs
  const existingSnap = await getDocs(query(refs.matches(), where('group_id', '==', groupId)));
  const existingPairs = new Set(
    existingSnap.docs.map((d) => {
      const md = d.data();
      return (md.teams as string[]).slice().sort().join('-');
    }),
  );

  // Set deadline time to 23:59:59 on the provided day
  const deadlineEnd = new Date(deadline);
  deadlineEnd.setHours(23, 59, 59, 0);

  let created = 0;
  let skipped = 0;

  // Generate all round-robin pairs
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i];
      const teamB = teams[j];
      const pairKey = [teamA.id, teamB.id].sort().join('-');

      if (existingPairs.has(pairKey)) {
        skipped++;
        continue;
      }

      await addDoc(refs.matches(), {
        teamA: { id: teamA.id, name: teamA.name, score: 0, logoUrl: teamA.logoUrl },
        teamB: { id: teamB.id, name: teamB.name, score: 0, logoUrl: teamB.logoUrl },
        teams: [teamA.id, teamB.id],
        status: 'pending',
        scheduledFor: '',
        deadline: deadlineEnd.toISOString(),
        group_id: groupId,
        schedulingStatus: 'unscheduled',
        series_format: 'bo2',
        bestOf: 2,
        winnerId: null,
        completed_at: null,
      });
      created++;
    }
  }

  return { created, skipped };
}
