
"use client";

import * as React from "react";
import Image from "next/image"; // Added import for Image
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
      "flex items-center justify-between p-2 text-sm overflow-hidden", // Added overflow-hidden
      isWinner ? "font-bold text-primary" : "text-muted-foreground"
    )}>
      <div className="flex items-center space-x-2 flex-1 min-w-0"> {/* Added flex-1 min-w-0 */}
        {logoUrl && (
          <Image src={logoUrl} alt={`${name} logo`} width={24} height={24} className="rounded-sm object-cover flex-shrink-0" data-ai-hint="team logo" /> // Added flex-shrink-0
        )}
        <span className="truncate" title={name}>{name}</span>
        {seed && <span className="text-xs">({seed})</span>}
      </div>
      {score !== undefined && <span className={cn("ml-2 flex-shrink-0", isWinner ? "text-primary" : "text-muted-foreground")}>{score}</span>} {/* Added flex-shrink-0 */}
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
      <div className="h-20 border border-dashed border-muted-foreground/50 rounded-lg flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
        {placeholderText || 'Awaiting Match'}
      </div>
    );
  }

  return (
    <Card className="shadow-md bg-card border-border hover:border-primary/50 transition-colors duration-150 h-20 flex flex-col justify-between">
      {/* CardHeader removed */}
      <CardContent className="p-0 flex-grow flex flex-col justify-around"> {/* Adjusted to flex flex-col justify-around */}
        <MatchParticipant {...p1} />
        <div className="border-t border-border my-0.5"></div> {/* Adjusted border and added small margin */}
        <MatchParticipant {...p2} />
      </CardContent>
    </Card>
  );
};

interface RoundTitleProps {
  title: string;
  icon?: React.ElementType;
}
const RoundTitle: React.FC<RoundTitleProps> = ({ title, icon: Icon }) => (
  <h3 className="text-lg font-semibold text-accent mb-3 flex items-center justify-center py-1">
    {Icon && <Icon className="h-5 w-5 mr-2" />}
    {title}
  </h3>
);


