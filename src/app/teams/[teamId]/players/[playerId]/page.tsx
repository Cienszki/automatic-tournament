
import { mockPlayers, mockTeams } from "@/lib/mock-data";
import type { Player, Team } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ExternalLink, BarChartHorizontalBig, Star, TrendingUp, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PlayerPageParams {
  params: {
    teamId: string;
    playerId: string;
  };
}

async function getPlayerData(teamId: string, playerId: string): Promise<{ player: Player | undefined, team: Team | undefined }> {
  const team = mockTeams.find(t => t.id === teamId);
  // The player IDs in mockTeams might be appended with teamId, so adjust find logic
  const player = mockPlayers.find(p => p.id === playerId || playerId.startsWith(p.id + "-t"));
  
  if (player && team) {
     // Find the specific player instance within the team's roster to get potentially team-specific details
     const playerInTeam = team.players.find(tp => tp.id === playerId);
     if (playerInTeam) {
       return { player: {...player, ...playerInTeam}, team }; // Merge general player mock with team-specific instance
     }
  }
  return { player, team };
}


export default async function PlayerPage({ params }: PlayerPageParams) {
  const { player, team } = await getPlayerData(params.teamId, params.playerId);

  if (!player || !team) {
    notFound();
  }

  // Placeholder stats - these would come from OpenDota API
  const playerStats = {
    kda: (Math.random() * 5 + 2).toFixed(2), // Kills/Deaths/Assists Ratio
    gpm: Math.floor(Math.random() * 300 + 400), // Gold Per Minute
    xpm: Math.floor(Math.random() * 300 + 450), // Experience Per Minute
    winRate: (Math.random() * 30 + 45).toFixed(1) + "%", // Win Rate
    mostPlayedHero: "Invoker", // Example
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
            <Avatar className="h-32 w-32 border-4 border-card shadow-md">
              <AvatarImage src={player.profileScreenshotUrl || `https://placehold.co/128x128.png?text=${player.nickname.charAt(0)}`} alt={player.nickname} data-ai-hint="gaming avatar" />
              <AvatarFallback className="text-4xl">{player.nickname.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-4xl font-bold text-primary">{player.nickname}</CardTitle>
              <CardDescription className="text-lg mt-1">
                Member of <Link href={`/teams/${team.id}`} className="text-accent hover:underline font-medium">{team.name}</Link>
              </CardDescription>
              <Button variant="outline" size="sm" asChild className="mt-3">
                <a href={player.steamProfileUrl} target="_blank" rel="noopener noreferrer">
                  Steam Profile <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <h3 className="text-2xl font-semibold mb-6 text-foreground flex items-center">
            <BarChartHorizontalBig className="h-7 w-7 mr-3 text-primary" /> Player Statistics
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard icon={Star} label="MMR" value={player.mmr.toString()} />
            <StatCard icon={TrendingUp} label="KDA Ratio" value={playerStats.kda} />
            <StatCard icon={Star} label="Gold Per Minute (GPM)" value={playerStats.gpm.toString()} />
            <StatCard icon={TrendingUp} label="XP Per Minute (XPM)" value={playerStats.xpm.toString()} />
            <StatCard icon={Shield} label="Win Rate" value={playerStats.winRate} />
            <StatCard icon={Star} label="Most Played Hero" value={playerStats.mostPlayedHero} />
          </div>
          <p className="text-sm text-muted-foreground text-center mt-8">
            Note: Player statistics are typically fetched from the OpenDota API. This page displays simulated data.
          </p>
           {player.profileScreenshotUrl || !player.profileScreenshotUrl && ( // Show placeholder if no screenshot
             <div className="mt-8">
                <h4 className="text-xl font-semibold mb-2">Profile Screenshot (Placeholder)</h4>
                <Image 
                    src={player.profileScreenshotUrl || "https://placehold.co/600x400.png"} 
                    alt={`${player.nickname} profile screenshot`}
                    width={600}
                    height={400}
                    className="rounded-md border object-contain"
                    data-ai-hint="profile screenshot"
                />
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <Card className="bg-muted/20 p-4 shadow-sm">
      <div className="flex items-center mb-1">
        <Icon className="h-5 w-5 mr-2 text-primary" />
        <CardDescription className="text-sm font-medium">{label}</CardDescription>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </Card>
  );
}

export async function generateMetadata({ params }: PlayerPageParams) {
  const { player, team } = await getPlayerData(params.teamId, params.playerId);
  if (!player) {
    return { title: "Player Not Found" };
  }
  return {
    title: `${player.nickname} | ${team?.name || 'Team'} | Tournament Tracker`,
    description: `Statistics and profile for player ${player.nickname}.`
  };
}

// generateStaticParams can be complex here due to nested structure and mock data player IDs
// For a real app, this would fetch all valid teamId/playerId combinations
// For now, let's try to generate some based on mockTeams and mockPlayers
export async function generateStaticParams() {
  const params: { teamId: string; playerId: string }[] = [];
  mockTeams.forEach(team => {
    team.players.forEach(player => {
      // Player IDs in mockTeams.players are already unique like 'p1-t1'
      params.push({ teamId: team.id, playerId: player.id });
    });
  });
  return params;
}

