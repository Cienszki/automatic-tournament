
"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Trophy, Users, Shield, Star, Users2, ArrowRight, Home, Skull, Swords, Handshake, Crown } from "lucide-react";
// import { getPlayoffBracket } from "@/lib/firestore";
import type { PlayoffData, Match as PlayoffMatch } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { PlayoffBracketDisplay } from "@/components/app/PlayoffBracketDisplay";

export default function PlayoffsPage() {
  const [bracketData, setBracketData] = React.useState<PlayoffData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      // const data = await getPlayoffBracket();
      // setBracketData(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
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
      
      {loading ? (
        <p className="text-center text-muted-foreground">Loading bracket...</p>
      ) : bracketData ? (
        <PlayoffBracketDisplay bracketData={bracketData} />
      ) : (
        <p className="text-center text-muted-foreground">The playoff bracket has not been set yet.</p>
      )}
    </div>
  );
}
