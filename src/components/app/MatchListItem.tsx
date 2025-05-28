
"use client";

import { useState, useEffect } from "react";
import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface MatchListItemProps {
  match: Match;
}

export function MatchListItem({ match }: MatchListItemProps) {
  const [formattedDate, setFormattedDate] = useState<string | null>(null);
  const [formattedTime, setFormattedTime] = useState<string | null>(null);

  useEffect(() => {
    if (match.dateTime) {
      const matchDateObj = new Date(match.dateTime);
      setFormattedDate(matchDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
      setFormattedTime(matchDateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }));
    }
  }, [match.dateTime]);

  const getScoreDisplay = (scoreA?: number, scoreB?: number, status?: string) => {
    if (status === 'completed' && typeof scoreA === 'number' && typeof scoreB === 'number') {
      return `${scoreA} - ${scoreB}`;
    }
    return null;
  };

  const score = getScoreDisplay(match.teamAScore, match.teamBScore, match.status);

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <CardHeader className="pb-2 bg-muted/20 text-center">
        <CardDescription className="text-sm">
          {formattedDate !== null ? <span>{formattedDate}</span> : <span>Loading date...</span>}
          {formattedTime !== null ? <span className="block">{formattedTime}</span> : <span className="block">Loading time...</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="py-4 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center justify-center gap-3 md:gap-4 w-full">
          <TeamDisplay team={match.teamA} />
          {match.status === 'completed' && typeof match.teamAScore === 'number' && typeof match.teamBScore === 'number' ? (
            <span className="text-xl md:text-2xl font-bold text-accent px-2">
              {match.teamAScore} - {match.teamBScore}
            </span>
          ) : (
            <span className="text-lg md:text-xl font-bold text-primary">vs</span>
          )}
          <TeamDisplay team={match.teamB} />
        </div>
        {/* Score display was previously here, now integrated above for completed matches */}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-2 bg-muted/20 pt-3 pb-3">
        {match.status === 'upcoming' ? (
          <>
            <Button variant="outline" size="sm" onClick={() => alert('Add to Google Calendar (simulated)')}>
              <CalendarPlus className="h-4 w-4 mr-2" /> Google Calendar
            </Button>
            <Button variant="outline" size="sm" onClick={() => alert('Add to Apple Calendar (simulated)')}>
              <CalendarPlus className="h-4 w-4 mr-2" /> Apple Calendar
            </Button>
          </>
        ) : match.status === 'completed' && match.openDotaMatchUrl ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={match.openDotaMatchUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> View on OpenDota
            </Link>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function TeamDisplay({ team }: { team: Match['teamA']}) {
    return (
        <Link href={`/teams/${team.id}`} className="flex flex-col items-center space-y-1 group w-full max-w-[calc(50%-1rem)] md:max-w-[calc(50%-2rem)]"> {/* Adjusted max-width for score */}
            <Image
                src={team.logoUrl || `https://placehold.co/64x64.png?text=${team.name.charAt(0)}`}
                alt={`${team.name} logo`}
                width={48}
                height={48}
                className="rounded-md object-cover border-2 border-transparent group-hover:border-primary transition-colors"
                data-ai-hint="team logo"
            />
            <span className="font-semibold text-md text-center group-hover:text-primary transition-colors overflow-hidden text-ellipsis whitespace-nowrap w-full" title={team.name}>
              {team.name}
            </span>
        </Link>
    );
}
