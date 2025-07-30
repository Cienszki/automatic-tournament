
import { GroupTable } from "@/components/app/GroupTable";
import { Card, CardContent } from "@/components/ui/card";
import { getAllGroups, getAllTeams } from "@/lib/firestore";
import type { Group, Team, GroupStanding } from "@/lib/definitions";
import { AlertTriangle, Users } from "lucide-react";
import { unstable_noStore as noStore } from 'next/cache';

async function getHydratedGroupsData(): Promise<Group[]> {
  noStore();
  
  const [groups, teams] = await Promise.all([
    getAllGroups(),
    getAllTeams()
  ]);

  const teamsMap = new Map(teams.map(team => [team.id, team]));

  const hydratedGroups = groups.map(group => {
    const hydratedStandings: { [teamId: string]: GroupStanding } = {};
    
    for (const teamId in group.standings) {
      const team = teamsMap.get(teamId);
      if (team) {
        const standing = group.standings[teamId];
        hydratedStandings[teamId] = {
          ...standing,
          teamName: team.name,
          teamLogoUrl: team.logoUrl || '',
          totalMMR: team.players.reduce((sum, p) => sum + p.mmr, 0)
        };
      }
    }
    
    Object.values(hydratedStandings).forEach(standing => {
      let neustadtl = 0;
      if (standing.headToHead) {
        Object.entries(standing.headToHead).forEach(([opponentId, result]) => {
           if (result === 'win') {
             const opponentPoints = hydratedStandings[opponentId]?.points || 0;
             neustadtl += opponentPoints;
           }
        });
      }
      standing.neustadtlScore = neustadtl;
    });

    return {
      ...group,
      standings: hydratedStandings,
    };
  });

  return hydratedGroups;
}

export default async function GroupStagePage() {
  const groups = await getHydratedGroupsData();
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/groups.png)` }} 
        />
        <div className="relative z-10">
          <Users className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Group Stage Standings
          </h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
            Follow the progress of teams through the group stages.
          </p>
        </div>
      </Card>

      {sortedGroups.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Groups Not Formed Yet</h2>
            <p className="text-muted-foreground">
              An administrator has not yet created the groups for the tournament. Please check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8">
          {sortedGroups.map((group) => (
            <GroupTable key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

export const metadata = {
  title: "Group Stage | Tournament Tracker",
  description: "View group stage standings for the tournament."
}
