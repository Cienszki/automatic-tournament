
"use client";

import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { mockTeams } from '@/lib/mock-data';
import type { Team } from '@/lib/definitions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, Award, Medal, Users, Download, Lock, Unlock, ClipboardCheck, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Define the structure for pick containers
const pickContainers = {
  champion: { id: 'champion', title: 'Champion', limit: 1, icon: Trophy },
  runnerUp: { id: 'runnerUp', title: 'Runner-up', limit: 1, icon: Award },
  thirdPlace: { id: 'thirdPlace', title: '3rd Place', limit: 1, icon: Medal },
  fourthPlace: { id: 'fourthPlace', title: '4th Place', limit: 1, icon: Medal },
  fifthToSixth: { id: 'fifthToSixth', title: '5th - 6th Place', limit: 2, icon: Users },
  seventhToEighth: { id: 'seventhToEighth', title: '7th - 8th Place', limit: 2, icon: Users },
  ninthToTwelfth: { id: 'ninthToTwelfth', title: '9th - 12th Place', limit: 4, icon: Users },
  thirteenthToSixteenth: { id: 'thirteenthToSixteenth', title: '13th - 16th Place', limit: 4, icon: Users },
  pool: { id: 'pool', title: 'Available Teams', limit: Infinity, icon: null },
};

type ContainerId = keyof typeof pickContainers;

type PicksState = Record<ContainerId, string[]>;

const initialPicksState: PicksState = {
  pool: mockTeams.map(t => t.id),
  champion: [], runnerUp: [], thirdPlace: [], fourthPlace: [],
  fifthToSixth: [], seventhToEighth: [], ninthToTwelfth: [],
  thirteenthToSixteenth: [],
};

