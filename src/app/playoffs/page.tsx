
"use client";

import * as React from "react";
import Image from "next/image"; // Added import for Image
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Trophy, Users, Shield, Star, Users2, ArrowRight, Home, Skull, Swords, Handshake } from "lucide-react";
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
          <Image src={logoUrl} alt={`${name} logo`} width={24} height={24} className="rounded-sm" data-ai-hint="team logo" />
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
      <div className="h-24 min-w-[220px] border border-dashed border-muted-foreground/50 rounded-lg flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
        {placeholderText || 'Awaiting Match'}
      </div>
    );
  }

  return (
    <Card className="shadow-md min-w-[220px] bg-card border-border hover:border-primary/50 transition-colors duration-150">
      <CardHeader className="p-2 border-b border-border">
        <div className="text-xs text-muted-foreground text-center">
          {matchId} {format && `(${format})`}
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
  <h3 className="text-lg font-semibold text-accent mb-3 flex items-center justify-center">
    {Icon && <Icon className="h-5 w-5 mr-2" />}
    {title}
  </h3>
);


export default function PlayoffsPage() {
  const top16Teams = [...mockTeams].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 16);

  // Simulate team assignments if not enough teams
  const getTeam = (index: number, defaultName: string): Team => 
    top16Teams[index] || { id: `t${index + 1}`, name: defaultName, players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=${defaultName.charAt(0)}` };

  // UB Data
  const ubTeam1 = getTeam(0, "Kebab u Dassem'a");
  const ubTeam2 = getTeam(1, "Herbatka u Bratka");
  const ubTeam3 = getTeam(2, "Chestnut's");
  const ubTeam4 = getTeam(3, "Bóbr Honor Włoszczyzna");
  const ubTeam5 = getTeam(4, "Wina Pingwina");
  const ubTeam6 = getTeam(5, "Dont Ban Spectre");
  const ubTeam7 = getTeam(6, "Gimnazjum...");
  const ubTeam8 = getTeam(7, "Team Uchodźcy");

  // LB Starting Data
  const lbStartTeam9 = getTeam(8, "Gejmingowa Ekstaza Jar");
  const lbStartTeam10 = getTeam(9, "Team Bracer");
  const lbStartTeam11 = getTeam(10, "Placki 🏆");
  const lbStartTeam12 = getTeam(11, "Budzik Team");
  const lbStartTeam13 = getTeam(12, "Equitantes cum Meretricibus");
  const lbStartTeam14 = getTeam(13, "Team Kruszarki");
  const lbStartTeam15 = getTeam(14, "Ofensywny Glimmer");
  const lbStartTeam16 = getTeam(15, "Biuro Ochrony Rapiera");

  // Simulated Winners/Losers UB R1
  const ubR1M1Winner = ubTeam1; const ubR1M1Loser = ubTeam2; // Kebab wins vs Herbatka
  const ubR1M2Winner = ubTeam3; const ubR1M2Loser = ubTeam4; // Chestnut's wins vs Bóbr
  const ubR1M3Winner = ubTeam5; const ubR1M3Loser = ubTeam6; // Wina wins vs Dont Ban Spectre
  const ubR1M4Winner = ubTeam7; const ubR1M4Loser = ubTeam8; // Gimnazjum wins vs Uchodźcy

  // Simulated Winners/Losers UB R2 (Semis)
  const ubR2M1Winner = ubR1M1Winner; const ubR2M1Loser = ubR1M2Winner; // Kebab wins vs Chestnut's
  const ubR2M2Winner = ubR1M3Winner; const ubR2M2Loser = ubR1M4Winner; // Wina wins vs Gimnazjum
  
  // Simulated UB Final
  const ubFinalWinner = ubR2M1Winner; const ubFinalLoser = ubR2M2Winner; // Kebab wins vs Wina

  // --- Lower Bracket Simulation ---
  // True LB R1 (8 starting LB teams play)
  const trueLBR1M1Winner = lbStartTeam9; // Gejmingowa wins
  const trueLBR1M2Winner = lbStartTeam11; // Placki wins
  const trueLBR1M3Winner = lbStartTeam13; // Equitantes wins
  const trueLBR1M4Winner = lbStartTeam15; // Ofensywny wins

  // LB R2 (Merger: Losers of UB R1 vs Winners of true LB R1)
  const lbR2M1Winner = ubR1M1Loser; // Herbatka (UBR1M1Loser) wins vs Gejmingowa (TrueLBR1M1Winner)
  const lbR2M2Winner = ubR1M2Loser; // Bobr (UBR1M2Loser) wins vs Placki (TrueLBR1M2Winner)
  const lbR2M3Winner = trueLBR1M3Winner; // Equitantes (TrueLBR1M3Winner) wins vs DontBanSpectre (UBR1M3Loser)
  const lbR2M4Winner = trueLBR1M4Winner; // Ofensywny (TrueLBR1M4Winner) wins vs Uchodzcy (UBR1M4Loser)

  // LB R3 (Winners of LB R2 play)
  const lbR3M1Winner = lbR2M1Winner; // Herbatka wins vs Bobr
  const lbR3M2Winner = lbR2M3Winner; // Equitantes wins vs Ofensywny
  
  // LB R4 (Merger: Losers of UB R2 vs Winners of LB R3)
  const lbR4M1Winner = lbR3M1Winner; // Herbatka (LBR3M1Winner) wins vs Chestnut's (UBR2M1Loser)
  const lbR4M2Winner = ubR2M2Loser; // Gimnazjum (UBR2M2Loser) wins vs Equitantes (LBR3M2Winner)

  // LB R5 (Winners of LB R4 play)
  const lbR5M1Winner = lbR4M1Winner; // Herbatka wins vs Gimnazjum

  // LB Final (Winner of LB R5 vs Loser of UB Final)
  const lbFinalMatchWinner = ubFinalLoser; // Wina (UBFinalLoser) wins vs Herbatka (LBR5M1Winner)

  // Grand Final
  const grandFinalWinner = ubFinalWinner; // Kebab wins vs Wina

  return (
    <div className="space-y-8 p-1 md:p-2">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <GitBranch className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Playoff Bracket</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Follow the journey to the championship! (Static Example)
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
          <div className="min-w-[1450px] grid grid-cols-[repeat(6,minmax(220px,1fr))] grid-rows-[auto_repeat(16,minmax(4rem,auto))] gap-x-6 gap-y-1">
            {/* Round Titles */}
            <div className="col-start-1 row-start-9"><RoundTitle title="LB R1 (BO1)" icon={Skull} /></div>
            <div className="col-start-2 row-start-9"><RoundTitle title="LB R2 (BO1)" icon={Skull} /></div>
            <div className="col-start-3 row-start-9"><RoundTitle title="LB R3 (BO3)" icon={Swords} /></div>
            <div className="col-start-4 row-start-9"><RoundTitle title="LB R4 (BO3)" icon={Swords} /></div>
            <div className="col-start-5 row-start-9"><RoundTitle title="LB R5 (BO3)" icon={Handshake} /></div>
            <div className="col-start-6 row-start-9"><RoundTitle title="LB Final (BO3)" icon={Star} /></div>

            {/* True LB R1 */}
            <div className="row-start-10 col-start-1"><MatchCard matchId="TLB-R1-M1" format="BO1" p1={{name: lbStartTeam9.name, score:1, isWinner: true, logoUrl: lbStartTeam9.logoUrl}} p2={{name: lbStartTeam10.name, score:0, logoUrl: lbStartTeam10.logoUrl}} /></div>
            <div className="row-start-12 col-start-1"><MatchCard matchId="TLB-R1-M2" format="BO1" p1={{name: lbStartTeam11.name, score:1, isWinner: true, logoUrl: lbStartTeam11.logoUrl}} p2={{name: lbStartTeam12.name, score:0, logoUrl: lbStartTeam12.logoUrl}} /></div>
            <div className="row-start-14 col-start-1"><MatchCard matchId="TLB-R1-M3" format="BO1" p1={{name: lbStartTeam13.name, score:1, isWinner: true, logoUrl: lbStartTeam13.logoUrl}} p2={{name: lbStartTeam14.name, score:0, logoUrl: lbStartTeam14.logoUrl}} /></div>
            <div className="row-start-16 col-start-1"><MatchCard matchId="TLB-R1-M4" format="BO1" p1={{name: lbStartTeam15.name, score:1, isWinner: true, logoUrl: lbStartTeam15.logoUrl}} p2={{name: lbStartTeam16.name, score:0, logoUrl: lbStartTeam16.logoUrl}} /></div>

            {/* LB R2 (Merger: Losers of UB R1 vs Winners of true LB R1) */}
            <div className="row-start-10 col-start-2"><MatchCard matchId="LB-R2-M1" format="BO1" p1={{name: ubR1M1Loser.name, score:1, isWinner: true, logoUrl: ubR1M1Loser.logoUrl}} p2={{name: trueLBR1M1Winner.name, score:0, logoUrl: trueLBR1M1Winner.logoUrl}}/></div>
            <div className="row-start-12 col-start-2"><MatchCard matchId="LB-R2-M2" format="BO1" p1={{name: ubR1M2Loser.name, score:1, isWinner: true, logoUrl: ubR1M2Loser.logoUrl}} p2={{name: trueLBR1M2Winner.name, score:0, logoUrl: trueLBR1M2Winner.logoUrl}}/></div>
            <div className="row-start-14 col-start-2"><MatchCard matchId="LB-R2-M3" format="BO1" p1={{name: ubR1M3Loser.name, score:0, logoUrl: ubR1M3Loser.logoUrl}} p2={{name: trueLBR1M3Winner.name, score:1, isWinner: true, logoUrl: trueLBR1M3Winner.logoUrl}}/></div>
            <div className="row-start-16 col-start-2"><MatchCard matchId="LB-R2-M4" format="BO1" p1={{name: ubR1M4Loser.name, score:0, logoUrl: ubR1M4Loser.logoUrl}} p2={{name: trueLBR1M4Winner.name, score:1, isWinner: true, logoUrl: trueLBR1M4Winner.logoUrl}}/></div>

            {/* LB R3 (Winners of LB R2 play) */}
            <div className="row-start-11 col-start-3"><MatchCard matchId="LB-R3-M1" format="BO3" p1={{name: lbR2M1Winner.name, score:2, isWinner: true, logoUrl: lbR2M1Winner.logoUrl}} p2={{name: lbR2M2Winner.name, score:1, logoUrl: lbR2M2Winner.logoUrl}} /></div>
            <div className="row-start-15 col-start-3"><MatchCard matchId="LB-R3-M2" format="BO3" p1={{name: lbR2M3Winner.name, score:2, isWinner: true, logoUrl: lbR2M3Winner.logoUrl}} p2={{name: lbR2M4Winner.name, score:0, logoUrl: lbR2M4Winner.logoUrl}} /></div>

            {/* LB R4 (Merger: Losers of UB R2 vs Winners of LB R3) */}
            <div className="row-start-11 col-start-4"><MatchCard matchId="LB-R4-M1" format="BO3" p1={{name: ubR2M1Loser.name, score:1, logoUrl: ubR2M1Loser.logoUrl}} p2={{name: lbR3M1Winner.name, score:2, isWinner: true, logoUrl: lbR3M1Winner.logoUrl}} /></div>
            <div className="row-start-15 col-start-4"><MatchCard matchId="LB-R4-M2" format="BO3" p1={{name: ubR2M2Loser.name, score:2, isWinner: true, logoUrl: ubR2M2Loser.logoUrl}} p2={{name: lbR3M2Winner.name, score:1, logoUrl: lbR3M2Winner.logoUrl}} /></div>

            {/* LB R5 (Winners of LB R4 play) */}
            <div className="row-start-13 col-start-5"><MatchCard matchId="LB-R5-M1" format="BO3" p1={{name: lbR4M1Winner.name, score:1, logoUrl: lbR4M1Winner.logoUrl}} p2={{name: lbR4M2Winner.name, score:2, isWinner: true, logoUrl: lbR4M2Winner.logoUrl}} /></div>
            
            {/* LB Final (Winner of LB R5 vs Loser of UB Final) */}
            <div className="row-start-13 col-start-6"><MatchCard matchId="LB-Final-M1" format="BO3" p1={{name: lbR5M1Winner.name, score:1, logoUrl: lbR5M1Winner.logoUrl}} p2={{name: ubFinalLoser.name, score:2, isWinner: true, logoUrl: ubFinalLoser.logoUrl}} /></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
