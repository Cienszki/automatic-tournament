
import { mockPlayers, mockTeams } from "@/lib/mock-data";
import type { Player, Team, TournamentStatus } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, BarChartHorizontalBig, Star, TrendingUp, Shield, BarChart3, UserCheck, UserX, ShieldQuestion, PlayCircle, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";

interface PlayerPageParams {
  params: {
    teamId: string;
    playerId: string;
  };
}

async function getPlayerData(teamId: string, playerId: string): Promise<{ player: Player | undefined, team: Team | undefined }> {
  const team = mockTeams.find(t => t.id === teamId);
  
  let playerInTeamRoster: Player | undefined;
  if (team) {
     playerInTeamRoster = team.players.find(tp => tp.id === playerId);
  }
  
  if (playerInTeamRoster && team) {
    return { player: playerInTeamRoster, team };
  }
  
  // Fallback or if player might exist outside a specific team context (less likely with current data structure)
  const playerGeneralInfo = mockPlayers.find(p => p.id === playerId || playerId.startsWith(p.id + "-t"));
  return { player: playerGeneralInfo, team };
}

const getStatusBadgeClasses = (status: TournamentStatus) => {
  switch (status) {
    case "Not Verified":
      return "bg-gray-500/20 text-gray-300 border-gray-500/40 hover:bg-gray-500/30";
    case "Active":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "Eliminated":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/80";
    case "Champions":
      return "bg-yellow-400/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-400/30";
    default:
      return "border-transparent bg-gray-500 text-gray-100";
  }
};

const getStatusIcon = (status: TournamentStatus) => {
  switch (status) {
    case "Not Verified":
      return <ShieldQuestion className="h-4 w-4 mr-1.5" />;
    case "Active":
      return <PlayCircle className="h-4 w-4 mr-1.5" />;
    case "Eliminated":
      return <UserX className="h-4 w-4 mr-1.5" />;
    case "Champions":
      return <Trophy className="h-4 w-4 mr-1.5" />;
    default:
      return null;
  }
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
              <div className="flex items-center space-x-3 mb-1">
                <CardTitle className="text-4xl font-bold text-primary">{player.nickname}</CardTitle>
                <Badge className={cn("text-sm px-3 py-1", getStatusBadgeClasses(player.status))}>
                    {getStatusIcon(player.status)}
                    {player.status}
                </Badge>
              </div>
              <CardDescription className="text-lg mt-1">
                Member of <Link href={`/teams/${team.id}`} className="text-accent hover:underline font-medium">{team.name}</Link>
              </CardDescription>
              <div className="mt-3 flex space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={player.steamProfileUrl} target="_blank" rel="noopener noreferrer">
                    Steam Profile <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                {player.openDotaProfileUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={player.openDotaProfileUrl} target="_blank" rel="noopener noreferrer">
                      OpenDota <BarChart3 className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
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
           {(player.profileScreenshotUrl || !player.profileScreenshotUrl) && ( 
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

export async function generateStaticParams() {
  const params: { teamId: string; playerId: string }[] = [];
  mockTeams.forEach(team => {
    team.players.forEach(player => {
      params.push({ teamId: team.id, playerId: player.id });
    });
  });
  return params;
}
