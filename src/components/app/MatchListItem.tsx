
"use client";

import { useState, useEffect } from "react";
import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card"; // CardTitle removed
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface MatchListItemProps {
  match: Match;
}

export function MatchListItem({ match }: MatchListItemProps) {
  const [formattedDateTime, setFormattedDateTime] = useState<string | null>(null);

  useEffect(() => {
    if (match.dateTime) {
      const matchDate = new Date(match.dateTime);
      const datePart = matchDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timePart = matchDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      setFormattedDateTime(`${datePart} at ${timePart}`);
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
        {/* CardTitle removed */}
        <CardDescription className="text-sm">
          {formattedDateTime !== null ? formattedDateTime : "Loading date & time..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="py-4 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center justify-center gap-3 md:gap-4">
          <TeamDisplay team={match.teamA} />
          <span className="text-lg md:text-xl font-bold text-primary">vs</span>
          <TeamDisplay team={match.teamB} />
        </div>
        {score && (
          <div className="mt-1 text-center">
            <span className="text-lg font-bold text-accent">{score}</span>
            {match.status === 'completed' && (
               <p className="text-xs text-muted-foreground">(Final Score)</p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-2 bg-muted/20 pt-3 pb-3">
        <Button variant="outline" size="sm" onClick={() => alert('Add to Google Calendar (simulated)')}>
          <CalendarPlus className="h-4 w-4 mr-2" /> Google Calendar
        </Button>
        <Button variant="outline" size="sm" onClick={() => alert('Add to Apple Calendar (simulated)')}>
          <CalendarPlus className="h-4 w-4 mr-2" /> Apple Calendar
        </Button>
      </CardFooter>
    </Card>
  );
}

function TeamDisplay({ team }: { team: Match['teamA']}) {
    // Removed alignment prop as centering is handled by parent
    return (
        <Link href={`/teams/${team.id}`} className="flex flex-col items-center space-y-1 group">
            <Image
                src={team.logoUrl || `https://placehold.co/64x64.png?text=${team.name.charAt(0)}`}
                alt={`${team.name} logo`}
                width={48} // Slightly smaller for better fit
                height={48}
                className="rounded-full object-cover border-2 border-transparent group-hover:border-primary transition-colors"
                data-ai-hint="team logo"
            />
            <span className="font-semibold text-md text-center group-hover:text-primary transition-colors w-24 truncate" title={team.name}>
              {team.name}
            </span>
        </Link>
    );
}
