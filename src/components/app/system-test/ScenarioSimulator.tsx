"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { createTestGroup, generateGroupStageMatches } from "@/lib/admin-actions";
import { Loader2 } from "lucide-react";

export function ScenarioSimulator() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleCreateTestGroup = async () => {
    setIsCreating(true);
    const result = await createTestGroup();
    if (result.success) {
      toast({ title: "Success", description: "Test group with 3 teams created." });
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsCreating(false);
  };

  const handleGenerateMatches = async () => {
    setIsGenerating(true);
    // For testing, we'll generate matches for the hardcoded 'test_group' with a deadline 7 days from now.
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    const result = await generateGroupStageMatches('test_group', deadline);
    if (result.success) {
      toast({ title: "Success", description: `${result.message} for the test group.` });
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsGenerating(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Simulator</CardTitle>
        <CardDescription>
          One-click buttons to set up the database with predefined test scenarios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-md">
            <h4 className="font-semibold">Group Stage Setup</h4>
            <p className="text-sm text-muted-foreground mb-4">
                This will create a 'Test Group' with three dummy teams, captained by 'Test Captain 1', 'Test Captain 2', and 'Test Captain 3'.
            </p>
            <Button onClick={handleCreateTestGroup} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              1. Create Test Group & Teams
            </Button>
        </div>
        <div className="p-4 border rounded-md">
            <h4 className="font-semibold">Match Generation</h4>
            <p className="text-sm text-muted-foreground mb-4">
                This will generate the round-robin matches for the 'Test Group' with a deadline one week from today.
            </p>
            <Button onClick={handleGenerateMatches} disabled={isGenerating}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              2. Generate Test Matches
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
