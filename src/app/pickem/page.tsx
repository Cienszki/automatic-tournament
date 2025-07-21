
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getAllTeams, getUserPickem, saveUserPickem } from '@/lib/firestore';
import type { Team } from '@/lib/definitions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Award, Medal, Users, Download, Lock, ClipboardCheck, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

export default function PickEmPage() {
  const { user, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PicksState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const teams = await getAllTeams();
      setAllTeams(teams);

      const initialPicks: PicksState = {
        pool: teams.map(t => t.id),
        champion: [], runnerUp: [], thirdPlace: [], fourthPlace: [],
        fifthToSixth: [], seventhToEighth: [], ninthToTwelfth: [],
        thirteenthToSixteenth: [],
      };

      if (user) {
        const userPickem = await getUserPickem(user.uid);
        if (userPickem?.predictions) {
          const userPicks = userPickem.predictions;
          const allPickedIds = new Set(Object.values(userPicks).flat());
          initialPicks.pool = teams.map(t => t.id).filter(id => !allPickedIds.has(id));
          Object.keys(userPicks).forEach(key => {
            initialPicks[key as ContainerId] = userPicks[key];
          });
        }
      }
      setPicks(initialPicks);
      setIsLoading(false);
    }
    loadData();
  }, [user]);

  const getTeamById = (teamId: string): Team | undefined => allTeams.find(t => t.id === teamId);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !picks) return;

    const sourceId = result.source.droppableId as ContainerId;
    const destId = result.destination.droppableId as ContainerId;

    const newPicks = { ...picks };
    const sourceList = Array.from(newPicks[sourceId]);
    const [movedTeamId] = sourceList.splice(result.source.index, 1);

    if (destId === sourceId) {
      sourceList.splice(result.destination.index, 0, movedTeamId);
      newPicks[sourceId] = sourceList;
    } else {
      const destList = Array.from(newPicks[destId]);
      if (destList.length >= pickContainers[destId].limit) {
        toast({ title: "Limit Reached", description: `Cannot add more teams to "${pickContainers[destId].title}".`, variant: "destructive" });
        return;
      }
      destList.splice(result.destination.index, 0, movedTeamId);
      newPicks[sourceId] = sourceList;
      newPicks[destId] = destList;
    }
    setPicks(newPicks);
  };

  const isSubmissionReady = useMemo(() => {
    if (!picks) return false;
    const placementContainerIds = Object.keys(pickContainers).filter(k => k !== 'pool') as ContainerId[];
    return placementContainerIds.every(id => picks[id].length === pickContainers[id].limit);
  }, [picks]);
  
  const resetPicks = () => {
    setPicks({
        pool: allTeams.map(t => t.id),
        champion: [], runnerUp: [], thirdPlace: [], fourthPlace: [],
        fifthToSixth: [], seventhToEighth: [], ninthToTwelfth: [],
        thirteenthToSixteenth: [],
    });
  }
  
  const handleSubmit = async () => {
    if (!user || !picks || !isSubmissionReady) return;
    setIsSaving(true);
    try {
        const { pool, ...predictionsToSave } = picks;
        await saveUserPickem(user.uid, predictionsToSave);
        toast({ title: "Success!", description: "Your Pick'em predictions have been saved." });
    } catch (error) {
        console.error("Error saving Pick'em:", error);
        toast({ title: "Error", description: "Failed to save your predictions.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  }

  if (isLoading || !picks) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto text-center shadow-xl">
        <CardHeader><CardTitle className="text-2xl text-accent">Join the Pick'em Challenge!</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">Login with Google to make your predictions.</p>
          <Button onClick={signInWithGoogle} size="lg">Login with Google</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/pickem.png)` }} />
        <div className="relative z-10">
          <ClipboardCheck className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>Pick'em Challenge</h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>Predict the final standings for every team in the tournament.</p>
        </div>
      </Card>

      <HowToPlay />
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader><CardTitle className="text-xl">Team Pool</CardTitle></CardHeader>
              <Droppable droppableId="pool">
                {(provided) => (
                  <CardContent ref={provided.innerRef} {...provided.droppableProps}>
                    <ScrollArea className="h-[600px] p-2 bg-muted/20 rounded-md">
                      {picks.pool.map((teamId, index) => (
                        <Draggable key={teamId} draggableId={teamId} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                              <TeamCardItem team={getTeamById(teamId)!} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ScrollArea>
                  </CardContent>
                )}
              </Droppable>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle className="text-xl">Final Placements</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.values(pickContainers).filter(c => c.id !== 'pool').map(container => (
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
          <Button size="lg" variant="destructive" onClick={resetPicks} disabled={isSaving}>
            <RotateCcw className="mr-2" /> Reset All Picks
          </Button>
          <Button size="lg" onClick={handleSubmit} disabled={!isSubmissionReady || isSaving}>
            {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <ClipboardCheck className="mr-2" />}
            {isSaving ? "Saving..." : "Submit Predictions"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Sub-Components
const HowToPlay = () => (
    <Card><CardHeader><CardTitle className="text-2xl text-accent">How to Play</CardTitle></CardHeader>
    <CardContent>
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1"><AccordionTrigger>Step 1: Predict The Final Standings</AccordionTrigger><AccordionContent>Drag and drop each of the teams from the "Team Pool" into one of the final placement containers.</AccordionContent></AccordionItem>
        <AccordionItem value="item-2"><AccordionTrigger>Step 2: Lock In Your Picks</AccordionTrigger><AccordionContent>Once you have filled all placement containers, the "Submit Predictions" button will be enabled. Your picks cannot be changed after submission.</AccordionContent></AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
);

const DroppableList = ({ id, title, icon: Icon, teams, getTeamById, requiredCount }: { id: ContainerId; title: string; icon: React.ElementType | null; teams: string[]; getTeamById: (id: string) => Team | undefined; requiredCount: number }) => (
    <Card className="flex flex-col min-w-[200px] bg-muted/20">
        <CardHeader className="pb-2">
            <CardTitle className="text-base flex justify-between items-center">
                <span className="flex items-center">{Icon && <Icon className="h-5 w-5 mr-2 text-primary shrink-0" />}{title}</span>
                <Badge variant={teams.length > requiredCount ? "destructive" : teams.length === requiredCount ? "secondary" : "outline"} className={cn(teams.length < requiredCount && "bg-muted text-muted-foreground border-transparent")}>
                    {teams.length} / {requiredCount}
                </Badge>
            </CardTitle>
        </CardHeader>
        <Droppable droppableId={id}>
            {(provided, snapshot) => (
                <CardContent ref={provided.innerRef} {...provided.droppableProps} className={cn("flex-grow min-h-[60px] rounded-md p-2 transition-colors", snapshot.isDraggingOver ? "bg-primary/10" : "")}>
                    {teams.length > 0 ? teams.map((teamId, index) => (
                        <Draggable key={teamId} draggableId={teamId} index={index}>
                            {(provided) => (<div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}><TeamCardItem team={getTeamById(teamId)!} /></div>)}
                        </Draggable>
                    )) : (<div className="flex items-center justify-center h-full text-muted-foreground italic text-xs">Drop team(s) here</div>)}
                    {provided.placeholder}
                </CardContent>
            )}
        </Droppable>
    </Card>
);

const TeamCardItem = ({ team }: { team: Team }) => (
    <div className="p-2 mb-2 bg-card rounded-md shadow-sm flex items-center space-x-3 cursor-grab active:cursor-grabbing">
        <Image src={team.logoUrl!} alt={team.name} width={24} height={24} className="rounded-sm flex-shrink-0" />
        <span className="font-medium text-sm truncate">{team.name}</span>
    </div>
);