export default function PlayoffsPage() {
  // Simulate data fetching or direct use of mock data
  // Team assignments (using top 16 teams from mock data)
  const playoffTeams = mockTeams.slice(0, 16);

  const ubTeam1 = playoffTeams[0] || { id: 'T1', name: "Team 1 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T1` };
  const ubTeam2 = playoffTeams[1] || { id: 'T2', name: "Team 2 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T2` };
  const ubTeam3 = playoffTeams[2] || { id: 'T3', name: "Team 3 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T3` };
  const ubTeam4 = playoffTeams[3] || { id: 'T4', name: "Team 4 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T4` };
  const ubTeam5 = playoffTeams[4] || { id: 'T5', name: "Team 5 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T5` };
  const ubTeam6 = playoffTeams[5] || { id: 'T6', name: "Team 6 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T6` };
  const ubTeam7 = playoffTeams[6] || { id: 'T7', name: "Team 7 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T7` };
  const ubTeam8 = playoffTeams[7] || { id: 'T8', name: "Team 8 (UB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T8` };

  // Teams starting in Lower Bracket
  const lbStartTeam9 = playoffTeams[8] || { id: 'T9', name: "Team 9 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T9` };
  const lbStartTeam10 = playoffTeams[9] || { id: 'T10', name: "Team 10 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T10` };
  const lbStartTeam11 = playoffTeams[10] || { id: 'T11', name: "Team 11 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T11` };
  const lbStartTeam12 = playoffTeams[11] || { id: 'T12', name: "Team 12 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T12` };
  const lbStartTeam13 = playoffTeams[12] || { id: 'T13', name: "Team 13 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T13` };
  const lbStartTeam14 = playoffTeams[13] || { id: 'T14', name: "Team 14 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T14` };
  const lbStartTeam15 = playoffTeams[14] || { id: 'T15', name: "Team 15 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T15` };
  const lbStartTeam16 = playoffTeams[15] || { id: 'T16', name: "Team 16 (LB)", players: [], status: "Active", logoUrl: `https://placehold.co/32x32.png?text=T16` };


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
  const trueLBR1M1Winner = lbStartTeam9;   const trueLBR1M1Loser = lbStartTeam10;
  const trueLBR1M2Winner = lbStartTeam11;  const trueLBR1M2Loser = lbStartTeam12;
  const trueLBR1M3Winner = lbStartTeam13;  const trueLBR1M3Loser = lbStartTeam14;
  const trueLBR1M4Winner = lbStartTeam15;  const trueLBR1M4Loser = lbStartTeam16;

  // LB R2 (Merger: Losers of UB R1 vs Winners of true LB R1)
  const lbR2M1Winner = ubR1M1Loser;      // Herbatka (UBR1M1Loser) wins vs Gejmingowa (TrueLBR1M1Winner)
  const lbR2M2Winner = ubR1M2Loser;      // Bobr (UBR1M2Loser) wins vs Placki (TrueLBR1M2Winner)
  const lbR2M3Winner = ubR1M3Loser;      // DBS (UBR1M3Loser) wins vs Equitantes (TrueLBR1M3Winner)
  const lbR2M4Winner = ubR1M4Loser;      // Uchodzcy (UBR1M4Loser) wins vs Ofensywny (TrueLBR1M4Winner) - corrected from previous step

  // LB R3 (Winners of LB R2 play)
  const lbR3M1Winner = lbR2M1Winner; // Herbatka wins vs Bobr
  const lbR3M2Winner = lbR2M3Winner; // DBS wins vs Uchodzcy 
  
  // LB R4 (Merger: Losers of UB R2 vs Winners of LB R3)
  const lbR4M1Winner = ubR2M1LoserForLB; // Chestnut's (UBR2M1LoserForLB) wins vs Herbatka (LBR3M1Winner)
  const lbR4M2Winner = ubR2M2LoserForLB; // Gimnazjum (UBR2M2LoserForLB) wins vs DBS (LBR3M2Winner)

  // LB R5 (Winners of LB R4 play)
  const lbR5M1Winner = lbR4M1Winner; // Chestnut's wins vs Gimnazjum 

  // LB Final (Winner of LB R5 vs Loser of UB Final)
  const lbFinalMatchWinner = ubFinalLoserForLB; // Wina (UBFinalLoserForLB) wins vs Chestnut's (LBR5M1Winner)

  // Grand Final
  const grandFinalWinner = ubFinalWinner; // Kebab wins vs Wina


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
          <div className="min-w-[1200px] grid grid-cols-[repeat(5,minmax(200px,1fr))] grid-rows-[auto_repeat(8,minmax(4rem,auto))] gap-x-4 gap-y-1">
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
          <div className="min-w-[1450px] grid grid-cols-[repeat(6,minmax(200px,1fr))] grid-rows-[auto_repeat(8,minmax(4rem,auto))] gap-x-4 gap-y-1">
            {/* Round Titles */}
            <div className="col-start-1 row-start-9"><RoundTitle title="LB R1 (BO1)" icon={Skull} /></div>
            <div className="col-start-2 row-start-9"><RoundTitle title="LB R2 (BO1)" icon={Skull} /></div>
            <div className="col-start-3 row-start-9"><RoundTitle title="LB R3 (BO3)" icon={Swords} /></div>
            <div className="col-start-4 row-start-9"><RoundTitle title="LB R4 (BO3)" icon={Swords} /></div>
            <div className="col-start-5 row-start-9"><RoundTitle title="LB R5 (BO3)" icon={Handshake} /></div>
            <div className="col-start-6 row-start-9"><RoundTitle title="LB Final (BO3)" icon={Star} /></div>

            {/* True LB R1 Matches (Column 1) */}
            <div className="row-start-10 col-start-1"><MatchCard matchId="TLB-R1-M1" format="BO1" p1={{name: lbStartTeam9.name, score:1, isWinner: true, logoUrl: lbStartTeam9.logoUrl}} p2={{name: lbStartTeam10.name, score:0, logoUrl: lbStartTeam10.logoUrl}} /></div>
            <div className="row-start-12 col-start-1"><MatchCard matchId="TLB-R1-M2" format="BO1" p1={{name: lbStartTeam11.name, score:1, isWinner: true, logoUrl: lbStartTeam11.logoUrl}} p2={{name: lbStartTeam12.name, score:0, logoUrl: lbStartTeam12.logoUrl}} /></div>
            <div className="row-start-14 col-start-1"><MatchCard matchId="TLB-R1-M3" format="BO1" p1={{name: lbStartTeam13.name, score:1, isWinner: true, logoUrl: lbStartTeam13.logoUrl}} p2={{name: lbStartTeam14.name, score:0, logoUrl: lbStartTeam14.logoUrl}} /></div>
            <div className="row-start-16 col-start-1"><MatchCard matchId="TLB-R1-M4" format="BO1" p1={{name: lbStartTeam15.name, score:1, isWinner: true, logoUrl: lbStartTeam15.logoUrl}} p2={{name: lbStartTeam16.name, score:0, logoUrl: lbStartTeam16.logoUrl}} /></div>

            {/* LB R2 Matches (Merger) (Column 2) */}
            <div className="row-start-10 col-start-2"><MatchCard matchId="LB-R2-M1" format="BO1" p1={{name: ubR1M1Loser.name, score:1, isWinner: true, logoUrl: ubR1M1Loser.logoUrl}} p2={{name: trueLBR1M1Winner.name, score:0, logoUrl: trueLBR1M1Winner.logoUrl}}/></div>
            <div className="row-start-12 col-start-2"><MatchCard matchId="LB-R2-M2" format="BO1" p1={{name: ubR1M2Loser.name, score:1, isWinner: true, logoUrl: ubR1M2Loser.logoUrl}} p2={{name: trueLBR1M2Winner.name, score:0, logoUrl: trueLBR1M2Winner.logoUrl}}/></div>
            <div className="row-start-14 col-start-2"><MatchCard matchId="LB-R2-M3" format="BO1" p1={{name: ubR1M3Loser.name, score:1, isWinner: true, logoUrl: ubR1M3Loser.logoUrl}} p2={{name: trueLBR1M3Winner.name, score:0, logoUrl: trueLBR1M3Winner.logoUrl}}/></div>
            <div className="row-start-16 col-start-2"><MatchCard matchId="LB-R2-M4" format="BO1" p1={{name: ubR1M4Loser.name, score:1, isWinner: true, logoUrl: ubR1M4Loser.logoUrl}} p2={{name: trueLBR1M4Winner.name, score:0, logoUrl: trueLBR1M4Winner.logoUrl}}/></div>

            {/* LB R3 Matches (Column 3) */}
            <div className="row-start-11 col-start-3"><MatchCard matchId="LB-R3-M1" format="BO3" p1={{name: lbR2M1Winner.name, score:2, isWinner: true, logoUrl: lbR2M1Winner.logoUrl}} p2={{name: lbR2M2Winner.name, score:1, logoUrl: lbR2M2Winner.logoUrl}} /></div>
            <div className="row-start-15 col-start-3"><MatchCard matchId="LB-R3-M2" format="BO3" p1={{name: lbR2M3Winner.name, score:2, isWinner: true, logoUrl: lbR2M3Winner.logoUrl}} p2={{name: lbR2M4Winner.name, score:0, logoUrl: lbR2M4Winner.logoUrl}} /></div>

            {/* LB R4 Matches (Merger) (Column 4) */}
            <div className="row-start-11 col-start-4"><MatchCard matchId="LB-R4-M1" format="BO3" p1={{name: ubR2M1LoserForLB.name, score:2, isWinner: true, logoUrl: ubR2M1LoserForLB.logoUrl}} p2={{name: lbR3M1Winner.name, score:1, logoUrl: lbR3M1Winner.logoUrl}} /></div>
            <div className="row-start-15 col-start-4"><MatchCard matchId="LB-R4-M2" format="BO3" p1={{name: ubR2M2LoserForLB.name, score:2, isWinner: true, logoUrl: ubR2M2LoserForLB.logoUrl}} p2={{name: lbR3M2Winner.name, score:1, logoUrl: lbR3M2Winner.logoUrl}} /></div>

            {/* LB R5 Match (Column 5) */}
            <div className="row-start-13 col-start-5"><MatchCard matchId="LB-R5-M1" format="BO3" p1={{name: lbR4M1Winner.name, score:0, logoUrl: lbR4M1Winner.logoUrl}} p2={{name: lbR4M2Winner.name, score:2, isWinner: true, logoUrl: lbR4M2Winner.logoUrl}} /></div>
            
            {/* LB Final Match (Column 6) */}
            <div className="row-start-13 col-start-6"><MatchCard matchId="LB-Final-M1" format="BO3" p1={{name: lbR5M1Winner.name, score:1, logoUrl: lbR5M1Winner.logoUrl}} p2={{name: ubFinalLoserForLB.name, score:2, isWinner: true, logoUrl: ubFinalLoserForLB.logoUrl}} /></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

