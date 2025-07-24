
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
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/playoffs.png)` }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="relative z-10">
            <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
              Playoff Bracket
            </h2>
            <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
              Follow the journey to the championship!
            </p>
        </div>
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
