
"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Trophy, Users, Shield, Star, Users2, ArrowRight, Home, Skull, Swords, Handshake, Crown } from "lucide-react";
import { mockTeams } from "@/lib/mock-data";
import type { Team } from "@/lib/definitions";
import { cn } from "@/lib/utils";

interface MatchParticipantProps {
  name: string;
  seed?: number;
  score?: number;
  isWinner?: boolean;
  logoUrl?: string;
}

const MatchParticipant: React.FC<MatchParticipantProps> = ({ name, seed, score, isWinner, logoUrl }) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 text-sm",
      isWinner ? "font-bold text-primary" : "text-muted-foreground"
    )}>
      <div className="flex items-center space-x-2">
        {logoUrl && (
          <Image src={logoUrl} alt={`${name} logo`} width={24} height={24} className="rounded-sm object-cover" data-ai-hint="team logo" />
        )}
        <span className="truncate" title={name}>{name}</span>
        {seed && <span className="text-xs">({seed})</span>}
      </div>
      {score !== undefined && <span className={cn("ml-2", isWinner ? "text-primary" : "text-muted-foreground")}>{score}</span>}
    </div>
  );
};

interface MatchCardProps {
  matchId: string;
  p1: MatchParticipantProps;
  p2: MatchParticipantProps;
  isPlaceholder?: boolean;
  placeholderText?: string;
  format?: string; // e.g., "BO3"
}

const MatchCard: React.FC<MatchCardProps> = ({ matchId, p1, p2, isPlaceholder, placeholderText, format }) => {
  if (isPlaceholder) {
    return (
      <div className="h-24 border border-dashed border-muted-foreground/50 rounded-lg flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
        {placeholderText || 'Awaiting Match'}
      </div>
    );
  }

  return (
    <Card className="shadow-md bg-card border-border hover:border-primary/50 transition-colors duration-150 h-24 flex flex-col justify-between">
      <CardHeader className="p-2 border-b border-border">
        <div className="text-xs text-muted-foreground text-center">
          {matchId} {format && `(${format})`}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow">
        <MatchParticipant {...p1} />
        <div className="border-t border-border">
          <MatchParticipant {...p2} />
        </div>
      </CardContent>
    </Card>
  );
};

interface RoundTitleProps {
  title: string;
  icon?: React.ElementType;
}
const RoundTitle: React.FC<RoundTitleProps> = ({ title, icon: Icon }) => (
  <h3 className="text-lg font-semibold text-accent mb-3 flex items-center justify-center sticky top-0 bg-card z-10 py-1">
    {Icon && <Icon className="h-5 w-5 mr-2" />}
    {title}
  </h3>
);


