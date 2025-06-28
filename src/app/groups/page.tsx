
import { GroupTable } from "@/components/app/GroupTable";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockTeams, generateMockGroups } from "@/lib/mock-data";
import type { Group } from "@/lib/definitions";
import { AlertTriangle, Users } from "lucide-react";

// Simulate fetching registered teams and generating groups
// In a real app, this data would come from a database/API
async function getGroupsData(): Promise<Group[]> {
  // For now, use mockTeams. In a real app, fetch registered teams.
  // The number of groups should adjust to have 4 teams per group.
  // This means the number of registered teams should ideally be a multiple of 4.
  // We'll use all mockTeams for now.
  return generateMockGroups(mockTeams);
}

export default async function GroupStagePage() {
  const groups = await getGroupsData();

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/groups.png)` }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="relative z-10">
          <Users className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Group Stage Standings
          </h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
            Follow the progress of teams through the group stages. Scores are updated based on match results from OpenDota API (simulated).
          </p>
        </div>
      </Card>

      {groups.length === 0 && (
        <Card className="shadow-md">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Groups Available</h2>
            <p className="text-muted-foreground">
              It seems no teams have been registered or assigned to groups yet.
              Check back later or ensure teams are registered for groups to be formed.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8">
        {groups.map((group) => (
          <GroupTable key={group.id} group={group} />
        ))}
      </div>
      <p className="text-sm text-muted-foreground text-center mt-8">
        Note: Match results and standings are typically imported via the OpenDota API. This page displays simulated data.
      </p>
    </div>
  );
}

export const metadata = {
  title: "Group Stage | Tournament Tracker",
  description: "View group stage standings for the tournament."
}
