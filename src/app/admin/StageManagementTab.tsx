
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
// Assume these server actions will be created
import { getGroups, generateGroupStageMatches, createTestGroup } from "@/lib/admin-actions";

export function StageManagementTab() {
  const { toast } = useToast();
  const [groups, setGroups] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string>("");
  const [deadline, setDeadline] = React.useState<Date | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isCreatingTestGroup, setIsCreatingTestGroup] = React.useState(false);

  const fetchGroups = React.useCallback(async () => {
    setIsLoading(true);
    const fetchedGroups = await getGroups();
    setGroups(fetchedGroups);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleGenerateMatches = async () => {
    if (!selectedGroupId || !deadline) {
      toast({
        title: "Error",
        description: "Please select a group and a deadline.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    const result = await generateGroupStageMatches(selectedGroupId, deadline);
    if (result.success) {
      toast({
        title: "Success!",
        description: result.message,
      });
      setSelectedGroupId("");
      setDeadline(undefined);
    } else {
      toast({
        title: "Generation Failed",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsGenerating(false);
  };
  
  const handleCreateTestGroup = async () => {
    setIsCreatingTestGroup(true);
    const result = await createTestGroup();
    if (result.success) {
      toast({
        title: "Test Group Created",
        description: "Successfully created a test group with dummy teams and captains.",
      });
      await fetchGroups(); // Refresh the groups list
    } else {
      toast({
        title: "Failed to Create Test Group",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsCreatingTestGroup(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage Management</CardTitle>
        <CardDescription>
          Control tournament stages, generate matches, and set deadlines.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg">
          <h4 className="text-lg font-semibold mb-2">Generate Group Stage Matches</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Select a group and a deadline to generate all matches for that group. The system will automatically assign unique, non-conflicting default match times for each pair of teams, scheduled for 20:00 on the days leading up to the deadline.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="group-select">Group</Label>
              {isLoading ? <p>Loading groups...</p> : (
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger id="group-select">
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Scheduling Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerateMatches} disabled={isGenerating || !selectedGroupId || !deadline} className="w-full">
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Matches
              </Button>
            </div>
          </div>
        </div>
        
        <div className="p-4 border rounded-lg bg-muted/20">
            <h4 className="text-lg font-semibold mb-2">Testing Tools</h4>
            <p className="text-sm text-muted-foreground mb-4">
                Use these tools to test the scheduling system. This will create dummy data that can be safely deleted.
            </p>
            <Button onClick={handleCreateTestGroup} disabled={isCreatingTestGroup}>
                {isCreatingTestGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Test Group
            </Button>
        </div>
        
      </CardContent>
    </Card>
  );
}
