
"use client";

import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { mockTeams } from '@/lib/mock-data';
import type { Team, PickEmSelections } from '@/lib/definitions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ClipboardCheck, Lock, Unlock, ArrowRight, Download, Users, GitBranch, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const UPPER_BRACKET_SIZE = 8;
const LOWER_BRACKET_SIZE = 8;
const TOTAL_PICKS = UPPER_BRACKET_SIZE + LOWER_BRACKET_SIZE;

const initialBracketPicks: PickEmSelections['bracketPicks'] = {
  // Upper Bracket Round 1
  'UB-R1-M1': null, 'UB-R1-M2': null, 'UB-R1-M3': null, 'UB-R1-M4': null,
  // Lower Bracket Round 1
  'LB-R1-M1': null, 'LB-R1-M2': null, 'LB-R1-M3': null, 'LB-R1-M4': null,
  // Upper Bracket Round 2
  'UB-R2-M1': null, 'UB-R2-M2': null,
  // Lower Bracket Round 2
  'LB-R2-M1': null, 'LB-R2-M2': null, 'LB-R2-M3': null, 'LB-R2-M4': null,
  // Lower Bracket Round 3
  'LB-R3-M1': null, 'LB-R3-M2': null,
  // Upper Bracket Final
  'UB-Final': null,
  // Lower Bracket Round 4
  'LB-R4-M1': null,
  // Lower Bracket Final
  'LB-Final': null,
  // Grand Final
  'Grand-Final': null
};

