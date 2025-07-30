
"use client";

import { useState, useEffect } from "react";
import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, Clock, ExternalLink, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format, isFuture } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MatchListItemProps {
  match: Match;
}

export function MatchListItem({ match }: MatchListItemProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after hydration
    setIsClient(true);
  }, []);

  const isCompleted = match.status === 'completed';
  const hasOfficialTime = !!match.dateTime;
  
  const displayDate = hasOfficialTime ? new Date(match.dateTime!) : new Date(match.defaultMatchTime);
  
  // Format dates and times safely, only rendering the dynamic time part on the client
  const dateText = format(displayDate, "EEEE, MMMM d");
  const timeText = isClient ? format(displayDate, "HH:mm") : format(new Date(0), "HH:mm"); // Render a static time on server

  const winnerId = isCompleted && match.teamAScore > match.teamBScore ? match.teamA.id :
                   isCompleted && match.teamBScore > match.teamAScore ? match.teamB.id : null;

  const getStageLabel = () => {
      if (match.group_id) return match.group_id.replace(/-/g, ' ').replace(/\w/g, l => l.toUpperCase());
      if (match.playoff_round) return `Playoffs Round ${match.playoff_round}`;
      return "Exhibition";
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-3 bg-muted/20 text-center">
        <p className="font-semibold text-lg">{dateText}</p>
        <p className="text-sm text-muted-foreground">{isClient ? timeText : "..."}</p>
      </CardHeader>

      <CardContent className="flex-grow py-4 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center justify-around w-full">
            <TeamDisplay team={match.teamA} isWinner={winnerId === match.teamA.id} />
            
            <div className="text-center mx-2">
                {isCompleted ? (
                    <span className="text-2xl font-bold text-accent px-2 whitespace-nowrap">
                        {match.teamAScore} - {match.teamBScore}
                    </span>
                ) : (
                    <span className="text-xl font-bold text-primary">vs</span>
                )}
            </div>

            <TeamDisplay team={match.teamB} isWinner={winnerId === match.teamB.id} />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 bg-muted/20 pt-4 pb-4">
        <Badge variant="outline" className="flex items-center">
          <Shield className="h-3 w-3 mr-1.5" /> {getStageLabel()}
        </Badge>
        {!isCompleted && !hasOfficialTime && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant="destructive" className="flex items-center cursor-help">
                            <Clock className="h-3 w-3 mr-1.5 animate-pulse" />
                            Default Time
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>This match has not been scheduled by the captains yet.</p>
                        <p className="text-xs text-muted-foreground">Scheduling Deadline: {format(new Date(match.scheduled_for), "PPP HH:mm")}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
        {isCompleted && match.opendota_match_id && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`https://www.opendota.com/matches/${match.opendota_match_id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> View on OpenDota
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function TeamDisplay({ team, isWinner }: { team: Match['teamA'], isWinner: boolean }) {
    return (
        <Link href={`/teams/${team.id}`} className="flex flex-col items-center space-y-2 group w-[120px]">
            <Image
                src={team.logoUrl || `https://placehold.co/64x64.png?text=${team.name.charAt(0)}`}
                alt={`${team.name} logo`}
                width={64}
                height={64}
                className={cn("rounded-md object-cover border-4 transition-all duration-300", 
                    isWinner ? "border-primary shadow-lg" : "border-transparent group-hover:border-primary/50"
                )}
            />
            <span className={cn("font-semibold text-lg text-center w-full truncate",
                isWinner ? "text-primary" : "text-foreground group-hover:text-primary"
            )} title={team.name}>
              {team.name}
            </span>
        </Link>
    );
}
