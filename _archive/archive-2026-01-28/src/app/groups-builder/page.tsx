"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Shuffle, RotateCcw, Eye, Users, Settings2, Plus, Trash2 } from "lucide-react";
import { getAllTeams } from "@/lib/firestore";
import type { Team } from "@/lib/definitions";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface TeamInDraw {
  id: string;
  name: string;
  logoUrl?: string;
  tag?: string;
}

interface GroupsState {
  [key: string]: TeamInDraw[];
}

interface GroupConfig {
  name: string;
  id: string;
}

export default function GroupsBuilderPage() {
  const [teams, setTeams] = useState<TeamInDraw[]>([]);
  const [availableTeams, setAvailableTeams] = useState<TeamInDraw[]>([]);
  const [groups, setGroups] = useState<GroupsState>({});
  const [groupConfigs, setGroupConfigs] = useState<GroupConfig[]>([
    { name: "Grupa Analfabetów", id: "group-1" },
    { name: "Grupa Buraków", id: "group-2" }, 
    { name: "Grupa Cymbałów", id: "group-3" },
    { name: "Grupa Dupa", id: "group-4" },
    { name: "Grupa Egoistów", id: "group-5" },
    { name: "Grupa Frajerów", id: "group-6" }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempGroupConfigs, setTempGroupConfigs] = useState<GroupConfig[]>([]);

  // Initialize groups and load teams
  useEffect(() => {
    const initializeGroups = () => {
      const initialGroups: GroupsState = {};
      groupConfigs.forEach(config => {
        initialGroups[config.id] = [];
      });
      setGroups(initialGroups);
    };

    const loadTeams = async () => {
      try {
        const teamsData = await getAllTeams();
        const verifiedTeams = teamsData.filter(team => team.status === 'verified');
        
        const formattedTeams: TeamInDraw[] = verifiedTeams.map(team => ({
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl || undefined,
          tag: team.tag
        }));
        
        setTeams(formattedTeams);
        setAvailableTeams(formattedTeams);
      } catch (error) {
        console.error('Error loading teams:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeGroups();
    loadTeams();
  }, [groupConfigs]);

  const addGroup = () => {
    const newId = `group-${Date.now()}`;
    setTempGroupConfigs([...tempGroupConfigs, { name: "", id: newId }]);
  };

  const removeGroup = (indexToRemove: number) => {
    setTempGroupConfigs(tempGroupConfigs.filter((_, index) => index !== indexToRemove));
  };

  const updateGroupName = (index: number, name: string) => {
    const updated = [...tempGroupConfigs];
    updated[index] = { ...updated[index], name };
    setTempGroupConfigs(updated);
  };

  const openConfigDialog = () => {
    setTempGroupConfigs([...groupConfigs]);
    setIsConfigOpen(true);
  };

  const saveGroupConfig = () => {
    const validConfigs = tempGroupConfigs.filter(config => config.name.trim() !== '');
    setGroupConfigs(validConfigs);
    setIsConfigOpen(false);
    
    // Reset groups with new configuration
    const resetGroups: GroupsState = {};
    validConfigs.forEach(config => {
      resetGroups[config.id] = [];
    });
    setGroups(resetGroups);
    setAvailableTeams([...teams]);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    // Find the team being dragged
    let draggedTeam: TeamInDraw | null = null;
    
    if (source.droppableId === 'available-teams') {
      draggedTeam = availableTeams[source.index];
    } else {
      draggedTeam = groups[source.droppableId]?.[source.index] || null;
    }
    
    if (!draggedTeam) return;

    const newGroups = { ...groups };
    const newAvailableTeams = [...availableTeams];

    // Remove from source
    if (source.droppableId === 'available-teams') {
      newAvailableTeams.splice(source.index, 1);
    } else {
      if (newGroups[source.droppableId]) {
        newGroups[source.droppableId].splice(source.index, 1);
      }
    }

    // Add to destination
    if (destination.droppableId === 'available-teams') {
      newAvailableTeams.splice(destination.index, 0, draggedTeam);
    } else {
      if (!newGroups[destination.droppableId]) {
        newGroups[destination.droppableId] = [];
      }
      newGroups[destination.droppableId].splice(destination.index, 0, draggedTeam);
    }

    setGroups(newGroups);
    setAvailableTeams(newAvailableTeams);
  };

  const shuffleAvailableTeams = () => {
    const shuffled = [...availableTeams].sort(() => Math.random() - 0.5);
    setAvailableTeams(shuffled);
  };

  const resetAllGroups = () => {
    const resetGroups: GroupsState = {};
    groupConfigs.forEach(config => {
      resetGroups[config.id] = [];
    });
    setGroups(resetGroups);
    setAvailableTeams([...teams]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading teams...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalTeamsInGroups = Object.values(groups).reduce((sum, group) => sum + group.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 space-y-8">
        {/* Enhanced Header */}
        <div className="text-center space-y-6 py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Users className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
            Groups Draw Builder
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Configure your groups and drag teams from the pool into groups during the live draw. 
            Perfect for tournament broadcasts and live events.
          </p>
          
          {/* Stats */}
          <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{availableTeams.length}</Badge>
              <span>Available Teams</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{groupConfigs.length}</Badge>
              <span>Groups</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{totalTeamsInGroups}</Badge>
              <span>Teams Placed</span>
            </div>
          </div>
        </div>

        {/* Enhanced Controls */}
        <Card className="shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap justify-center gap-4">
              <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openConfigDialog} variant="outline" size="lg" className="h-12 px-6">
                    <Settings2 className="mr-2 h-5 w-5" />
                    Configure Groups
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Configure Groups</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {tempGroupConfigs.map((config, index) => (
                      <div key={config.id} className="flex items-center space-x-2">
                        <Input
                          placeholder="Group name"
                          value={config.name}
                          onChange={(e) => updateGroupName(index, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGroup(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button onClick={addGroup} variant="ghost" className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Group
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={saveGroupConfig}>Save Configuration</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button onClick={shuffleAvailableTeams} variant="outline" size="lg" className="h-12 px-6">
                <Shuffle className="mr-2 h-5 w-5" />
                Shuffle Teams
              </Button>
              
              <Button onClick={resetAllGroups} variant="outline" size="lg" className="h-12 px-6">
                <RotateCcw className="mr-2 h-5 w-5" />
                Reset All
              </Button>
              
              <Button variant="outline" size="lg" className="h-12 px-6">
                <Eye className="mr-2 h-5 w-5" />
                Preview Mode
              </Button>
            </div>
          </CardContent>
        </Card>

        <DragDropContext onDragEnd={onDragEnd}>
          {/* Enhanced Available Teams Pool */}
          <Card className="shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-center flex items-center justify-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Available Teams Pool</span>
                <Badge variant="secondary" className="ml-2">{availableTeams.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="available-teams" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-32 p-6 rounded-xl border-2 border-dashed transition-all duration-200",
                      snapshot.isDraggingOver
                        ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20" 
                        : "border-slate-300 dark:border-slate-600",
                      availableTeams.length === 0 && !snapshot.isDraggingOver && "bg-slate-50/50 dark:bg-slate-700/20"
                    )}
                  >
                    {availableTeams.length === 0 && !snapshot.isDraggingOver ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-medium mb-1">No teams available</p>
                        <p className="text-sm">All teams have been assigned to groups</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {availableTeams.map((team, index) => (
                          <Draggable key={team.id} draggableId={team.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200 min-w-0 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md",
                                  snapshot.isDragging 
                                    ? "shadow-2xl rotate-3 scale-105 border-primary z-50" 
                                    : "hover:border-primary/50 hover:-translate-y-0.5"
                                )}
                              >
                                {team.logoUrl && (
                                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0">
                                    <Image
                                      src={team.logoUrl}
                                      alt={`${team.name} logo`}
                                      fill
                                      className="object-contain p-1"
                                    />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm truncate">{team.name}</p>
                                  {team.tag && (
                                    <p className="text-xs text-muted-foreground truncate">[{team.tag}]</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* Enhanced Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {groupConfigs.map((config, groupIndex) => {
              const groupTeams = groups[config.id] || [];
              return (
                <Card key={config.id} className="shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-bold flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          groupIndex % 6 === 0 && "bg-red-500",
                          groupIndex % 6 === 1 && "bg-orange-500", 
                          groupIndex % 6 === 2 && "bg-yellow-500",
                          groupIndex % 6 === 3 && "bg-green-500",
                          groupIndex % 6 === 4 && "bg-blue-500",
                          groupIndex % 6 === 5 && "bg-purple-500"
                        )}></div>
                        <span className="truncate">{config.name}</span>
                      </div>
                      <Badge variant="secondary">{groupTeams.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Droppable droppableId={config.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "min-h-40 p-4 rounded-xl border-2 border-dashed transition-all duration-200",
                            snapshot.isDraggingOver
                              ? "border-green-400 bg-green-50/50 dark:bg-green-950/20"
                              : "border-slate-300 dark:border-slate-600",
                            groupTeams.length === 0 && !snapshot.isDraggingOver && "bg-slate-50/50 dark:bg-slate-700/20"
                          )}
                        >
                          {groupTeams.length === 0 && !snapshot.isDraggingOver ? (
                            <div className="text-center text-muted-foreground py-8">
                              <div className={cn(
                                "w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center opacity-30",
                                groupIndex % 6 === 0 && "bg-red-100 dark:bg-red-950",
                                groupIndex % 6 === 1 && "bg-orange-100 dark:bg-orange-950", 
                                groupIndex % 6 === 2 && "bg-yellow-100 dark:bg-yellow-950",
                                groupIndex % 6 === 3 && "bg-green-100 dark:bg-green-950",
                                groupIndex % 6 === 4 && "bg-blue-100 dark:bg-blue-950",
                                groupIndex % 6 === 5 && "bg-purple-100 dark:bg-purple-950"
                              )}>
                                <Users className="w-6 h-6" />
                              </div>
                              <p className="text-sm font-medium">Drop teams here</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {groupTeams.map((team, index) => (
                                <Draggable key={team.id} draggableId={team.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={cn(
                                        "flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md",
                                        snapshot.isDragging 
                                          ? "shadow-2xl rotate-3 scale-105 border-primary z-50" 
                                          : "hover:border-primary/50 hover:-translate-y-0.5"
                                      )}
                                    >
                                      {team.logoUrl && (
                                        <div className="relative w-8 h-8 rounded overflow-hidden bg-white flex-shrink-0">
                                          <Image
                                            src={team.logoUrl}
                                            alt={`${team.name} logo`}
                                            fill
                                            className="object-contain p-0.5"
                                          />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm truncate">{team.name}</p>
                                        {team.tag && (
                                          <p className="text-xs text-muted-foreground truncate">[{team.tag}]</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
