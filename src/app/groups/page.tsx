
import { GroupTable } from "@/components/app/GroupTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllTeams } from "@/lib/firestore";
import type { Group, Team } from "@/lib/definitions";
import { AlertTriangle, Users } from "lucide-react";

// In a real app, this might involve more complex logic like seeding
function generateGroups(teams: Team[]): Group[] {
  const shuffledTeams = [...teams].sort(() => 0.5 - Math.random());
  const groups: Group[] = [];
  const teamsPerGroup = 4;
  const numGroups = Math.ceil(shuffledTeams.length / teamsPerGroup);

  for (let i = 0; i < numGroups; i++) {
    const groupTeams = shuffledTeams.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
    groups.push({
      id: `group-${i + 1}`,
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: groupTeams,
    });
  }
  return groups;
}

async function getGroupsData(): Promise<Group[]> {
  const teams = await getAllTeams();
  if (teams.length < 4) {
    // Not enough teams to form a group
    return [];
  }
  return generateGroups(teams);
}

export default async function GroupStagePage() {
  const groups = await getGroupsData();

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

      {groups.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Groups Not Formed Yet</h2>
            <p className="text-muted-foreground">
              There are not enough registered teams to form groups.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8">
          {groups.map((group) => (
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