// Main Component
export default function PickEmPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [picks, setPicks] = useState<PickEmSelections>({
    upperBracket: [],
    lowerBracket: [],
    bracketPicks: initialBracketPicks,
  });
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [step, setStep] = useState<'groups' | 'bracket'>('groups');

  const teamPool = useMemo(() => 
    mockTeams.filter(team => ![...picks.upperBracket, ...picks.lowerBracket].includes(team.id)),
    [picks.upperBracket, picks.lowerBracket]
  );
  
  const getTeamById = (teamId: string): Team | undefined => mockTeams.find(t => t.id === teamId);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    const sourceDroppableId = source.droppableId;
    const destDroppableId = destination.droppableId;
    const movedTeamId = result.draggableId;

    let newUpper = [...picks.upperBracket];
    let newLower = [...picks.lowerBracket];

    // Removing from source
    if (sourceDroppableId === 'upperBracket') newUpper.splice(source.index, 1);
    if (sourceDroppableId === 'lowerBracket') newLower.splice(source.index, 1);

    // Adding to destination
    if (destDroppableId === 'upperBracket' && newUpper.length < UPPER_BRACKET_SIZE) {
      newUpper.splice(destination.index, 0, movedTeamId);
    } else if (destDroppableId === 'lowerBracket' && newLower.length < LOWER_BRACKET_SIZE) {
      newLower.splice(destination.index, 0, movedTeamId);
    } else if (sourceDroppableId !== 'teamPool') {
      // If drop fails (e.g., list full), return item to original list
      if (sourceDroppableId === 'upperBracket') newUpper.splice(source.index, 0, movedTeamId);
      if (sourceDroppableId === 'lowerBracket') newLower.splice(source.index, 0, movedTeamId);
    }

    setPicks(prev => ({ ...prev, upperBracket: newUpper, lowerBracket: newLower }));
  };
  
  const handleBracketPick = (matchId: string, winnerId: string | null) => {
      setPicks(prev => ({
          ...prev,
          bracketPicks: {
              ...prev.bracketPicks,
              [matchId]: winnerId
          }
      }));
  };
  
  const isStep1Complete = picks.upperBracket.length === UPPER_BRACKET_SIZE && picks.lowerBracket.length === LOWER_BRACKET_SIZE;
  const isBracketComplete = Object.values(picks.bracketPicks).every(pick => pick !== null);

  const resetPicks = () => setPicks({ upperBracket: [], lowerBracket: [], bracketPicks: initialBracketPicks });
  const resetBracket = () => setPicks(prev => ({ ...prev, bracketPicks: initialBracketPicks }));
  
  const handleLogin = () => setIsLoggedIn(true);

  if (!isLoggedIn) {
    return (
      <Card className="max-w-2xl mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-accent">Join the Pick'em Challenge!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">Login with Discord to make your predictions.</p>
          <Button onClick={handleLogin} size="lg">Login (Simulated)</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <ClipboardCheck className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Pick'em Challenge</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Predict the tournament outcome and prove your dota knowledge!
          </CardDescription>
          <div className="pt-4">
            <Button onClick={() => setIsDeadlinePassed(p => !p)} variant="outline">
              {isDeadlinePassed ? <Unlock className="mr-2" /> : <Lock className="mr-2" />}
              Simulate Deadline {isDeadlinePassed ? 'Open' : 'Passed'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isDeadlinePassed ? (
         <Card className="text-center">
            <CardHeader>
                <CardTitle className="flex items-center justify-center text-destructive">
                    <Lock className="mr-2" /> Predictions are Locked!
                </CardTitle>
                <CardDescription>The deadline has passed. Good luck with your picks!</CardDescription>
            </CardHeader>
            <CardContent>
                 <p className="text-muted-foreground mb-4">You can download a copy of your selections.</p>
                 <Button onClick={() => alert('Downloading your picks... (Simulated)')}>
                     <Download className="mr-2"/> Download My Picks
                 </Button>
            </CardContent>
         </Card>
      ) : (
        <>
            <HowToPlay />

            {step === 'groups' ? (
              <GroupStagePicker 
                  onDragEnd={onDragEnd} 
                  teamPool={teamPool} 
                  picks={picks}
                  getTeamById={getTeamById}
                  resetPicks={resetPicks}
              />
            ) : (
               <BracketPredictor 
                  picks={picks} 
                  handleBracketPick={handleBracketPick} 
                  getTeamById={getTeamById} 
                  resetBracketPicks={resetBracket}
                />
            )}

            <Card className="shadow-lg">
                <CardFooter className="p-4 flex flex-col md:flex-row justify-center items-center gap-4">
                    {step === 'groups' ? (
                        <Button size="lg" onClick={() => setStep('bracket')} disabled={!isStep1Complete}>
                            Proceed to Bracket Prediction <ArrowRight className="ml-2"/>
                        </Button>
                    ) : (
                        <>
                           <Button size="lg" variant="secondary" onClick={() => setStep('groups')}>
                               Back to Group Picks
                           </Button>
                           <Button size="lg" disabled={!isBracketComplete} onClick={() => alert('Picks submitted!')}>
                               Lock In All Predictions
                           </Button>
                        </>
                    )}
                </CardFooter>
            </Card>
        </>
      )}
    </div>
  );
}

// Sub-Components
const HowToPlay = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-2xl text-accent">How to Play</CardTitle>
    </CardHeader>
    <CardContent>
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Step 1: Predict Group Stage Qualifiers</AccordionTrigger>
          <AccordionContent>
            From the pool of 24 registered teams, drag and drop 8 teams into the "Upper Bracket" list and 8 teams into the "Lower Bracket" list. These are the teams you predict will advance to the playoffs.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Step 2: Predict the Playoff Bracket</AccordionTrigger>
          <AccordionContent>
            Once you've selected your 16 teams, you'll be presented with a full double-elimination bracket. Click on the team you think will win each match to advance them to the next round. Fill out the entire bracket, all the way to the Grand Final champion.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Step 3: Lock In Your Picks</AccordionTrigger>
          <AccordionContent>
            After filling out the bracket, click the "Lock In All Predictions" button. Make sure your picks are final, as they cannot be changed after the deadline. An admin will later be able to download a spreadsheet of all user predictions for scoring.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
);

