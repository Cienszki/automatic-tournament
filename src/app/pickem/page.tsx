
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getAllTeams, getUserPickem, saveUserPickem, getUserProfile, updateUserProfile } from '@/lib/firestore';
import { useTranslation } from '@/hooks/useTranslation';
import type { Team, UserProfile } from '@/lib/definitions';
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
import { DiscordUsernameModal } from '@/components/app/DiscordUsernameModal';

type ContainerId = 'champion' | 'runnerUp' | 'thirdPlace' | 'fourthPlace' | 'fifthToSixth' | 'seventhToEighth' | 'ninthToTwelfth' | 'thirteenthToSixteenth' | 'pool';

const scoreToContainerMap: Record<number, ContainerId> = {
    16: 'champion', 15: 'runnerUp', 14: 'thirdPlace', 13: 'fourthPlace',
    11: 'fifthToSixth', 9: 'seventhToEighth', 6: 'ninthToTwelfth', 2: 'thirteenthToSixteenth'
};

type PicksState = Record<ContainerId, string[]>;

export default function PickEmPage() {
  const { user, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [allTeams, setAllTeams] = useState<Team[]>([]);

  const pickContainers = {
    champion: { id: 'champion', title: t("pickem.champion"), limit: 1, icon: Trophy, score: 16 },
    runnerUp: { id: 'runnerUp', title: t("pickem.runnerUp"), limit: 1, icon: Award, score: 15 },
    thirdPlace: { id: 'thirdPlace', title: t("pickem.thirdPlace"), limit: 1, icon: Medal, score: 14 },
    fourthPlace: { id: 'fourthPlace', title: t("pickem.fourthPlace"), limit: 1, icon: Medal, score: 13 },
    fifthToSixth: { id: 'fifthToSixth', title: t("pickem.fifthToSixth"), limit: 2, icon: Users, score: 11 },
    seventhToEighth: { id: 'seventhToEighth', title: t("pickem.seventhToEighth"), limit: 2, icon: Users, score: 9 },
    ninthToTwelfth: { id: 'ninthToTwelfth', title: t("pickem.ninthToTwelfth"), limit: 4, icon: Users, score: 6 },
    thirteenthToSixteenth: { id: 'thirteenthToSixteenth', title: t("pickem.thirteenthToSixteenth"), limit: 4, icon: Users, score: 2 },
    pool: { id: 'pool', title: t("pickem.groupStageElimination"), limit: Infinity, icon: null, score: 0 },
  };
  const [picks, setPicks] = useState<PicksState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        const [userPickem, profile] = await Promise.all([
            getUserPickem(user.uid),
            getUserProfile(user.uid)
        ]);
        setUserProfile(profile);

        if (userPickem?.scores) {
          const allPickedIds = new Set<string>();
          Object.entries(userPickem.scores).forEach(([teamId, score]) => {
              const containerId = scoreToContainerMap[score];
              if (containerId && initialPicks[containerId]) {
                  initialPicks[containerId].push(teamId);
                  allPickedIds.add(teamId);
              }
          });
          initialPicks.pool = teams.map(t => t.id).filter(id => !allPickedIds.has(id));
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
    const destList = sourceId === destId ? sourceList : Array.from(newPicks[destId]);
    
    const [movedTeamId] = sourceList.splice(result.source.index, 1);
    destList.splice(result.destination.index, 0, movedTeamId);

    newPicks[sourceId] = sourceList;
    newPicks[destId] = destList;
    
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
  
  const performSave = async () => {
    if (!user || !picks || !isSubmissionReady) return;
    setIsSaving(true);
    try {
        const { ...predictionsToSave } = picks;
        await saveUserPickem(user.uid, predictionsToSave);
        toast({ 
          title: t('toasts.success.title'), 
          description: t('toasts.success.pickem.saved') 
        });
    } catch (error) {
        console.error("Error saving Pick'em:", error);
        toast({ 
          title: t('toasts.errors.title'), 
          description: (error as Error).message || t('toasts.errors.pickem.failedToSave'), 
          variant: "destructive" 
        });
    } finally {
        setIsSaving(false);
    }
  }

  const handleSubmitClick = () => {
    if (!userProfile?.discordUsername) {
        setIsModalOpen(true);
    } else {
        performSave();
    }
  }

  const handleModalSubmit = async (username: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
        await updateUserProfile(user.uid, { discordUsername: username });
        setUserProfile(prev => ({ ...prev, uid: user.uid, discordUsername: username }));
        setIsModalOpen(false);
        await performSave();
    } catch (error) {
        toast({ 
          title: t('toasts.errors.title'), 
          description: t('toasts.errors.discordSave'), 
          variant: "destructive"
        });
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
        <CardHeader><CardTitle className="text-2xl text-accent">{t("pickem.joinChallenge")}</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">{t("pickem.loginToPredict")}</p>
          <Button onClick={signInWithGoogle} size="lg">{t("common.signInWithGoogle")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <DiscordUsernameModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        isSubmitting={isSaving}
      />
      {/* Desktop: show image banner with fixed height */}
      <Card className="hidden md:flex shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/pick%27em.png)` }} />
      </Card>
      {/* Mobile: show text banner with neon font */}
      <Card className="flex md:hidden shadow-xl text-center relative overflow-hidden h-[120px] flex-col justify-center items-center p-4 bg-black">
        <span className="text-3xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_#39ff14] font-neon-bines">
          {t("nav.pickem")}
        </span>
      </Card>

      <HowToPlay />
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader><CardTitle className="text-xl">{pickContainers.pool.title}</CardTitle></CardHeader>
              <Droppable droppableId="pool">
                {(provided) => (
                  <CardContent ref={provided.innerRef} {...provided.droppableProps}>
                    <ScrollArea className="h-[600px] p-2 bg-muted/20 rounded-md">
                      {picks.pool.map((teamId, index) => (
                        <Draggable key={teamId} draggableId={teamId} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                              <TeamCardItem team={getTeamById(teamId)} />
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
              <CardHeader><CardTitle className="text-xl">{t("pickem.finalPlacements")}</CardTitle></CardHeader>
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
            <RotateCcw className="mr-2" /> {t("pickem.resetAllPicks")}
          </Button>
          <Button size="lg" onClick={handleSubmitClick} disabled={!isSubmissionReady || isSaving}>
            {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <ClipboardCheck className="mr-2" />}
            {isSaving ? t("pickem.saving") : t("pickem.submitPredictions")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Sub-Components
const HowToPlay = () => {
    const { t } = useTranslation();
    
    return (
      <Card><CardHeader><CardTitle className="text-2xl text-accent">{t("pickem.howToPlayTitle")}</CardTitle></CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1"><AccordionTrigger>{t("pickem.pickemChallenge")}</AccordionTrigger><AccordionContent>{t("pickem.pickemDescription")}</AccordionContent></AccordionItem>
          <AccordionItem value="item-2"><AccordionTrigger>{t("pickem.lockInYourPicks")}</AccordionTrigger><AccordionContent>{t("pickem.lockInDescription2")}</AccordionContent></AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

const DroppableList = ({ id, title, icon: Icon, teams, getTeamById, requiredCount }: { id: ContainerId; title: string; icon: React.ElementType | null; teams: string[]; getTeamById: (id: string) => Team | undefined; requiredCount: number }) => {
    const { t } = useTranslation();
    
    return (
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
                              {(provided) => (<div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}><TeamCardItem team={getTeamById(teamId)} /></div>)}
                          </Draggable>
                      )) : (<div className="flex items-center justify-center h-full text-muted-foreground italic text-xs">{t("pickem.dropTeamsHere")}</div>)}
                      {provided.placeholder}
                  </CardContent>
              )}
          </Droppable>
      </Card>
    );
};

const TeamCardItem = ({ team }: { team: Team | undefined }) => {
  const { t } = useTranslation();
  
  if (!team) {
    return (
      <div className="p-2 mb-2 bg-muted rounded-md shadow-sm flex items-center space-x-3">
        <div className="w-6 h-6 bg-muted-foreground rounded-sm flex-shrink-0" />
        <span className="font-medium text-sm text-muted-foreground">{t("pickem.unknownTeam")}</span>
      </div>
    );
  }
  
  return (
    <div className="p-2 mb-2 bg-card rounded-md shadow-sm flex items-center space-x-3 cursor-grab active:cursor-grabbing">
        <Image 
          src={team.logoUrl || `https://placehold.co/24x24.png?text=${team.name.charAt(0)}`} 
          alt={team.name} 
          width={24} 
          height={24} 
          className="rounded-sm flex-shrink-0"
          unoptimized={true}
        />
        <span className="font-medium text-sm truncate">{team.name}</span>
    </div>
  );
};
