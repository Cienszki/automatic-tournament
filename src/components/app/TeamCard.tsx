
import type { Team, PlayerRole, TournamentStatus } from "@/lib/definitions";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { Sigma, Shield, Swords, Sparkles, HandHelping, Eye, ListChecks, Medal, UserCheck, UserX, ShieldQuestion, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
      return <ListChecks className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />;
  }
};

const getStatusBadge = (status: TournamentStatus) => {
  switch (status) {
    case "Not Verified":
      return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30 text-xs"><ShieldQuestion className="h-3 w-3 mr-1.5" />Not Verified</Badge>;
    case "Verified":
      return <Badge className="bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30 text-xs"><UserCheck className="h-3 w-3 mr-1.5" />Verified</Badge>;
    case "Active":
      return <Badge variant="secondary" className="text-xs"><PlayCircle className="h-3 w-3 mr-1.5" />Active</Badge>;
    case "Eliminated":
      return <Badge variant="destructive" className="text-xs"><UserX className="h-3 w-3 mr-1.5" />Eliminated</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};


export function TeamCard({ team }: TeamCardProps) {
  const totalMMR = team.players.reduce((sum, player) => sum + player.mmr, 0);

  return (
    <Card className={cn(
      "flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300",
      team.status === 'Eliminated' && "bg-destructive/10 border-destructive/30"
    )}>
      <CardHeader className="flex flex-row items-start space-x-4 pb-4">
        <Image 
          src={team.logoUrl || `https://placehold.co/80x80.png?text=${team.name.charAt(0)}`} 
          alt={`${team.name} logo`} 
          width={64} 
          height={64} 
          className="rounded-lg object-cover border"
          data-ai-hint="team logo"
        />
        <div className="flex-1">
          <CardTitle className="text-2xl text-primary">{team.name}</CardTitle>
          <div className="mt-1.5">
            {getStatusBadge(team.status)}
          </div>
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
              <ListChecks className="h-4 w-4 mr-2 text-primary shrink-0" />
              <span>{team.matchesWon ?? 0} Wins / {team.matchesLost ?? 0} Losses</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Medal className="h-4 w-4 mr-2 text-primary shrink-0" />
              <span>{team.points ?? 0} Points</span>
            </div>
          </div>

          {/* Column 2: Player List */}
          <div className="space-y-1">
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
      <CardFooter className="pt-4">
        <Button asChild className="w-full">
          <Link href={`/teams/${team.id}`}>View Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