const DroppableList = ({ id, title, teams, getTeamById, requiredCount }: { id: string; title: string; teams: string[]; getTeamById: (id: string) => Team | undefined; requiredCount: number }) => (
    <Card className="flex-1 min-w-[280px] bg-muted/20">
        <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between items-center">
                <span>{title}</span>
                <Badge variant={teams.length === requiredCount ? "secondary" : "outline"}>{teams.length} / {requiredCount}</Badge>
            </CardTitle>
        </CardHeader>
        <Droppable droppableId={id}>
            {(provided, snapshot) => (
                <CardContent
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn("h-full min-h-[200px] rounded-md p-2 transition-colors", snapshot.isDraggingOver ? "bg-primary/10" : "")}
                >
                    {teams.length > 0 ? teams.map((teamId, index) => {
                        const team = getTeamById(teamId);
                        if (!team) return null;
                        return (
                            <Draggable key={team.id} draggableId={team.id} index={index}>
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                        <TeamCardItem team={team} />
                                    </div>
                                )}
                            </Draggable>
                        );
                    }) : (
                       <div className="flex items-center justify-center h-full text-muted-foreground italic">Drop teams here</div>
                    )}
                    {provided.placeholder}
                </CardContent>
            )}
        </Droppable>
    </Card>
);

const TeamCardItem = ({ team }: { team: Team }) => (
    <div className="p-2 mb-2 bg-card rounded-md shadow-sm flex items-center space-x-3">
        <Image src={team.logoUrl!} alt={team.name} width={24} height={24} className="rounded-sm" data-ai-hint="team logo"/>
        <span className="font-medium text-sm truncate">{team.name}</span>
    </div>
);

