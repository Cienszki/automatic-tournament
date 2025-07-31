
"use client";

import type { Team, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { Sigma, Shield, Swords, Sparkles, HandHelping, Eye, ListChecks, UserX, ShieldQuestion, PlayCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const getStatusBadge = (status?: string) => {
  switch (status) {
    case "pending":
      return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/40 hover:bg-gray-500/30 text-xs"><ShieldQuestion className="h-3 w-3 mr-1.5" />Not Verified</Badge>;
    case "verified":
      return <Badge variant="secondary" className="text-xs"><PlayCircle className="h-3 w-3 mr-1.5" />Active</Badge>;
    case "warning":
        return <Badge variant="destructive" className="text-xs"><UserX className="h-3 w-3 mr-1.5" />Warning</Badge>;
    case "banned":
      return <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-400/30 text-xs"><Trophy className="h-3 w-3 mr-1.5" />Banned</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};

export function TeamCard({ team }: TeamCardProps) {
  const totalMMR = team.players.reduce((sum, player) => sum + player.mmr, 0);

  return (
    <Card className={cn(
      "flex flex-col h-full shadow-none border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]",
      team.status === 'banned' && "bg-destructive/10 border-destructive/30",
    )}>
      <CardHeader className="flex flex-row items-start space-x-4 pb-4">
        <Image 
          src={team.logoUrl || `https://placehold.co/80x80.png?text=${team.name.charAt(0)}`} 
          alt={`${team.name} logo`} 
          width={64} 
          height={64} 
          className="rounded-lg object-cover border"
        />
        <div className="flex-1">
          <CardTitle className="text-2xl text-primary">{team.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-grow px-6 py-4">
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-3">
          {/* Column 1: Team Stats */}
          <div className="space-y-2">
            <div className="flex justify-start mb-1.5">{getStatusBadge(team.status)}</div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Sigma className="h-4 w-4 mr-2 text-primary shrink-0" />
              <span>Total MMR: {totalMMR.toLocaleString()}</span>
            </div>
            {/* Wins/Losses are not available on Team, so we omit this or show N/A */}
            <div className="flex items-center text-sm text-muted-foreground">
              <ListChecks className="h-4 w-4 mr-2 text-primary shrink-0" />
              <span>Wins/Losses: N/A</span>
            </div>
          </div>

          {/* Column 2: Player List */}
          <div className="space-y-1">
            <TooltipProvider delayDuration={100}>
              <ul className="space-y-1 text-xs">
                {team.players.slice(0, 5).map((player) => (
                  <li key={player.id} className="flex items-center">
                    {getRoleIcon(player.role)}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link 
                          href={`/teams/${team.id}/players/${player.id}`} 
                          className="truncate hover:text-primary transition-colors"
                        >
                          {player.nickname}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs p-1.5 bg-popover text-popover-foreground border-border">
                        <p>MMR: {player.mmr.toLocaleString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4">
        <Button 
          asChild 
          className="w-full hover:bg-accent hover:text-accent-foreground"
        >
          <Link href={`/teams/${team.id}`}>View Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
