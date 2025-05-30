"use client";

import * as React from "react";
import Image from "next/image"; // Added import for Image
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Trophy, Users, Shield, Star, Users2, Home, Skull, Swords, Handshake } from "lucide-react";
import { mockTeams } from "@/lib/mock-data";
import type { Team } from "@/lib/definitions";
import { cn } from "@/lib/utils";

interface MatchParticipantProps {
  name?: string;
  seed?: number;
  score?: number;
  isWinner?: boolean;
  logoUrl?: string;
}

const MatchParticipant: React.FC<MatchParticipantProps> = ({ name, seed, score, isWinner, logoUrl }) => {
  return (
    <div className={cn(
      "flex items-center justify-between text-sm h-8 px-2",
      isWinner ? "font-bold text-primary" : "text-muted-foreground"
    )}>
      <div className="flex items-center space-x-2">
        {logoUrl && (
          <Image src={logoUrl} alt={`${name} logo`} width={16} height={16} className="h-4 w-4 rounded-sm object-cover" />
        )}
        <span className="truncate" title={name}>{name || 'TBD'}</span>
        {seed && <span className="text-xs text-muted-foreground/70">({seed})</span>}
      </div>
      {typeof score === 'number' && <span className="font-mono">{score}</span>}
    </div>
  );
};

interface MatchCardProps {
  matchId: string;
  p1: MatchParticipantProps;
  p2: MatchParticipantProps;
  isPlaceholder?: boolean;
  placeholderText?: string;
  boFormat?: string;
}

const MatchCard: React.FC<MatchCardProps> = ({ matchId, p1, p2, isPlaceholder, placeholderText, boFormat }) => {
  return (
    <div className={cn(
      "bg-card border border-border rounded-md shadow-sm flex flex-col justify-between min-w-[180px] h-20 p-2 text-xs",
      isPlaceholder && "border-dashed opacity-60"
    )}>
      {isPlaceholder ? (
        <div className="flex items-center justify-center h-full text-muted-foreground italic">
          {placeholderText || matchId}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center text-muted-foreground/80 mb-1">
            <span>{matchId.toUpperCase()}</span>
            {boFormat && <span className="text-primary font-semibold">{boFormat}</span>}
          </div>
          <MatchParticipant {...p1} />
          <div className="border-t border-border/50 my-0.5"></div>
          <MatchParticipant {...p2} />
        </>
      )}
    </div>
  );
};

const RoundTitle: React.FC<{ title: string; icon?: React.ElementType }> = ({ title, icon: Icon }) => (
  <div className="flex items-center justify-center text-center text-sm font-semibold text-accent mb-2 whitespace-nowrap">
    {Icon && <Icon className="h-4 w-4 mr-2" />}
    {title}
  </div>
);