const GroupStagePicker = ({ onDragEnd, teamPool, picks, getTeamById, resetPicks }: {
    onDragEnd: (result: DropResult) => void;
    teamPool: Team[];
    picks: PickEmSelections;
    getTeamById: (id: string) => Team | undefined;
    resetPicks: () => void;
}) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-2xl text-primary flex items-center"><ListChecks className="mr-3" />Step 1: Predict The Qualifiers</CardTitle>
            <CardDescription>Drag teams from the pool into the bracket slots. Pick 8 for Upper and 8 for Lower.</CardDescription>
        </CardHeader>
        <CardContent>
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex flex-col lg:flex-row gap-4">
                    <Card className="w-full lg:w-1/4">
                        <CardHeader className="pb-2"><CardTitle className="text-lg">Team Pool ({teamPool.length})</CardTitle></CardHeader>
                        <Droppable droppableId="teamPool">
                            {(provided) => (
                                <ScrollArea
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="h-[400px] p-2"
                                >
                                    {teamPool.map((team, index) => (
                                        <Draggable key={team.id} draggableId={team.id} index={index}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                    <TeamCardItem team={team} />
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </ScrollArea>
                            )}
                        </Droppable>
                    </Card>
                    <div className="flex-1 flex flex-col md:flex-row gap-4">
                        <DroppableList id="upperBracket" title="Upper Bracket Picks" teams={picks.upperBracket} getTeamById={getTeamById} requiredCount={UPPER_BRACKET_SIZE} />
                        <DroppableList id="lowerBracket" title="Lower Bracket Picks" teams={picks.lowerBracket} getTeamById={getTeamById} requiredCount={LOWER_BRACKET_SIZE} />
                    </div>
                </div>
            </DragDropContext>
        </CardContent>
        <CardFooter>
            <Button variant="destructive" onClick={resetPicks}>Reset All Group Picks</Button>
        </CardFooter>
    </Card>
);

const BracketPredictor = ({ picks, handleBracketPick, getTeamById, resetBracketPicks }: { 
    picks: PickEmSelections;
    handleBracketPick: (matchId: string, winnerId: string | null) => void;
    getTeamById: (id: string) => Team | undefined;
    resetBracketPicks: () => void;
 }) => {
    
    // This is a simplified static structure. A real app might fetch this.
    const bracketStructure = {
      ub_r1_m1_winner: picks.bracketPicks['UB-R1-M1'],
      ub_r1_m2_winner: picks.bracketPicks['UB-R1-M2'],
      ub_r1_m3_winner: picks.bracketPicks['UB-R1-M3'],
      ub_r1_m4_winner: picks.bracketPicks['UB-R1-M4'],
      lb_r1_m1_winner: picks.bracketPicks['LB-R1-M1'],
      lb_r1_m2_winner: picks.bracketPicks['LB-R1-M2'],
      lb_r1_m3_winner: picks.bracketPicks['LB-R1-M3'],
      lb_r1_m4_winner: picks.bracketPicks['LB-R1-M4'],
      
      ub_r1_m1_loser: picks.upperBracket[0] === picks.bracketPicks['UB-R1-M1'] ? picks.upperBracket[1] : picks.upperBracket[0],
      ub_r1_m2_loser: picks.upperBracket[2] === picks.bracketPicks['UB-R1-M2'] ? picks.upperBracket[3] : picks.upperBracket[2],
      ub_r1_m3_loser: picks.upperBracket[4] === picks.bracketPicks['UB-R1-M3'] ? picks.upperBracket[5] : picks.upperBracket[4],
      ub_r1_m4_loser: picks.upperBracket[6] === picks.bracketPicks['UB-R1-M4'] ? picks.upperBracket[7] : picks.upperBracket[6],

      ub_r2_m1_winner: picks.bracketPicks['UB-R2-M1'],
      ub_r2_m2_winner: picks.bracketPicks['UB-R2-M2'],
      
      lb_r2_m1_winner: picks.bracketPicks['LB-R2-M1'],
      lb_r2_m2_winner: picks.bracketPicks['LB-R2-M2'],
      lb_r2_m3_winner: picks.bracketPicks['LB-R2-M3'],
      lb_r2_m4_winner: picks.bracketPicks['LB-R2-M4'],
      
      ub_r2_m1_loser: picks.bracketPicks['UB-R1-M1'] === picks.bracketPicks['UB-R2-M1'] ? picks.bracketPicks['UB-R1-M2'] : picks.bracketPicks['UB-R1-M1'],
      ub_r2_m2_loser: picks.bracketPicks['UB-R1-M3'] === picks.bracketPicks['UB-R2-M2'] ? picks.bracketPicks['UB-R1-M4'] : picks.bracketPicks['UB-R1-M3'],
      
      lb_r3_m1_winner: picks.bracketPicks['LB-R3-M1'],
      lb_r3_m2_winner: picks.bracketPicks['LB-R3-M2'],

      ub_final_winner: picks.bracketPicks['UB-Final'],
      ub_final_loser: picks.bracketPicks['UB-R2-M1'] === picks.bracketPicks['UB-Final'] ? picks.bracketPicks['UB-R2-M2'] : picks.bracketPicks['UB-R2-M1'],

      lb_r4_winner: picks.bracketPicks['LB-R4-M1'],

      lb_final_winner: picks.bracketPicks['LB-Final'],
      
      grand_final_winner: picks.bracketPicks['Grand-Final'],
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl text-primary flex items-center"><GitBranch className="mr-3" />Step 2: Predict The Bracket</CardTitle>
                <CardDescription>Click on a team in each match to select them as the winner. They will automatically advance.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                 <div className="grid grid-cols-7 gap-x-8 gap-y-4 min-w-[1000px] items-center">
                    {/* Column Titles */}
                    <h4 className="text-center font-semibold text-accent">UB R1</h4>
                    <h4 className="text-center font-semibold text-accent">LB R1</h4>
                    <h4 className="text-center font-semibold text-accent">UB R2 / LB R2</h4>
                    <h4 className="text-center font-semibold text-accent">UB Final / LB R3</h4>
                    <h4 className="text-center font-semibold text-accent">LB R4</h4>
                    <h4 className="text-center font-semibold text-accent">LB Final</h4>
                    <h4 className="text-center font-semibold text-accent">Grand Final</h4>

                    {/* UB R1 */}
                    <div className="col-start-1 space-y-4">
                        <PredictionMatchCard matchId="UB-R1-M1" teamA={getTeamById(picks.upperBracket[0])} teamB={getTeamById(picks.upperBracket[1])} onPick={handleBracketPick} winnerId={picks.bracketPicks['UB-R1-M1']} />
                        <PredictionMatchCard matchId="UB-R1-M2" teamA={getTeamById(picks.upperBracket[2])} teamB={getTeamById(picks.upperBracket[3])} onPick={handleBracketPick} winnerId={picks.bracketPicks['UB-R1-M2']} />
                        <PredictionMatchCard matchId="UB-R1-M3" teamA={getTeamById(picks.upperBracket[4])} teamB={getTeamById(picks.upperBracket[5])} onPick={handleBracketPick} winnerId={picks.bracketPicks['UB-R1-M3']} />
                        <PredictionMatchCard matchId="UB-R1-M4" teamA={getTeamById(picks.upperBracket[6])} teamB={getTeamById(picks.upperBracket[7])} onPick={handleBracketPick} winnerId={picks.bracketPicks['UB-R1-M4']} />
                    </div>

                     {/* LB R1 */}
                    <div className="col-start-2 space-y-4">
                        <PredictionMatchCard matchId="LB-R1-M1" teamA={getTeamById(picks.lowerBracket[0])} teamB={getTeamById(picks.lowerBracket[1])} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R1-M1']} />
                        <PredictionMatchCard matchId="LB-R1-M2" teamA={getTeamById(picks.lowerBracket[2])} teamB={getTeamById(picks.lowerBracket[3])} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R1-M2']} />
                        <PredictionMatchCard matchId="LB-R1-M3" teamA={getTeamById(picks.lowerBracket[4])} teamB={getTeamById(picks.lowerBracket[5])} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R1-M3']} />
                        <PredictionMatchCard matchId="LB-R1-M4" teamA={getTeamById(picks.lowerBracket[6])} teamB={getTeamById(picks.lowerBracket[7])} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R1-M4']} />
                    </div>
                    
                    {/* UB R2 & LB R2 */}
                    <div className="col-start-3 space-y-4">
                        <PredictionMatchCard matchId="UB-R2-M1" teamA={getTeamById(bracketStructure.ub_r1_m1_winner!)} teamB={getTeamById(bracketStructure.ub_r1_m2_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['UB-R2-M1']} />
                        <PredictionMatchCard matchId="LB-R2-M1" teamA={getTeamById(bracketStructure.ub_r1_m1_loser!)} teamB={getTeamById(bracketStructure.lb_r1_m1_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R2-M1']} />
                        <PredictionMatchCard matchId="LB-R2-M2" teamA={getTeamById(bracketStructure.ub_r1_m2_loser!)} teamB={getTeamById(bracketStructure.lb_r1_m2_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R2-M2']} />
                        <PredictionMatchCard matchId="UB-R2-M2" teamA={getTeamById(bracketStructure.ub_r1_m3_winner!)} teamB={getTeamById(bracketStructure.ub_r1_m4_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['UB-R2-M2']} />
                         <PredictionMatchCard matchId="LB-R2-M3" teamA={getTeamById(bracketStructure.ub_r1_m3_loser!)} teamB={getTeamById(bracketStructure.lb_r1_m3_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R2-M3']} />
                        <PredictionMatchCard matchId="LB-R2-M4" teamA={getTeamById(bracketStructure.ub_r1_m4_loser!)} teamB={getTeamById(bracketStructure.lb_r1_m4_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R2-M4']} />
                    </div>

                    {/* UB Final & LB R3 */}
                    <div className="col-start-4 space-y-4">
                        <PredictionMatchCard matchId="UB-Final" teamA={getTeamById(bracketStructure.ub_r2_m1_winner!)} teamB={getTeamById(bracketStructure.ub_r2_m2_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['UB-Final']} />
                        <PredictionMatchCard matchId="LB-R3-M1" teamA={getTeamById(bracketStructure.lb_r2_m1_winner!)} teamB={getTeamById(bracketStructure.lb_r2_m2_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R3-M1']} />
                        <PredictionMatchCard matchId="LB-R3-M2" teamA={getTeamById(bracketStructure.lb_r2_m3_winner!)} teamB={getTeamById(bracketStructure.lb_r2_m4_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R3-M2']} />
                    </div>

                     {/* LB R4 */}
                    <div className="col-start-5 space-y-4">
                        <PredictionMatchCard matchId="LB-R4-M1" teamA={getTeamById(bracketStructure.ub_r2_m1_loser!)} teamB={getTeamById(bracketStructure.lb_r3_m1_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-R4-M1']} />
                         <PredictionMatchCard matchId="LB-R4-M2-placeholder" teamA={getTeamById(bracketStructure.ub_r2_m2_loser!)} teamB={getTeamById(bracketStructure.lb_r3_m2_winner!)} onPick={()=>{}} winnerId={null} />
                    </div>

                    {/* LB Final */}
                     <div className="col-start-6 space-y-4">
                        <PredictionMatchCard matchId="LB-Final" teamA={getTeamById(bracketStructure.lb_r4_winner!)} teamB={getTeamById(bracketStructure.ub_final_loser!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['LB-Final']} />
                    </div>

                    {/* Grand Final */}
                    <div className="col-start-7 space-y-4">
                        <PredictionMatchCard matchId="Grand-Final" teamA={getTeamById(bracketStructure.ub_final_winner!)} teamB={getTeamById(bracketStructure.lb_final_winner!)} onPick={handleBracketPick} winnerId={picks.bracketPicks['Grand-Final']} isFinal={true}/>
                    </div>

                 </div>
            </CardContent>
            <CardFooter>
               <Button variant="destructive" onClick={resetBracketPicks}>Reset Bracket Picks</Button>
            </CardFooter>
        </Card>
    );
};

const PredictionMatchCard = ({ matchId, teamA, teamB, onPick, winnerId, isFinal=false }: {
    matchId: string;
    teamA?: Team;
    teamB?: Team;
    onPick: (matchId: string, winnerId: string | null) => void;
    winnerId: string | null;
    isFinal?: boolean;
}) => {
    const pickA = () => teamA && onPick(matchId, teamA.id);
    const pickB = () => teamB && onPick(matchId, teamB.id);

    return (
        <div className={cn("bg-card border rounded-md p-2 text-sm", isFinal && "border-primary border-2 shadow-lg shadow-primary/20")}>
            <div 
                onClick={pickA} 
                className={cn(
                    "flex items-center space-x-2 p-1 rounded-sm cursor-pointer hover:bg-primary/20",
                    winnerId === teamA?.id ? "bg-primary/20 ring-1 ring-primary" : "",
                    !teamA && "cursor-not-allowed opacity-50"
                )}
            >
                {teamA ? <Image src={teamA.logoUrl!} alt={teamA.name} width={16} height={16} data-ai-hint="team logo"/> : <div className="w-4 h-4 bg-muted rounded-sm" />}
                <span className="truncate">{teamA?.name || 'TBD'}</span>
            </div>
            <div className="text-center text-xs text-muted-foreground my-0.5">vs</div>
            <div 
                onClick={pickB} 
                className={cn(
                    "flex items-center space-x-2 p-1 rounded-sm cursor-pointer hover:bg-primary/20",
                    winnerId === teamB?.id ? "bg-primary/20 ring-1 ring-primary" : "",
                    !teamB && "cursor-not-allowed opacity-50"
                )}
            >
                {teamB ? <Image src={teamB.logoUrl!} alt={teamB.name} width={16} height={16} data-ai-hint="team logo"/> : <div className="w-4 h-4 bg-muted rounded-sm" />}
                <span className="truncate">{teamB?.name || 'TBD'}</span>
            </div>
        </div>
    );
};
