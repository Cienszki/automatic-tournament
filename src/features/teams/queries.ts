// Reads of a tournament's teams (server only). `listTeams` takes the database handle, so tests run
// it on PGlite; pages call the cached `getTeamList`.

import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { cachedQuery, tournamentTags } from '@/platform/cache';
import { getDb, groupTeams, groups, scoped, stages, teamMembers, teams, type Db } from '@/platform/db';
import { buildTeamList, type TeamListItem } from './domain/team-list';

/** The public team list: three statements, whatever the number of teams. */
export async function listTeams(db: Db, tournamentId: string): Promise<TeamListItem[]> {
  const t = scoped(db, tournamentId);
  const [teamRows, memberRows, groupRows] = await Promise.all([
    t.select({ id: teams.id, name: teams.name, tag: teams.tag, logoUrl: teams.logoUrl, status: teams.status })
      .from(teams),
    t.select({ teamId: teamMembers.teamId, nickname: teamMembers.nickname, kind: teamMembers.kind, position: teamMembers.position })
      .from(teamMembers, isNull(teamMembers.leftAt)),
    t.select({ teamId: groupTeams.teamId, groupName: groups.name, stagePosition: stages.position, groupPosition: groups.position })
      .from(groupTeams)
      .innerJoin(groups, and(t.own(groups), eq(groups.id, groupTeams.groupId)))
      .innerJoin(stages, and(t.own(stages), eq(stages.id, groups.stageId)))
      .orderBy(asc(stages.position)),
  ]);
  return buildTeamList(teamRows, memberRows, groupRows);
}

export const getTeamList = cachedQuery(
  (tournamentId: string) => listTeams(getDb(), tournamentId),
  { name: 'teams.list', tags: (tournamentId) => tournamentTags(tournamentId, 'teams') },
);
