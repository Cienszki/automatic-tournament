
"use client";

import { useState, useEffect } from "react";
import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  }, [match.dateTime]); // Re-run if match.dateTime changes

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <CardHeader className="pb-3 bg-muted/20">
        <CardTitle className="text-xl md:text-2xl text-primary flex items-center justify-between">
          <span>
            <Link href={`/teams/${match.teamA.id}`} className="hover:underline">{match.teamA.name}</Link> vs <Link href={`/teams/${match.teamB.id}`} className="hover:underline">{match.teamB.name}</Link>
          </span>
          {match.status === 'live' && <span className="text-xs px-2 py-1 bg-red-500 text-white rounded-full animate-pulse">LIVE</span>}
        </CardTitle>
        <CardDescription className="text-sm">
          {/* Render formatted date/time once available, or a placeholder */}
          {formattedDateTime !== null ? formattedDateTime : "Loading date & time..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-4 grid grid-cols-2 items-center gap-4">
        <TeamDisplay team={match.teamA} />
        <TeamDisplay team={match.teamB} alignment="right"/>
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

function TeamDisplay({ team, alignment = 'left' }: { team: Match['teamA'], alignment?: 'left' | 'right'}) {
    return (
        <div className={`flex items-center space-x-3 ${alignment === 'right' ? 'flex-row-reverse space-x-reverse' : ''}`}>
            <Image
                src={team.logoUrl || `https://placehold.co/48x48.png?text=${team.name.charAt(0)}`}
                alt={`${team.name} logo`}
                width={40}
                height={40}
                className="rounded-full object-cover border"
                data-ai-hint="team logo"
            />
            <span className={`font-semibold text-md ${alignment === 'right' ? 'text-right' : 'text-left'}`}>{team.name}</span>
        </div>
    );
}
