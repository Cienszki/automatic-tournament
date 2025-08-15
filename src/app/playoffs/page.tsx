
"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Trophy, Users, Shield, Star, Users2, ArrowRight, Home, Skull, Swords, Handshake, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import PlayoffBracketDisplay from "@/components/app/PlayoffBracketDisplay";
import { PlayoffProgress } from "@/components/app/PlayoffProgress";
import { PlayoffProvider, usePlayoffs } from "@/context/PlayoffContext";

function PlayoffsContent() {
  const { playoffData, isLoading, error } = usePlayoffs();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive">Error loading playoff data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PlayoffProgress />
      {playoffData ? (
        <PlayoffBracketDisplay bracketData={playoffData} />
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">The playoff bracket has not been set yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PlayoffsPage() {
  return (
    <PlayoffProvider>
      <div className="space-y-8 p-1 md:p-2">
        {/* Desktop: show image banner with fixed height */}
        <Card className="hidden md:flex shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
          <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/playoffs.png)` }} data-ai-hint="neon fantasy space" />
        </Card>
        {/* Mobile: show text banner with neon font */}
        <Card className="flex md:hidden shadow-xl text-center relative overflow-hidden h-[120px] flex-col justify-center items-center p-4 bg-black">
          <span className="text-3xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_#39ff14] font-neon-bines">
            Playoffs
          </span>
        </Card>
        
        <PlayoffsContent />
      </div>
    </PlayoffProvider>
  );
}