export default function PlayoffsPage() {
  React.useEffect(() => {
    document.title = "Playoffs | Tournament Tracker";
  }, []);

  const getTeamByName = (name: string, fallbackId: string): Team | null => {
    const foundTeam = mockTeams.find(t => t.name === name);
    if (foundTeam) return foundTeam;
    const fallbackTeamIndex = parseInt(fallbackId.replace('T', '')) -1;
    return mockTeams[fallbackTeamIndex] || null;
  };

  // UB Data - Using top 8 mock teams
  const ubTeam1 = mockTeams[0] || { id: 'T1', name: "Kebab u Dassem'a", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T1` };
  const ubTeam2 = mockTeams[1] || { id: 'T2', name: "Herbatka u Bratka", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T2` };
  const ubTeam3 = mockTeams[2] || { id: 'T3', name: "Chestnut's", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T3` };
  const ubTeam4 = mockTeams[3] || { id: 'T4', name: "Bóbr Honor Włoszczyzna", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T4` };
  const ubTeam5 = mockTeams[4] || { id: 'T5', name: "Wina Pingwina", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T5` };
  const ubTeam6 = mockTeams[5] || { id: 'T6', name: "Dont Ban Spectre", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T6` };
  const ubTeam7 = mockTeams[6] || { id: 'T7', name: "Gimnazjum...", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T7` };
  const ubTeam8 = mockTeams[7] || { id: 'T8', name: "Team Uchodźcy", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T8` };

  // LB Starting Data - Using teams 9-16
  const lbStartTeam9 = mockTeams[8] || { id: 'T9', name: "Gejmingowa Ekstaza Janusza", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T9` };
  const lbStartTeam10 = mockTeams[9] || { id: 'T10', name: "Team Bracer", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T10` };
  const lbStartTeam11 = mockTeams[10] || { id: 'T11', name: "Placki 🏆", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T11` };
  const lbStartTeam12 = mockTeams[11] || { id: 'T12', name: "Budzik Team", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T12` };
  const lbStartTeam13 = mockTeams[12] || { id: 'T13', name: "Equitantes cum Meretricibus Dantur mercedes", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T13` };
  const lbStartTeam14 = mockTeams[13] || { id: 'T14', name: "Team Kruszarki", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T14` };
  const lbStartTeam15 = mockTeams[14] || { id: 'T15', name: "Ofensywny Glimmer", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T15` };
  const lbStartTeam16 = mockTeams[15] || { id: 'T16', name: "Biuro Ochrony Rapiera", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T16` };

  // --- Upper Bracket Simulation ---
  // UB R1
  const ubR1M1Winner = ubTeam1; const ubR1M1Loser = ubTeam2; // Kebab wins vs Herbatka (2-1)
  const ubR1M2Winner = ubTeam3; const ubR1M2Loser = ubTeam4; // Chestnut's wins vs Bóbr (2-0)
  const ubR1M3Winner = ubTeam5; const ubR1M3Loser = ubTeam6; // Wina wins vs Dont Ban Spectre (2-1)
  const ubR1M4Winner = ubTeam7; const ubR1M4Loser = ubTeam8; // Gimnazjum wins vs Uchodźcy (2-0)

  // UB R2 (Semis)
  const ubR2M1Winner = ubR1M1Winner; const ubR2M1LoserForLB = ubR1M2Winner; // Kebab wins vs Chestnut's (2-1)
  const ubR2M2Winner = ubR1M3Winner; const ubR2M2LoserForLB = ubR1M4Winner; // Wina wins vs Gimnazjum (2-0)
  
  // UB Final
  const ubFinalWinner = ubR2M1Winner; const ubFinalLoserForLB = ubR2M2Winner; // Kebab wins vs Wina (2-1)

  // --- Lower Bracket Simulation ---
  // True LB R1 (Teams starting in LB play)
  const trueLBR1M1Winner = lbStartTeam9;   // Gejmingowa wins vs TeamBracer (1-0)
  const trueLBR1M2Winner = lbStartTeam11;  // Placki wins vs BudzikTeam (1-0)
  const trueLBR1M3Winner = lbStartTeam13;  // Equitantes wins vs TeamKruszarki (1-0)
  const trueLBR1M4Winner = lbStartTeam15;  // Ofensywny wins vs BiuroOchronyRapiera (1-0)

  // LB R2 (Merger: Losers of UB R1 vs Winners of true LB R1)
  const lbR2M1Winner = ubR1M1Loser; // Herbatka (UBR1M1Loser) wins vs Gejmingowa (TrueLBR1M1Winner) (1-0)
  const lbR2M2Winner = ubR1M2Loser; // Bobr (UBR1M2Loser) wins vs Placki (TrueLBR1M2Winner) (1-0)
  const lbR2M3Winner = trueLBR1M3Winner; // Equitantes (TrueLBR1M3Winner) wins vs DontBanSpectre (UBR1M3Loser) (1-0)
  const lbR2M4Winner = ubR1M4Loser; // Uchodzcy (UBR1M4Loser) wins vs Ofensywny (TrueLBR1M4Winner) (1-0) - Corrected winner from previous step

  // LB R3 (Winners of LB R2 play)
  const lbR3M1Winner = lbR2M1Winner; // Herbatka wins vs Bobr (2-1)
  const lbR3M2Winner = lbR2M3Winner; // Equitantes wins vs Uchodzcy (2-0)
  
  // LB R4 (Merger: Losers of UB R2 vs Winners of LB R3)
  const lbR4M1Winner = lbR3M1Winner; // Herbatka (LBR3M1Winner) wins vs Chestnut's (UBR2M1LoserForLB) (2-1)
  const lbR4M2Winner = ubR2M2LoserForLB; // Gimnazjum (UBR2M2LoserForLB) wins vs Equitantes (LBR3M2Winner) (2-1)

  // LB R5 (Winners of LB R4 play)
  const lbR5M1Winner = lbR4M1Winner; // Herbatka wins vs Gimnazjum (2-0)

  // LB Final (Winner of LB R5 vs Loser of UB Final)
  const lbFinalMatchWinner = ubFinalLoserForLB; // Wina (UBFinalLoserForLB) wins vs Herbatka (LBR5M1Winner) (2-1)

  // Grand Final
  const grandFinalWinner = ubFinalWinner; // Kebab wins vs Wina (3-2)


  return (
    <div className="space-y-8 p-1 md:p-2">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <GitBranch className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Playoff Bracket</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Follow the journey to the championship! (Static Mock Data)
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Upper Bracket & Finals Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary text-center">Upper Bracket & Finals</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 overflow-x-auto">
          <div className="min-w-[1200px] grid grid-cols-[repeat(5,minmax(220px,1fr))] grid-rows-[auto_repeat(8,minmax(4rem,auto))] gap-x-6 gap-y-1">
            {/* Round Titles */}
            <div className="col-start-1 row-start-1"><RoundTitle title="UB R1 (BO3)" icon={Users} /></div>
            <div className="col-start-2 row-start-1"><RoundTitle title="UB R2 (BO3)" icon={Shield} /></div>
            <div className="col-start-3 row-start-1"><RoundTitle title="UB Final (BO3)" icon={Star} /></div>
            <div className="col-start-4 row-start-1"><RoundTitle title="Grand Final (BO5)" icon={Trophy} /></div>
            <div className="col-start-5 row-start-1"><RoundTitle title="Champion" icon={Crown} /></div>

            {/* UB R1 Matches */}
            <div className="row-start-2 col-start-1"><MatchCard matchId="UB-R1-M1" format="BO3" p1={{name: ubTeam1.name, score:2, isWinner: true, logoUrl: ubTeam1.logoUrl}} p2={{name: ubTeam2.name, score:1, logoUrl: ubTeam2.logoUrl}} /></div>
            <div className="row-start-4 col-start-1"><MatchCard matchId="UB-R1-M2" format="BO3" p1={{name: ubTeam3.name, score:2, isWinner: true, logoUrl: ubTeam3.logoUrl}} p2={{name: ubTeam4.name, score:0, logoUrl: ubTeam4.logoUrl}} /></div>
            <div className="row-start-6 col-start-1"><MatchCard matchId="UB-R1-M3" format="BO3" p1={{name: ubTeam5.name, score:2, isWinner: true, logoUrl: ubTeam5.logoUrl}} p2={{name: ubTeam6.name, score:1, logoUrl: ubTeam6.logoUrl}} /></div>
            <div className="row-start-8 col-start-1"><MatchCard matchId="UB-R1-M4" format="BO3" p1={{name: ubTeam7.name, score:2, isWinner: true, logoUrl: ubTeam7.logoUrl}} p2={{name: ubTeam8.name, score:0, logoUrl: ubTeam8.logoUrl}} /></div>
            
            {/* UB R2 Matches (Semis) */}
            <div className="row-start-3 col-start-2"><MatchCard matchId="UB-R2-M1" format="BO3" p1={{name: ubR1M1Winner.name, score:2, isWinner: true, logoUrl: ubR1M1Winner.logoUrl}} p2={{name: ubR1M2Winner.name, score:1, logoUrl: ubR1M2Winner.logoUrl}} /></div>
            <div className="row-start-7 col-start-2"><MatchCard matchId="UB-R2-M2" format="BO3" p1={{name: ubR1M3Winner.name, score:2, isWinner: true, logoUrl: ubR1M3Winner.logoUrl}} p2={{name: ubR1M4Winner.name, score:0, logoUrl: ubR1M4Winner.logoUrl}} /></div>

            {/* UB Final */}
            <div className="row-start-5 col-start-3"><MatchCard matchId="UB-Final-M1" format="BO3" p1={{name: ubR2M1Winner.name, score:2, isWinner: true, logoUrl: ubR2M1Winner.logoUrl}} p2={{name: ubR2M2Winner.name, score:1, logoUrl: ubR2M2Winner.logoUrl}} /></div>

            {/* Grand Final */}
            <div className="row-start-5 col-start-4"><MatchCard matchId="GrandFinal-M1" format="BO5" p1={{name: ubFinalWinner.name, score:3, isWinner: true, logoUrl: ubFinalWinner.logoUrl}} p2={{name: lbFinalMatchWinner.name, score:2, logoUrl: lbFinalMatchWinner.logoUrl}} /></div>
            
            {/* Champion */}
            <div className="row-start-5 col-start-5 flex flex-col items-center justify-center h-full">
              <Trophy className="h-16 w-16 text-yellow-400 mb-2" />
              <p className="text-xl font-bold text-yellow-400">{grandFinalWinner.name}</p>
              <p className="text-sm text-muted-foreground">Tournament Champion!</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lower Bracket Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary text-center">Lower Bracket</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 overflow-x-auto">
          {/* Grid for Lower Bracket: 6 columns for rounds, 8 rows for matches + 1 row for titles */}
          <div className="min-w-[1450px] grid grid-cols-[repeat(6,minmax(220px,1fr))] grid-rows-[auto_repeat(8,minmax(4rem,auto))] gap-x-6 gap-y-1">
            {/* Round Titles - All in effective Row 1 of this grid section */}
            <div className="col-start-1 row-start-1"><RoundTitle title="LB R1 (BO1)" icon={Skull} /></div>
            <div className="col-start-2 row-start-1"><RoundTitle title="LB R2 (BO1)" icon={Skull} /></div>
            <div className="col-start-3 row-start-1"><RoundTitle title="LB R3 (BO3)" icon={Swords} /></div>
            <div className="col-start-4 row-start-1"><RoundTitle title="LB R4 (BO3)" icon={Swords} /></div>
            <div className="col-start-5 row-start-1"><RoundTitle title="LB R5 (BO3)" icon={Handshake} /></div>
            <div className="col-start-6 row-start-1"><RoundTitle title="LB Final (BO3)" icon={Star} /></div>

            {/* True LB R1 Matches (Column 1) */}
            <div className="row-start-2 col-start-1"><MatchCard matchId="TLB-R1-M1" format="BO1" p1={{name: lbStartTeam9.name, score:1, isWinner: true, logoUrl: lbStartTeam9.logoUrl}} p2={{name: lbStartTeam10.name, score:0, logoUrl: lbStartTeam10.logoUrl}} /></div>
            <div className="row-start-4 col-start-1"><MatchCard matchId="TLB-R1-M2" format="BO1" p1={{name: lbStartTeam11.name, score:1, isWinner: true, logoUrl: lbStartTeam11.logoUrl}} p2={{name: lbStartTeam12.name, score:0, logoUrl: lbStartTeam12.logoUrl}} /></div>
            <div className="row-start-6 col-start-1"><MatchCard matchId="TLB-R1-M3" format="BO1" p1={{name: lbStartTeam13.name, score:1, isWinner: true, logoUrl: lbStartTeam13.logoUrl}} p2={{name: lbStartTeam14.name, score:0, logoUrl: lbStartTeam14.logoUrl}} /></div>
            <div className="row-start-8 col-start-1"><MatchCard matchId="TLB-R1-M4" format="BO1" p1={{name: lbStartTeam15.name, score:1, isWinner: true, logoUrl: lbStartTeam15.logoUrl}} p2={{name: lbStartTeam16.name, score:0, logoUrl: lbStartTeam16.logoUrl}} /></div>

            {/* LB R2 Matches (Merger) (Column 2) */}
            <div className="row-start-2 col-start-2"><MatchCard matchId="LB-R2-M1" format="BO1" p1={{name: ubR1M1Loser.name, score:1, isWinner: true, logoUrl: ubR1M1Loser.logoUrl}} p2={{name: trueLBR1M1Winner.name, score:0, logoUrl: trueLBR1M1Winner.logoUrl}}/></div>
            <div className="row-start-4 col-start-2"><MatchCard matchId="LB-R2-M2" format="BO1" p1={{name: ubR1M2Loser.name, score:1, isWinner: true, logoUrl: ubR1M2Loser.logoUrl}} p2={{name: trueLBR1M2Winner.name, score:0, logoUrl: trueLBR1M2Winner.logoUrl}}/></div>
            <div className="row-start-6 col-start-2"><MatchCard matchId="LB-R2-M3" format="BO1" p1={{name: ubR1M3Loser.name, score:0, logoUrl: ubR1M3Loser.logoUrl}} p2={{name: trueLBR1M3Winner.name, score:1, isWinner: true, logoUrl: trueLBR1M3Winner.logoUrl}}/></div>
            <div className="row-start-8 col-start-2"><MatchCard matchId="LB-R2-M4" format="BO1" p1={{name: ubR1M4Loser.name, score:1, isWinner: true, logoUrl: ubR1M4Loser.logoUrl}} p2={{name: trueLBR1M4Winner.name, score:0, logoUrl: trueLBR1M4Winner.logoUrl}}/></div>

            {/* LB R3 Matches (Column 3) */}
            <div className="row-start-3 col-start-3"><MatchCard matchId="LB-R3-M1" format="BO3" p1={{name: lbR2M1Winner.name, score:2, isWinner: true, logoUrl: lbR2M1Winner.logoUrl}} p2={{name: lbR2M2Winner.name, score:1, logoUrl: lbR2M2Winner.logoUrl}} /></div>
            <div className="row-start-7 col-start-3"><MatchCard matchId="LB-R3-M2" format="BO3" p1={{name: lbR2M3Winner.name, score:2, isWinner: true, logoUrl: lbR2M3Winner.logoUrl}} p2={{name: lbR2M4Winner.name, score:0, logoUrl: lbR2M4Winner.logoUrl}} /></div>

            {/* LB R4 Matches (Merger) (Column 4) */}
            <div className="row-start-3 col-start-4"><MatchCard matchId="LB-R4-M1" format="BO3" p1={{name: ubR2M1LoserForLB.name, score:1, logoUrl: ubR2M1LoserForLB.logoUrl}} p2={{name: lbR3M1Winner.name, score:2, isWinner: true, logoUrl: lbR3M1Winner.logoUrl}} /></div>
            <div className="row-start-7 col-start-4"><MatchCard matchId="LB-R4-M2" format="BO3" p1={{name: ubR2M2LoserForLB.name, score:2, isWinner: true, logoUrl: ubR2M2LoserForLB.logoUrl}} p2={{name: lbR3M2Winner.name, score:1, logoUrl: lbR3M2Winner.logoUrl}} /></div>

            {/* LB R5 Match (Column 5) */}
            <div className="row-start-5 col-start-5"><MatchCard matchId="LB-R5-M1" format="BO3" p1={{name: lbR4M1Winner.name, score:0, logoUrl: lbR4M1Winner.logoUrl}} p2={{name: lbR4M2Winner.name, score:2, isWinner: true, logoUrl: lbR4M2Winner.logoUrl}} /></div> {/* Corrected score and winner based on next round */}
            
            {/* LB Final Match (Column 6) */}
            {/* Winner of LB R5 (lbR4M2Winner) vs Loser of UB Final (ubFinalLoserForLB) */}
            <div className="row-start-5 col-start-6"><MatchCard matchId="LB-Final-M1" format="BO3" p1={{name: lbR4M2Winner.name, score:1, logoUrl: lbR4M2Winner.logoUrl}} p2={{name: ubFinalLoserForLB.name, score:2, isWinner: true, logoUrl: ubFinalLoserForLB.logoUrl}} /></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
