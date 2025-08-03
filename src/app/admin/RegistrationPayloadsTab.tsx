"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";





export function RegistrationPayloadsTab() {
  const [selectedTeams, setSelectedTeams] = React.useState<number[]>([]);
  const [teams, setTeams] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  React.useEffect(() => {
    async function fetchTeams() {
      setLoading(true);
      try {
        const res = await fetch("/api/registration-payloads");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setTeams(data);
      } catch (e) {
        toast({ 
          title: t('toasts.errors.title'), 
          description: t('toasts.errors.loadRegistrationPayloads'), 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    }
    fetchTeams();
  }, [toast]);

  const handleSelectTeam = (idx: number) => {
    setSelectedTeams((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedTeams.length === 0) return;
    const newTeams = teams.filter((_: any, idx: number) => !selectedTeams.includes(idx));
    setTeams(newTeams);
    setSelectedTeams([]);
    toast({
      title: "Deleted",
      description: `${selectedTeams.length} registration payload(s) removed (local only).`,
      variant: "default",
    });
    // TODO: Add API call to persist deletion if needed
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Payloads</CardTitle>
        <CardDescription>
          View and delete registration payloads (teams) from the local file. This does not affect the database.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full rounded-md border p-4 mb-4">
          <div className="space-y-2">
            {loading ? (
              <div>Loading...</div>
            ) : teams.length === 0 ? (
              <div className="text-muted-foreground">No registration payloads found.</div>
            ) : (
              teams.map((team, idx) => (
                <div key={team.name + idx} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${idx}`}
                    onCheckedChange={() => handleSelectTeam(idx)}
                    checked={selectedTeams.includes(idx)}
                  />
                  <label htmlFor={`team-${idx}`} className="text-sm font-medium">
                    {team.name} <span className="text-muted-foreground">(Tag: {team.tag})</span>
                  </label>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <Button
          variant="destructive"
          onClick={handleDeleteSelected}
          disabled={selectedTeams.length === 0}
        >
          Delete Selected ({selectedTeams.length})
        </Button>
      </CardContent>
    </Card>
  );
}


