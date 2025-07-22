
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getGroups, getTeams, createGroup, deleteGroup, deleteAllGroups } from "@/lib/admin-actions";
import type { Team, Group } from "@/lib/definitions";
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

export function StageManagementTab() {
  const { toast } = useToast();
  // State for new group creation
  const [allTeams, setAllTeams] = React.useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);

  // State for group management
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | boolean>(false);


  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    const [fetchedTeams, fetchedGroups] = await Promise.all([getTeams(), getGroups()]);
    
    // Get all team IDs that are already in a group
    const assignedTeamIds = new Set(fetchedGroups.flatMap(g => Object.keys(g.standings)));
    
    setAllTeams(fetchedTeams.filter(team => team.status === 'verified' && !assignedTeamIds.has(team.id)));
    setGroups(fetchedGroups);
    setIsLoading(false);
  }, []);

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
    if (result.success) {
      toast({ title: "Success!", description: result.message });
      setNewGroupName("");
      setSelectedTeamIds([]);
      fetchData();
    } else {
      toast({ title: "Creation Failed", description: result.message, variant: "destructive" });
    }
    setIsCreatingGroup(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    setIsDeleting(groupId);
    const result = await deleteGroup(groupId);
    if (result.success) {
      toast({ title: "Success!", description: result.message });
      fetchData();
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setIsDeleting(false);
  };

  const handleDeleteAllGroups = async () => {
    setIsDeleting(true);
    const result = await deleteAllGroups();
    if (result.success) {
      toast({ title: "Success!", description: result.message });
      fetchData();
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setIsDeleting(false);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Group Stage Management</CardTitle>
        <CardDescription>Create new groups, assign teams, and manage existing groups for the tournament.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* New Group Creation Section */}
        <div className="p-4 border rounded-lg">
          <h4 className="text-lg font-semibold mb-2">Create New Group</h4>
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
                    <CommandGroup>
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

        {/* Danger Zone for Deletion */}
        <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
            <h4 className="text-lg font-semibold text-destructive mb-2 flex items-center">
                <ShieldAlert className="mr-2 h-5 w-5" />
                Danger Zone
            </h4>
            <div className="space-y-4">
                {groups.map(group => (
                    <div key={group.id} className="flex items-center justify-between p-2 bg-background rounded">
                        <p className="font-mono text-sm">{group.name} ({Object.keys(group.standings).length} teams)</p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={!!isDeleting}>
                                     {isDeleting === group.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure you want to delete {group.name}?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone and will permanently remove the group and its standings.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteGroup(group.id)}>Confirm</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))}
                {groups.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-destructive/30">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full" disabled={!!isDeleting}>
                                     {isDeleting === true ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Delete All Groups
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will delete all {groups.length} groups. This action is final and cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAllGroups}>Yes, delete everything</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </div>
        </div>
        
      </CardContent>
    </Card>
  );
}
