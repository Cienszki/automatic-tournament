
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Loader2 } from "lucide-react";
import { mockTeams } from "@/lib/mock-data";
import type { Team } from "@/lib/definitions";
import type { BracketData as InternalBracketData, TeamId } from '@/lib/tournament-bracket'; // Using InternalBracketData
import { initializeCustomDoubleEliminationBracket } from '@/lib/tournament-bracket';

const GLootBracketDisplay = dynamic(() => import('@/components/app/GLootBracketDisplay'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Loading Bracket Display...</p></div>,
});

export default function PlayoffsPage() {
  const [internalBracketData, setInternalBracketData] = useState<InternalBracketData | null>(null);
  const [teamsMapArray, setTeamsMapArray] = useState<[TeamId, Team][]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching and processing data
    const sortedTeams = [...mockTeams].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const upperBracketTeams = sortedTeams.slice(0, 8);
    const lowerBracketStartTeams = sortedTeams.slice(8, 16);

    if (upperBracketTeams.length === 8 && lowerBracketStartTeams.length === 8) {
      const bracketData = initializeCustomDoubleEliminationBracket(upperBracketTeams, lowerBracketStartTeams);
      setInternalBracketData(bracketData);

      const teamsForMap = [...upperBracketTeams, ...lowerBracketStartTeams];
      const mapArray: [TeamId, Team][] = teamsForMap.map(team => [team.id, team]);
      setTeamsMapArray(mapArray);
    } else {
      console.error("Not enough teams to initialize the bracket.");
      // Handle the case where there aren't enough teams (e.g., show an error message)
    }
    setIsLoading(false);
  }, []);

  return (
    <div className="space-y-8 p-1 md:p-2 flex flex-col min-h-[calc(100vh-var(--header-height,100px))]">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <GitBranch className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Playoff Bracket</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Follow the journey to the championship!
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-lg flex-grow flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-grow flex flex-col">
          {isLoading ? (
            <div className="flex justify-center items-center flex-grow"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Preparing Bracket Data...</p></div>
          ) : internalBracketData && teamsMapArray.length > 0 ? (
            <Suspense fallback={<div className="flex justify-center items-center flex-grow"><Loader2 className="h-10 w-10 animate-spin text-primary" /> Loading Bracket View...</div>}>
                <GLootBracketDisplay bracketData={internalBracketData} teamsMapArray={teamsMapArray} />
            </Suspense>
          ) : (
            <div className="p-8 text-center text-muted-foreground flex-grow flex items-center justify-center">
              <p className="text-xl">Not enough team data to display the playoff bracket.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
