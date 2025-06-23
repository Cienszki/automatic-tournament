
"use client";

import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import React from "react";

interface NextMatchCardProps {
  match: Match | undefined;
  teamId: string;
}

export function NextMatchCard({ match, teamId }: NextMatchCardProps) {
  const [formattedDate, setFormattedDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (match?.dateTime) {
      const matchDateObj = new Date(match.dateTime);
      setFormattedDate(format(matchDateObj, "EEEE, MMMM d 'at' HH:mm"));
    } else {
      setFormattedDate(null);
    }
  }, [match?.dateTime]);

  if (!match) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <CalendarCheck className="mr-2" />
            Next Match
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center text-center h-full min-h-[120px]">
          <ShieldAlert className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No upcoming matches are scheduled yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Check back after the next round is drawn.</p>
        </CardContent>
      </Card>
    );
  }

  const opponent = match.teamA.id === teamId ? match.teamB : match.teamA;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <CalendarCheck className="mr-2" />
          Next Match
        </CardTitle>
        {match.round && (
          <CardDescription>
            {match.round}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center text-center py-4">
        <p className="text-sm text-muted-foreground mb-2">vs</p>
        <Image
          src={opponent.logoUrl || `https://placehold.co/80x80.png`}
          alt={`${opponent.name} logo`}
          width={64}
          height={64}
          className="rounded-lg border-2 border-card shadow-md mb-2"
          data-ai-hint="team logo"
        />
        <h3 className="text-xl font-bold text-foreground">{opponent.name}</h3>
        <p className="text-muted-foreground mt-2">
          {formattedDate || 'Date to be confirmed'}
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
            <Link href="/schedule">View Full Schedule</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
