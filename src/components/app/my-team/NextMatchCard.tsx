
"use client";

import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";

interface NextMatchCardProps {
  match?: Match;
  teamId: string;
}

export function NextMatchCard({ match, teamId }: NextMatchCardProps) {

  if (!match) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <CalendarCheck className="mr-2" />
            Next Match
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-grow flex-col items-center justify-center text-center text-muted-foreground p-6">
          <ShieldAlert className="w-12 h-12 mb-4 text-muted-foreground/50" />
          <p className="font-semibold">No upcoming matches are scheduled yet.</p>
          <p className="text-xs mt-2">Check back after the next round is drawn.</p>
        </CardContent>
      </Card>
    );
  }

  const opponent = match.teamA.id === teamId ? match.teamB : match.teamA;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <CalendarCheck className="mr-2" />
          Next Match
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="flex items-center justify-around mb-4">
          <div className="flex flex-col items-center">
            <Image
              src={match.teamA.logoUrl || `https://placehold.co/64x64.png`}
              alt={`${match.teamA.name} Logo`}
              width={64}
              height={64}
              className="rounded-full mb-2"
            />
            <p className="font-semibold">{match.teamA.name}</p>
          </div>
          <p className="text-2xl font-bold text-muted-foreground">vs</p>
          <div className="flex flex-col items-center">
            <Image
              src={opponent.logoUrl || `https://placehold.co/64x64.png`}
              alt={`${opponent.name} Logo`}
              width={64}
              height={64}
              className="rounded-full mb-2"
            />
            <p className="font-semibold">{opponent.name}</p>
          </div>
        </div>
        <p className="text-lg font-semibold text-accent">
          {match.dateTime || match.defaultMatchTime
            ? format(new Date(match.dateTime || match.defaultMatchTime), "PPP 'at' HH:mm")
            : "TBD"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Status: {match.status}
        </p>
      </CardContent>
    </Card>
  );
}
