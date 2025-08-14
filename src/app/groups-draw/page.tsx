"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Shuffle, RotateCcw, Eye, Users, Settings2, Plus, Trash2, Zap } from "lucide-react";
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

export default function GroupsDrawPage() {
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
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Miami Neon Header */}
        <div className="text-center space-y-6 py-8">
          <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary/30 mb-4 shadow-lg shadow-primary/25">
            <Zap className="w-12 h-12 text-primary animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 animate-pulse"></div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse">
              Groups Draw
            </h1>
            <div className="w-32 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
          </div>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Configure your groups and drag teams from the pool into groups during the live draw. 
            <br />
            <span className="text-accent font-semibold">Perfect for tournament broadcasts and live events.</span>
          </p>
          
          {/* Neon Stats */}
          <div className="flex justify-center space-x-8 pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{availableTeams.length}</div>
              <div className="text-sm text-muted-foreground">Available Teams</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">{groupConfigs.length}</div>
              <div className="text-sm text-muted-foreground">Groups</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary">{totalTeamsInGroups}</div>
              <div className="text-sm text-muted-foreground">Teams Placed</div>
            </div>
          </div>
        </div>

        {/* Neon Control Panel */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-xl shadow-primary/10">
          <CardContent className="p-6">
            <div className="flex flex-wrap justify-center gap-4">
              <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={openConfigDialog} 
                    variant="outline" 
                    size="lg" 
                    className="h-12 px-8 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
                  >
                    <Settings2 className="mr-2 h-5 w-5" />
                    Configure Groups
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md border-primary/20">
                  <DialogHeader>
                    <DialogTitle className="text-primary">Configure Groups</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {tempGroupConfigs.map((config, index) => (
                      <div key={config.id} className="flex items-center space-x-2">
                        <Input
                          placeholder="Group name"
                          value={config.name}
                          onChange={(e) => updateGroupName(index, e.target.value)}
                          className="flex-1 border-muted focus:border-primary/50"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGroup(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button onClick={addGroup} variant="ghost" className="w-full text-accent hover:bg-accent/10">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Group
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={saveGroupConfig} className="bg-primary hover:bg-primary/90">
                      Save Configuration
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button 
                onClick={shuffleAvailableTeams} 
                variant="outline" 
                size="lg" 
                className="h-12 px-8 border-accent/30 text-accent hover:bg-accent/10 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/20 transition-all duration-300"
              >
                <Shuffle className="mr-2 h-5 w-5" />
                Shuffle Teams
              </Button>
              
              <Button 
                onClick={resetAllGroups} 
                variant="outline" 
                size="lg" 
                className="h-12 px-8 border-secondary/30 text-secondary hover:bg-secondary/10 hover:border-secondary/50 hover:shadow-lg hover:shadow-secondary/20 transition-all duration-300"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Reset All
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="h-12 px-8 border-muted text-muted-foreground hover:bg-muted/10 hover:border-muted/50 transition-all duration-300"
              >
                <Eye className="mr-2 h-5 w-5" />
                Preview Mode
              </Button>
            </div>
          </CardContent>
        </Card>

        <DragDropContext onDragEnd={onDragEnd}>
          {/* Neon Team Pool */}
          <Card className="border-accent/20 bg-card/50 backdrop-blur-sm shadow-xl shadow-accent/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-center flex items-center justify-center space-x-3">
                <div className="w-4 h-4 rounded-full bg-accent animate-pulse"></div>
                <span className="text-accent">Available Teams Pool</span>
                <Badge variant="secondary" className="ml-2 bg-accent/20 text-accent border-accent/30">
                  {availableTeams.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="available-teams" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-32 p-6 rounded-xl border-2 border-dashed transition-all duration-300",
                      snapshot.isDraggingOver
                        ? "border-accent bg-accent/5 shadow-lg shadow-accent/20" 
                        : "border-muted/30",
                      availableTeams.length === 0 && !snapshot.isDraggingOver && "bg-muted/5"
                    )}
                  >
                    {availableTeams.length === 0 && !snapshot.isDraggingOver ? (
                      <div className="text-center text-muted-foreground py-12">
                        <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-2">No teams available</p>
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
                                  "flex items-center space-x-3 p-3 rounded-lg border transition-all duration-300 min-w-0 bg-card/80 backdrop-blur-sm",
                                  snapshot.isDragging 
                                    ? "shadow-2xl rotate-2 scale-105 border-primary z-50 bg-card shadow-primary/30" 
                                    : "hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 border-border"
                                )}
                              >
                                {team.logoUrl && (
                                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-background/80 flex-shrink-0 border border-border">
                                    <Image
                                      src={team.logoUrl}
                                      alt={`${team.name} logo`}
                                      fill
                                      className="object-contain p-1"
                                    />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm truncate text-foreground">{team.name}</p>
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

          {/* Neon Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {groupConfigs.map((config, groupIndex) => {
              const groupTeams = groups[config.id] || [];
              const colors = [
                { border: 'border-primary/20', accent: 'bg-primary/5', dot: 'bg-primary', shadow: 'shadow-primary/10' },
                { border: 'border-accent/20', accent: 'bg-accent/5', dot: 'bg-accent', shadow: 'shadow-accent/10' },
                { border: 'border-secondary/20', accent: 'bg-secondary/5', dot: 'bg-secondary', shadow: 'shadow-secondary/10' },
                { border: 'border-[#ffeb3b]/20', accent: 'bg-[#ffeb3b]/5', dot: 'bg-[#ffeb3b]', shadow: 'shadow-[#ffeb3b]/10' },
                { border: 'border-[#00e676]/20', accent: 'bg-[#00e676]/5', dot: 'bg-[#00e676]', shadow: 'shadow-[#00e676]/10' },
                { border: 'border-[#7c4dff]/20', accent: 'bg-[#7c4dff]/5', dot: 'bg-[#7c4dff]', shadow: 'shadow-[#7c4dff]/10' }
              ];
              const colorSet = colors[groupIndex % colors.length];
              
              return (
                <Card key={config.id} className={cn("bg-card/50 backdrop-blur-sm shadow-xl", colorSet.border, colorSet.shadow)}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-bold flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={cn("w-4 h-4 rounded-full animate-pulse", colorSet.dot)}></div>
                        <span className="truncate">{config.name}</span>
                      </div>
                      <Badge variant="secondary" className={cn(colorSet.accent, "border-current/30")}>
                        {groupTeams.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Droppable droppableId={config.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "min-h-40 p-4 rounded-xl border-2 border-dashed transition-all duration-300",
                            snapshot.isDraggingOver
                              ? cn(colorSet.accent, colorSet.border.replace('/20', '/40'))
                              : "border-muted/30",
                            groupTeams.length === 0 && !snapshot.isDraggingOver && "bg-muted/5"
                          )}
                        >
                          {groupTeams.length === 0 && !snapshot.isDraggingOver ? (
                            <div className="text-center text-muted-foreground py-12">
                              <div className={cn(
                                "w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center opacity-30",
                                colorSet.accent
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
                                        "flex items-center space-x-3 p-3 rounded-lg border transition-all duration-300 bg-card/80 backdrop-blur-sm",
                                        snapshot.isDragging 
                                          ? "shadow-2xl rotate-2 scale-105 border-primary z-50 bg-card shadow-primary/30" 
                                          : "hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 border-border"
                                      )}
                                    >
                                      {team.logoUrl && (
                                        <div className="relative w-8 h-8 rounded overflow-hidden bg-background/80 flex-shrink-0 border border-border">
                                          <Image
                                            src={team.logoUrl}
                                            alt={`${team.name} logo`}
                                            fill
                                            className="object-contain p-0.5"
                                          />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm truncate text-foreground">{team.name}</p>
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