// Main Component
export default function PickEmPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [picks, setPicks] = useState<PicksState>(initialPicksState);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  
  const getTeamById = (teamId: string): Team | undefined => mockTeams.find(t => t.id === teamId);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceId = source.droppableId as ContainerId;
    const destId = destination.droppableId as ContainerId;

    if (sourceId === destId && source.index === destination.index) return;
    
    // Logic to move teams between lists
    const newPicks = { ...picks };
    const sourceList = [...newPicks[sourceId]];
    const [movedTeam] = sourceList.splice(source.index, 1);

    if (destId === sourceId) {
      sourceList.splice(destination.index, 0, movedTeam);
      newPicks[sourceId] = sourceList;
    } else {
      const destList = [...newPicks[destId]];
      destList.splice(destination.index, 0, movedTeam);
      newPicks[sourceId] = sourceList;
      newPicks[destId] = destList;
    }

    setPicks(newPicks);
  };
  
  const isSubmissionReady = useMemo(() => {
    const placementContainerIds = Object.keys(pickContainers).filter(k => k !== 'pool') as ContainerId[];
    return placementContainerIds.every(id => {
        const container = pickContainers[id];
        return picks[id].length === container.limit;
    });
  }, [picks]);

  const incorrectContainersCount = useMemo(() => {
     const placementContainerIds = Object.keys(pickContainers).filter(k => k !== 'pool') as ContainerId[];
     return placementContainerIds.filter(id => {
         const container = pickContainers[id];
         return picks[id].length !== container.limit;
     }).length;
  }, [picks]);

  let submitButtonText = 'Submit Predictions';
  if (!isSubmissionReady) {
      if (incorrectContainersCount > 0) {
          submitButtonText = `Correct ${incorrectContainersCount} placement(s) to submit`;
      } else {
          submitButtonText = 'Submit Predictions';
      }
  }

  const resetPicks = () => setPicks(initialPicksState);
  
  const handleLogin = () => setIsLoggedIn(true);

  if (!isLoggedIn) {
    return (
      <Card className="max-w-2xl mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-accent">Join the Pick'em Challenge!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">Login with Discord to make your predictions.</p>
          <Button onClick={handleLogin} size="lg" className="bg-[#5865F2] hover:bg-[#5865F2]/90">Login (Simulated)</Button>
        </CardContent>
      </Card>
    );
  }

  const renderContainers = Object.values(pickContainers).filter(c => c.id !== 'pool');

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <ClipboardCheck className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Pick'em Challenge</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Predict the final standings for every team in the tournament.
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
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Team Pool */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Team Pool</CardTitle>
                    <CardDescription>Teams left here are eliminated in groups.</CardDescription>
                  </CardHeader>
                  <Droppable droppableId="pool">
                    {(provided) => (
                      <CardContent ref={provided.innerRef} {...provided.droppableProps}>
                        <ScrollArea className="h-[600px] p-2 bg-muted/20 rounded-md">
                          {picks.pool.map((teamId, index) => {
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
                          })}
                          {provided.placeholder}
                        </ScrollArea>
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              </div>

              {/* Placement Containers */}
              <div className="lg:col-span-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Final Placements</CardTitle>
                    <CardDescription>Place the top 16 teams into their final positions.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {renderContainers.map(container => (
                      <DroppableList 
                        key={container.id}
                        id={container.id as ContainerId}
                        title={container.title}
                        icon={container.icon}
                        teams={picks[container.id as ContainerId]}
                        getTeamById={getTeamById}
                        requiredCount={container.limit}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </DragDropContext>
          <Card className="shadow-lg">
            <CardFooter className="p-4 flex flex-col md:flex-row justify-center items-center gap-4">
              <Button size="lg" variant="destructive" onClick={resetPicks}>
                <RotateCcw className="mr-2" />
                Reset All Picks
              </Button>
              <Button size="lg" onClick={() => alert('Picks submitted!')} disabled={!isSubmissionReady}>
                <ClipboardCheck className="mr-2" />
                {submitButtonText}
              </Button>
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
          <AccordionTrigger>Step 1: Predict The Final Standings</AccordionTrigger>
          <AccordionContent>
            Drag and drop each of the 24 registered teams from the "Team Pool" on the left into one of the final placement containers on the right. You must correctly fill all placement slots to submit your predictions. Teams remaining in the pool are considered eliminated in the group stage.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Step 2: Lock In Your Picks</AccordionTrigger>
          <AccordionContent>
            Once you have correctly filled all placement containers, the "Submit Predictions" button will be enabled. Make sure your picks are final, as they cannot be changed after the deadline. An admin will later be able to download a spreadsheet of all user predictions for scoring.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
);

const DroppableList = ({ id, title, icon: Icon, teams, getTeamById, requiredCount }: { id: ContainerId; title: string; icon: React.ElementType | null; teams: string[]; getTeamById: (id: string) => Team | undefined; requiredCount: number }) => (
    <Card className="flex flex-col min-w-[200px] bg-muted/20">
        <CardHeader className="pb-2">
            <CardTitle className="text-base flex justify-between items-center">
                <span className="flex items-center">
                  {Icon && <Icon className="h-5 w-5 mr-2 text-primary shrink-0" />}
                  {title}
                </span>
                <Badge
                    variant={
                        teams.length > requiredCount ? "destructive" :
                        teams.length === requiredCount ? "secondary" :
                        "outline"
                    }
                    className={cn(
                        teams.length < requiredCount && "bg-muted text-muted-foreground border-transparent"
                    )}
                >
                    {teams.length} / {requiredCount}
                </Badge>
            </CardTitle>
        </CardHeader>
        <Droppable droppableId={id}>
            {(provided, snapshot) => (
                <CardContent
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-grow min-h-[60px] rounded-md p-2 transition-colors", 
                      snapshot.isDraggingOver ? "bg-primary/10" : ""
                    )}
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
                       <div className="flex items-center justify-center h-full text-muted-foreground italic text-xs">Drop team(s) here</div>
                    )}
                    {provided.placeholder}
                </CardContent>
            )}
        </Droppable>
    </Card>
);

const TeamCardItem = ({ team }: { team: Team }) => (
    <div className="p-2 mb-2 bg-card rounded-md shadow-sm flex items-center space-x-3 cursor-grab active:cursor-grabbing">
        <Image src={team.logoUrl!} alt={team.name} width={24} height={24} className="rounded-sm flex-shrink-0" data-ai-hint="team logo"/>
        <span className="font-medium text-sm truncate">{team.name}</span>
    </div>
);