export default function PlayoffsPage() {
  // Simplified mock data for layout demonstration
  const teams = mockTeams.slice(0, 16).map((team, index) => ({
    ...team,
    seed: index + 1,
  }));

  // Simulated bracket data (structure from your image)
  // Upper Bracket
  const upperBracketR1Data = [
    { id: 'ub-r1-m1', p1: teams[0], p2: teams[15], score1: 2, score2: 0, winner: teams[0] }, // Kebab u Dassem'a
    { id: 'ub-r1-m2', p1: teams[7], p2: teams[8], score1: 0, score2: 2, winner: teams[8] },   // Herbatka u Bratka
    { id: 'ub-r1-m3', p1: teams[3], p2: teams[12], score1: 2, score2: 1, winner: teams[3] },  // Bóbr Honor Włoszczyzna
    { id: 'ub-r1-m4', p1: teams[4], p2: teams[11], score1: 0, score2: 2, winner: teams[11] }, // Dont Ban Spectre
  ];

  const ubR1_W_kebab = upperBracketR1Data[0].winner;
  const ubR1_L_team16 = upperBracketR1Data[0].p2; // Team 16
  const ubR1_W_herbatka = upperBracketR1Data[1].winner;
  const ubR1_L_team8 = upperBracketR1Data[1].p1; // Team 8
  const ubR1_W_bobr = upperBracketR1Data[2].winner;
  const ubR1_L_team13 = upperBracketR1Data[2].p2; // Team 13
  const ubR1_W_dbs = upperBracketR1Data[3].winner;
  const ubR1_L_chestnuts = upperBracketR1Data[3].p1; // Chestnut's (Team 5)

  const upperBracketR2Data = [
    { id: 'ub-r2-m1', p1: ubR1_W_kebab, p2: ubR1_W_herbatka, score1: 2, score2: 0, winner: ubR1_W_kebab },
    { id: 'ub-r2-m2', p1: ubR1_W_bobr, p2: ubR1_W_dbs, score1: 1, score2: 2, winner: ubR1_W_dbs },
  ];
  const ubR2_W_kebab = upperBracketR2Data[0].winner;
  const ubR2_L_herbatka = upperBracketR2Data[0].p2;
  const ubR2_W_dbs = upperBracketR2Data[1].winner;
  const ubR2_L_bobr = upperBracketR2Data[1].p1;

  const upperBracketFinalData = {
    id: 'ub-final', p1: ubR2_W_kebab, p2: ubR2_W_dbs, score1: 2, score2: 1, winner: ubR2_W_kebab
  };
  const ubFinal_W_kebab = upperBracketFinalData.winner;
  const ubFinal_L_dbs = upperBracketFinalData.p2;

  // Lower Bracket Initial Teams (Teams 9-16 from your description, assuming they are teams[8] to teams[15] here)
  // Actual teams playing in initial LB round.
  const initialLowerBracketTeams = teams.slice(8, 16); // Teams that START in LB R1

  const trueLowerBracketR1Data = [ // 4 matches for 8 teams starting in LB
    { id: 'lb-r1-m1', p1: initialLowerBracketTeams[0], p2: initialLowerBracketTeams[1], score1: 1, score2: 0, winner: initialLowerBracketTeams[0] }, // Gejmingowa Ekstaza Janusz
    { id: 'lb-r1-m2', p1: initialLowerBracketTeams[2], p2: initialLowerBracketTeams[3], score1: 1, score2: 0, winner: initialLowerBracketTeams[2] }, // Placki 🏆
    { id: 'lb-r1-m3', p1: initialLowerBracketTeams[4], p2: initialLowerBracketTeams[5], score1: 0, score2: 1, winner: initialLowerBracketTeams[5] }, // Equitantes cum Meretricibus Dantur mercedes
    { id: 'lb-r1-m4', p1: initialLowerBracketTeams[6], p2: initialLowerBracketTeams[7], score1: 0, score2: 1, winner: initialLowerBracketTeams[7] }, // Ofensywny Glimmer
  ];

  const lbR1_W_gejmingowa = trueLowerBracketR1Data[0].winner;
  const lbR1_W_placki = trueLowerBracketR1Data[1].winner;
  const lbR1_W_equitantes = trueLowerBracketR1Data[2].winner;
  const lbR1_W_ofensywny = trueLowerBracketR1Data[3].winner;

  // Lower Bracket Round 2 (Merger Round: UB R1 Losers vs True LB R1 Winners)
  const lowerBracketR2Data = [
    { id: 'lb-r2-m1', p1: ubR1_L_team16, p2: lbR1_W_gejmingowa, score1: 0, score2: 1, winner: lbR1_W_gejmingowa },
    { id: 'lb-r2-m2', p1: ubR1_L_team8, p2: lbR1_W_placki, score1: 0, score2: 1, winner: lbR1_W_placki },
    { id: 'lb-r2-m3', p1: ubR1_L_team13, p2: lbR1_W_equitantes, score1: 1, score2: 0, winner: ubR1_L_team13 },
    { id: 'lb-r2-m4', p1: ubR1_L_chestnuts, p2: lbR1_W_ofensywny, score1: 1, score2: 0, winner: ubR1_L_chestnuts },
  ];

  const lbR2_W1 = lowerBracketR2Data[0].winner;
  const lbR2_W2 = lowerBracketR2Data[1].winner;
  const lbR2_W3 = lowerBracketR2Data[2].winner;
  const lbR2_W4 = lowerBracketR2Data[3].winner;

  // Lower Bracket Round 3
  const lowerBracketR3Data = [
    { id: 'lb-r3-m1', p1: lbR2_W1, p2: lbR2_W2, score1: 2, score2: 1, winner: lbR2_W1 },
    { id: 'lb-r3-m2', p1: lbR2_W3, p2: lbR2_W4, score1: 0, score2: 2, winner: lbR2_W4 },
  ];
  const lbR3_W1 = lowerBracketR3Data[0].winner;
  const lbR3_W2 = lowerBracketR3Data[1].winner;

  // Lower Bracket Round 4 (Merger Round: UB R2 Losers vs LB R3 Winners)
  const lowerBracketR4Data = [
    { id: 'lb-r4-m1', p1: ubR2_L_herbatka, p2: lbR3_W1, score1: 1, score2: 2, winner: lbR3_W1 }, // Gejmingowa
    { id: 'lb-r4-m2', p1: ubR2_L_bobr, p2: lbR3_W2, score1: 2, score2: 0, winner: ubR2_L_bobr },  // Bóbr
  ];
  const lbR4_W1 = lowerBracketR4Data[0].winner; // Gejmingowa
  const lbR4_W2 = lowerBracketR4Data[1].winner; // Bóbr

  // Lower Bracket Round 5 (LB Quarterfinals - Winners of LB R4)
  const lowerBracketR5Data = {
    id: 'lb-r5-m1', p1: lbR4_W1, p2: lbR4_W2, score1: 2, score2: 0, winner: lbR4_W1 // Gejmingowa
  };
  const lbR5_W = lowerBracketR5Data.winner; // Gejmingowa

  // Lower Bracket Final (LB Semifinal Winner vs UB Final Loser)
  const lowerBracketFinalData = {
    id: 'lb-final', p1: lbR5_W, p2: ubFinal_L_dbs, score1: 2, score2: 1, winner: lbR5_W // Gejmingowa
  };
  const lbFinal_W = lowerBracketFinalData.winner; // Gejmingowa

  // Grand Final
  const grandFinalData = {
    id: 'grand-final', p1: ubFinal_W_kebab, p2: lbFinal_W, score1: 3, score2: 1, winner: ubFinal_W_kebab
  };
  const champion = grandFinalData.winner;

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <GitBranch className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Playoff Bracket</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Follow the journey to the championship!
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Upper Bracket & Finals Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center justify-center">
            <Users className="h-6 w-6 mr-2" /> Upper Bracket & Finals
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-2 md:p-4">
          <div className="min-w-[572px] grid grid-cols-[repeat(3,minmax(180px,1fr))] grid-rows-[auto_repeat(8,minmax(4rem,auto))] gap-x-4 gap-y-1 items-start">
            {/* UB Round 1 */}
            <div className="col-start-1 row-start-1"><RoundTitle title="UB R1 (BO3)" icon={Users2} /></div>
            {upperBracketR1Data.map((match, index) => (
              <div key={match.id} className={cn("col-start-1", `row-start-${2 + index * 2}`)}>
                <MatchCard matchId={match.id} p1={{ name: match.p1.name, seed: match.p1.seed, score: match.score1, isWinner: match.winner.id === match.p1.id, logoUrl: match.p1.logoUrl }} p2={{ name: match.p2.name, seed: match.p2.seed, score: match.score2, isWinner: match.winner.id === match.p2.id, logoUrl: match.p2.logoUrl }} boFormat="BO3" />
              </div>
            ))}

            {/* UB Round 2 */}
            <div className="col-start-2 row-start-1"><RoundTitle title="UB R2 (BO3)" icon={Shield} /></div>
            {upperBracketR2Data.map((match, index) => (
              <div key={match.id} className={cn("col-start-2", `row-start-${3 + index * 4}`)}>
                <MatchCard matchId={match.id} p1={{ name: match.p1.name, seed: match.p1.seed, score: match.score1, isWinner: match.winner.id === match.p1.id, logoUrl: match.p1.logoUrl }} p2={{ name: match.p2.name, seed: match.p2.seed, score: match.score2, isWinner: match.winner.id === match.p2.id, logoUrl: match.p2.logoUrl }} boFormat="BO3" />
              </div>
            ))}

            {/* UB Final */}
            <div className="col-start-3 row-start-1"><RoundTitle title="UB Final (BO3)" icon={Star} /></div>
            <div className="col-start-3 row-start-5">
              <MatchCard matchId={upperBracketFinalData.id} p1={{ name: upperBracketFinalData.p1.name, seed: upperBracketFinalData.p1.seed, score: upperBracketFinalData.score1, isWinner: upperBracketFinalData.winner.id === upperBracketFinalData.p1.id, logoUrl: upperBracketFinalData.p1.logoUrl }} p2={{ name: upperBracketFinalData.p2.name, seed: upperBracketFinalData.p2.seed, score: upperBracketFinalData.score2, isWinner: upperBracketFinalData.winner.id === upperBracketFinalData.p2.id, logoUrl: upperBracketFinalData.p2.logoUrl }} boFormat="BO3" />
            </div>
           
            {/* Grand Final & Champion moved from here to a separate card below */}
          </div>
        </CardContent>
      </Card>
      
      {/* Lower Bracket Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive flex items-center justify-center">
             <Home className="h-6 w-6 mr-2"/> {/* Using Home as a generic LB icon */}
            Lower Bracket
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-2 md:p-4">
          <div className="min-w-[1160px] grid grid-cols-[repeat(6,minmax(180px,1fr))] grid-rows-[auto_repeat(16,minmax(4rem,auto))] gap-x-4 gap-y-1 items-start">
            {/* True LB Round 1 */}
            <div className="col-start-1 row-start-9"><RoundTitle title="LB R1 (BO1)" icon={Users2} /></div>
            {trueLowerBracketR1Data.map((match, index) => (
              <div key={match.id} className={cn("col-start-1", `row-start-${10 + index * 2}`)}>
                <MatchCard matchId={match.id} p1={{ name: match.p1.name, seed: match.p1.seed, score: match.score1, isWinner: match.winner.id === match.p1.id, logoUrl: match.p1.logoUrl }} p2={{ name: match.p2.name, seed: match.p2.seed, score: match.score2, isWinner: match.winner.id === match.p2.id, logoUrl: match.p2.logoUrl }} boFormat="BO1" />
              </div>
            ))}

            {/* LB Round 2 (Merger) */}
            <div className="col-start-2 row-start-9"><RoundTitle title="LB R2 (BO1)" icon={Swords} /></div>
            {lowerBracketR2Data.map((match, index) => (
              <div key={match.id} className={cn("col-start-2", `row-start-${10 + index * 2}`)}>
                <MatchCard matchId={match.id} p1={{ name: match.p1.name, seed: match.p1.seed, score: match.score1, isWinner: match.winner.id === match.p1.id, logoUrl: match.p1.logoUrl }} p2={{ name: match.p2.name, seed: match.p2.seed, score: match.score2, isWinner: match.winner.id === match.p2.id, logoUrl: match.p2.logoUrl }} boFormat="BO1" />
              </div>
            ))}

            {/* LB Round 3 */}
            <div className="col-start-3 row-start-9"><RoundTitle title="LB R3 (BO3)" icon={Handshake} /></div>
            {lowerBracketR3Data.map((match, index) => (
              <div key={match.id} className={cn("col-start-3", `row-start-${11 + index * 4}`)}>
                <MatchCard matchId={match.id} p1={{ name: match.p1.name, seed: match.p1.seed, score: match.score1, isWinner: match.winner.id === match.p1.id, logoUrl: match.p1.logoUrl }} p2={{ name: match.p2.name, seed: match.p2.seed, score: match.score2, isWinner: match.winner.id === match.p2.id, logoUrl: match.p2.logoUrl }} boFormat="BO3" />
              </div>
            ))}

            {/* LB Round 4 */}
            <div className="col-start-4 row-start-9"><RoundTitle title="LB R4 (BO3)" icon={Shield} /></div>
             {lowerBracketR4Data.map((match, index) => (
              <div key={match.id} className={cn("col-start-4", `row-start-${11 + index * 4}`)}>
                <MatchCard matchId={match.id} p1={{ name: match.p1.name, seed: match.p1.seed, score: match.score1, isWinner: match.winner.id === match.p1.id, logoUrl: match.p1.logoUrl }} p2={{ name: match.p2.name, seed: match.p2.seed, score: match.score2, isWinner: match.winner.id === match.p2.id, logoUrl: match.p2.logoUrl }} boFormat="BO3" />
              </div>
            ))}

            {/* LB Round 5 */}
            <div className="col-start-5 row-start-9"><RoundTitle title="LB R5 (BO3)" icon={Star} /></div>
            <div className="col-start-5 row-start-13">
                <MatchCard matchId={lowerBracketR5Data.id} p1={{ name: lowerBracketR5Data.p1.name, seed: lowerBracketR5Data.p1.seed, score: lowerBracketR5Data.score1, isWinner: lowerBracketR5Data.winner.id === lowerBracketR5Data.p1.id, logoUrl: lowerBracketR5Data.p1.logoUrl }} p2={{ name: lowerBracketR5Data.p2.name, seed: lowerBracketR5Data.p2.seed, score: lowerBracketR5Data.score2, isWinner: lowerBracketR5Data.winner.id === lowerBracketR5Data.p2.id, logoUrl: lowerBracketR5Data.p2.logoUrl }} boFormat="BO3" />
            </div>
            
            {/* LB Final */}
            <div className="col-start-6 row-start-9"><RoundTitle title="LB Final (BO3)" icon={Trophy} /></div>
            <div className="col-start-6 row-start-13">
                <MatchCard matchId={lowerBracketFinalData.id} p1={{ name: lowerBracketFinalData.p1.name, seed: lowerBracketFinalData.p1.seed, score: lowerBracketFinalData.score1, isWinner: lowerBracketFinalData.winner.id === lowerBracketFinalData.p1.id, logoUrl: lowerBracketFinalData.p1.logoUrl }} p2={{ name: lowerBracketFinalData.p2.name, seed: lowerBracketFinalData.p2.seed, score: lowerBracketFinalData.score2, isWinner: lowerBracketFinalData.winner.id === lowerBracketFinalData.p2.id, logoUrl: lowerBracketFinalData.p2.logoUrl }} boFormat="BO3" />
            </div>
          </div>
        </CardContent>
      </Card>

       {/* Grand Final & Champion Card */}
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-amber-400 flex items-center justify-center">
            <Trophy className="h-6 w-6 mr-2 text-amber-400" /> Grand Final & Champion
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-2 md:p-4">
          <div className="min-w-[376px] grid grid-cols-[repeat(2,minmax(180px,1fr))] grid-rows-[auto_repeat(8,minmax(4rem,auto))] gap-x-4 gap-y-1 items-start">
            {/* Grand Final */}
            <div className="col-start-1 row-start-1"><RoundTitle title="Grand Final (BO5)" icon={Trophy} /></div>
            <div className="col-start-1 row-start-2">
              <MatchCard matchId={grandFinalData.id} p1={{ name: grandFinalData.p1.name, seed: grandFinalData.p1.seed, score: grandFinalData.score1, isWinner: grandFinalData.winner.id === grandFinalData.p1.id, logoUrl: grandFinalData.p1.logoUrl }} p2={{ name: grandFinalData.p2.name, seed: grandFinalData.p2.seed, score: grandFinalData.score2, isWinner: grandFinalData.winner.id === grandFinalData.p2.id, logoUrl: grandFinalData.p2.logoUrl }} boFormat="BO5" />
            </div>

            {/* Champion Display */}
            <div className="col-start-2 row-start-1"><RoundTitle title="Tournament Champion" icon={Trophy} /></div>
            <div className="col-start-2 row-start-2 flex flex-col items-center justify-center bg-card border border-amber-400 rounded-md shadow-lg p-4 h-20">
              <Trophy className="h-6 w-6 text-amber-400 mb-1" />
              <p className="text-lg font-bold text-amber-400 truncate" title={champion.name}>{champion.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
