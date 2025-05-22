
import type { Team, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import Link from "next/link";
import { Users, Sigma, ShieldCheck, Swords, Sparkles, Shield, HandHelping, Eye, List } from "lucide-react";

interface TeamCardProps {
  team: Team;
}

const getRoleIcon = (role: PlayerRole) => {
  switch (role) {
    case "Carry":
      return <Swords className="h-4 w-4 text-primary mr-2" />;
    case "Mid":
      return <Sparkles className="h-4 w-4 text-primary mr-2" />;
    case "Offlane":
      return <Shield className="h-4 w-4 text-primary mr-2" />;
    case "Soft Support":
      return <HandHelping className="h-4 w-4 text-primary mr-2" />;
    case "Hard Support":
      return <Eye className="h-4 w-4 text-primary mr-2" />;
    default:
      return <List className="h-4 w-4 text-muted-foreground mr-2" />;
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
      <CardContent className="flex-grow space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <Sigma className="h-4 w-4 mr-2 text-primary" />
          <span>Total MMR: {totalMMR.toLocaleString()}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mr-2 text-primary" />
          <span>{team.matchesWon ?? 0} Wins / {team.matchesLost ?? 0} Losses</span>
        </div>
         <div className="flex items-center text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 mr-2 text-primary" /> {/* Assuming TrendingUp for points is fine */}
          <span>{team.points ?? 0} Points</span>
        </div>

        <Separator className="my-3" />
        
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center">
            <Users className="h-4 w-4 mr-2 text-primary" /> Players & Roles
          </h4>
          <ul className="space-y-1 text-xs">
            {team.players.slice(0, 5).map((player) => ( // Ensure we only show 5 for brevity in card
              <li key={player.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  {getRoleIcon(player.role)}
                  <span>{player.nickname}</span>
                </div>
                <span className="text-muted-foreground capitalize">{player.role.toLowerCase().replace(' support', ' Sup.')}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/teams/${team.id}`}>View Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// Add TrendingUp to lucide imports if it was removed
import { TrendingUp } from "lucide-react";
