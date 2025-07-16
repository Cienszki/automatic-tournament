
import { TeamCard } from "@/components/app/TeamCard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllTeams } from "@/lib/firestore";
import type { Team } from "@/lib/definitions";
import { Users } from "lucide-react";

async function getTeams(): Promise<Team[]> {
  return await getAllTeams();
}

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/teams.png)` }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="relative z-10">
          <Users className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Registered Teams
          </h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
            Browse all teams participating in the tournament. Click on a team to view their profile and match history.
          </p>
        </div>
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
