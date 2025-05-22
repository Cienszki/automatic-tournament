
import type { Team, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Users, Sigma, ShieldCheck, Swords, Sparkles, Shield, HandHelping, Eye, List, TrendingUp } from "lucide-react";

interface TeamCardProps {
  team: Team;
}

const getRoleIcon = (role: PlayerRole) => {
  switch (role) {
    case "Carry":
      return <Swords className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Mid":
      return <Sparkles className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Offlane":
      return <Shield className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Soft Support":
      return <HandHelping className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Hard Support":
      return <Eye className="h-4 w-4 text-primary mr-2 shrink-0" />;
    default:
      return <List className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />;
  }
};

export function TeamCard({ team }: TeamCardProps) {
  const totalMMR = team.players.reduce((sum, player) => sum + player.mmr, 0);

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center space-x-4 pb-4">
        <Image 
          src={team.logoUrl || `https://placehold.co/80x80.png?text=${team.name.charAt(0)}`} 
          alt={`${team.name} logo`} 
          width={64} 
          height={64} 
          className="rounded-lg object-cover border"
          data-ai-hint="team logo"
        />
        <div>
          <CardTitle className="text-2xl text-primary">{team.name}</CardTitle>
          <p className="text-sm text-muted-foreground">View Team Details</p>
        </div>
      </CardHeader>
      <CardContent className="flex-grow px-6 py-4">
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-3">
          {/* Column 1: Team Stats */}
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Sigma className="h-4 w-4 mr-2 text-primary shrink-0" />
              <span>Total MMR: {totalMMR.toLocaleString()}</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 mr-2 text-primary shrink-0" />
              <span>{team.matchesWon ?? 0} Wins / {team.matchesLost ?? 0} Losses</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 mr-2 text-primary shrink-0" />
              <span>{team.points ?? 0} Points</span>
            </div>
          </div>

          {/* Column 2: Player List */}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground flex items-center">
              <Users className="h-4 w-4 mr-2 text-primary shrink-0" /> Players
            </h4>
            <ul className="space-y-0.5 text-xs">
              {team.players.slice(0, 5).map((player) => (
                <li key={player.id} className="flex items-center">
                  {getRoleIcon(player.role)}
                  <span className="truncate" title={player.nickname}>{player.nickname}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4"> {/* Added pt-4 to ensure some padding if content above is short */}
        <Button asChild className="w-full">
          <Link href={`/teams/${team.id}`}>View Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
