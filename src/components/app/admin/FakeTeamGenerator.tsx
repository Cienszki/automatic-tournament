"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { createFakeTeamServerAction } from "@/lib/fake-team-action";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface FakeTeamGeneratorProps {
  onTeamCreated: () => void;
}

export function FakeTeamGenerator({ onTeamCreated }: FakeTeamGeneratorProps) {
  const [isCreating, setIsCreating] = React.useState(false);
  const { toast } = useToast();

  const handleCreateFakeTeam = async () => {
    setIsCreating(true);
    const result = await createFakeTeamServerAction(true);
    if (result.success) {
      toast({
        title: "Success!",
        description: result.message,
        variant: "default",
      });
      onTeamCreated(); // Notify parent
    } else {
      toast({
        title: "Oh no!",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsCreating(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Data Generation</CardTitle>
        <CardDescription>
          Create mock data for testing purposes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleCreateFakeTeam} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          {isCreating ? "Creating Test Team..." : "Create Test Team"}
        </Button>
      </CardContent>
    </Card>
  );
}
