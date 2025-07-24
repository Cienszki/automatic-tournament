"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Check, ChevronsUpDown, Loader2, Trash2, ShieldAlert, CalendarIcon, GitBranchPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getGroups, getTeams, createGroup, deleteGroup, deleteAllGroups, generateMatchesForGroup, getMatches } from "@/lib/admin-actions";
import type { Team, Group, Match } from "@/lib/definitions";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

export function StageManagementTab() {
  const { toast } = useToast();
  const [allTeams, setAllTeams] = React.useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState<string | boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = React.useState(false);
  const [generatingGroupId, setGeneratingGroupId] = React.useState<string | null>(null);
  const [deadline, setDeadline] = React.useState<Date | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedTeams, fetchedGroups, fetchedMatches] = await Promise.all([
          getTeams(),
          getGroups(),
          getMatches(),
      ]);
      const assignedTeamIds = new Set(fetchedGroups.flatMap(g => Object.keys(g.standings)));
      setAllTeams(fetchedTeams.filter(team => team.status === 'verified' && !assignedTeamIds.has(team.id)));
      setGroups(fetchedGroups.sort((a, b) => a.name.localeCompare(b.name)));
      setMatches(fetchedMatches);
    } catch (error) {
      toast({ title: "Error fetching data", description: "Could not load required data.", variant: "destructive"})
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateGroup = async () => {
    if (!newGroupName || selectedTeamIds.length === 0) {
      toast({ title: "Error", description: "Please provide a group name and select at least one team.", variant: "destructive" });
      return;
    }
    setIsCreatingGroup(true);
    const result = await createGroup(newGroupName, selectedTeamIds);
    toast({ title: result.success ? "Success!" : "Creation Failed", description: result.message, variant: result.success ? "default" : "destructive" });
    if (result.success) {
      setNewGroupName("");
      setSelectedTeamIds([]);
      fetchData();
    }
    setIsCreatingGroup(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    setIsDeleting(groupId);
    const result = await deleteGroup(groupId);
    toast({ title: result.success ? "Success!" : "Deletion Failed", description: result.message, variant: result.success ? "default" : "destructive" });
    if (result.success) fetchData();
    setIsDeleting(false);
  };
  
  const handleGenerateMatches = async (groupId: string) => {
    setGeneratingGroupId(groupId);
    const result = await generateMatchesForGroup(groupId, deadline || null);
    toast({
        title: result.success ? "Success!" : "Generation Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive"
    });
    if (result.success) fetchData();
    setGeneratingGroupId(null);
  };

  const handleDeleteAllGroups = async () => {
    setIsDeletingAll(true);
    const result = await deleteAllGroups();
    toast({ title: result.success ? "Success!" : "Deletion Failed", description: result.message, variant: result.success ? "default" : "destructive" });
    if (result.success) fetchData();
    setIsDeletingAll(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group Stage Management</CardTitle>
        <CardDescription>Create new groups and generate their match schedules.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="p-4 border rounded-lg">
          <h4 className="text-lg font-semibold mb-2">1. Create New Group</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Only verified teams that are not already in a group are available for selection.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="new-group-name">Group Name</Label>
              <Input id="new-group-name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g., Group A" />
            </div>
            <div>
              <Label>Select Teams ({allTeams.length} available)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between" disabled={allTeams.length === 0}>
                    {selectedTeamIds.length > 0 ? `${selectedTeamIds.length} team(s) selected` : "Select teams..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search teams..." />
                    <CommandEmpty>No available teams found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {allTeams.map((team) => (
                        <CommandItem
                          key={team.id}
                          onSelect={() => {
                            setSelectedTeamIds(current => 
                              current.includes(team.id) 
                                ? current.filter(id => id !== team.id) 
                                : [...current, team.id]
                            );
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedTeamIds.includes(team.id) ? "opacity-100" : "opacity-0")} />
                          {team.name} ({team.tag})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateGroup} disabled={isCreatingGroup || !newGroupName || selectedTeamIds.length === 0} className="w-full">
                {isCreatingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Group
              </Button>
            </div>
          </div>
        </div>
        
        <div className="p-4 border rounded-lg">
            <h4 className="text-lg font-semibold mb-2">2. Generate Matches for Groups</h4>
            <p className="text-sm text-muted-foreground mb-4">
                Set a universal deadline for all group stage matches (optional), then generate schedules for each group individually.
                This action is idempotent - it will only generate matches that don't already exist.
            </p>
            <div className="max-w-xs mb-6">
                <Label>Scheduling Deadline (Optional)</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus/>
                        <div className="p-2 border-t border-border">
                           <Button variant="outline" size="sm" onClick={() => setIsCalendarOpen(false)} className="w-full">Done</Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="space-y-2">
                {isLoading ? <div className="flex justify-center"><Loader2 className="animate-spin" /></div> : groups.length === 0 ? <p className="text-muted-foreground">No groups created yet.</p> :
                  groups.map(group => {
                    const groupTeamIds = Object.keys(group.standings);
                    const totalPossibleMatches = groupTeamIds.length * (groupTeamIds.length - 1) / 2;
                    const existingMatchesCount = matches.filter(m => m.group_id === group.id).length;
                    const hasAllMatches = totalPossibleMatches === existingMatchesCount;

                    return (
                        <div key={group.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                            <div>
                                <p className="font-semibold">{group.name}</p>
                                <p className="text-sm text-muted-foreground">{groupTeamIds.length} teams ({existingMatchesCount}/{totalPossibleMatches} matches)</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => handleGenerateMatches(group.id)}
                                    disabled={!!generatingGroupId || isDeleting === group.id || isDeletingAll || hasAllMatches}
                                >
                                    {generatingGroupId === group.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranchPlus className="mr-2 h-4 w-4" />}
                                    {hasAllMatches ? "Generated" : "Generate"}
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={!!generatingGroupId || isDeleting === group.id || isDeletingAll}>
                                            {isDeleting === group.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Delete {group.name}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will remove the group and all of its {existingMatchesCount} scheduled matches. This action is irreversible.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteGroup(group.id)}>Confirm Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    );
                })}
            </div>
            {groups.length > 0 && (
              <div className="mt-6 pt-4 border-t border-destructive/30">
                  <h4 className="text-lg font-semibold text-destructive mb-2 flex items-center">
                      <ShieldAlert className="mr-2 h-5 w-5" />
                      Danger Zone
                  </h4>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full" disabled={isDeletingAll || !!generatingGroupId || !!isDeleting}>
                              {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                              Delete All Groups & Matches
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will delete all {groups.length} groups and all their associated matches. This action is final.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteAllGroups}>Yes, delete all</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
            )}
        </div>
        
      </CardContent>
    </Card>
  );
}
