
import { TeamCard } from "@/components/app/TeamCard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockTeams } from "@/lib/mock-data";
import type { Team } from "@/lib/definitions";

async function getTeams(): Promise<Team[]> {
  // In a real app, fetch teams from your database/API
  return mockTeams;
}

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div className="space-y-8">
      <Card className="shadow-xl bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold text-primary">Registered Teams</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Browse all teams participating in the tournament. Click on a team to view their profile and match history.
          </CardDescription>
        </CardHeader>
      </Card>

      {teams.length === 0 ? (
        <p className="text-center text-muted-foreground text-xl py-10">No teams have registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

export const metadata = {
  title: "Teams | Tournament Tracker",
  description: "Browse all registered teams for the tournament."
}
