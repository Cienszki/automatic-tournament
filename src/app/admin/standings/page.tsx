
"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChartHorizontal, Save, Edit, AlertCircle } from "lucide-react";
import { mockMatches } from "@/lib/mock-data";
import type { Match } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { cn } from "@/lib/utils";

type MatchScoreState = {
  [matchId: string]: {
    teamAScore: string;
    teamBScore: string;
  };
};

export default function ManageStandingsPage() {
  const { toast } = useToast();
  const [scores, setScores] = React.useState<MatchScoreState>({});
  const [editingMatchId, setEditingMatchId] = React.useState<string | null>(null);

  const handleScoreChange = (matchId: string, team: 'A' | 'B', value: string) => {
    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'A' ? 'teamAScore' : 'teamBScore']: value,
      },
    }));
  };

  const handleSaveScore = (match: Match) => {
    const matchScores = scores[match.id];
    if (!matchScores || matchScores.teamAScore === '' || matchScores.teamBScore === '') {
      toast({
        title: "Error",
        description: "Please enter scores for both teams.",
        variant: "destructive",
      });
      return;
    }
    
    // Here you would typically call a server action to save the scores
    console.log(`Saving scores for match ${match.id}:`, matchScores);
    
    toast({
      title: "Success!",
      description: `Scores for ${match.teamA.name} vs ${match.teamB.name} have been saved.`,
    });
    setEditingMatchId(null); 
  };
  
  const startEditing = (match: Match) => {
    setEditingMatchId(match.id);
    setScores(prev => ({
        ...prev,
        [match.id]: {
            teamAScore: match.teamAScore?.toString() || '',
            teamBScore: match.teamBScore?.toString() || ''
        }
    }));
  };

  const pendingMatches = mockMatches.filter(m => m.status !== 'completed');
  const completedMatches = mockMatches.filter(m => m.status === 'completed');

  const renderMatchRow = (match: Match) => {
    const isEditing = editingMatchId === match.id;
    const currentScores = scores[match.id] || { teamAScore: '', teamBScore: '' };

    return (
      <TableRow key={match.id}>
        <TableCell className="font-medium">{match.round || 'N/A'}</TableCell>
        <TableCell>
            <div className="flex items-center space-x-2">
                <Image src={match.teamA.logoUrl!} alt={match.teamA.name} width={24} height={24} className="rounded-sm" data-ai-hint="team logo" />
                <span>{match.teamA.name}</span>
            </div>
        </TableCell>
        <TableCell>
             <div className="flex items-center space-x-2">
                <Image src={match.teamB.logoUrl!} alt={match.teamB.name} width={24} height={24} className="rounded-sm" data-ai-hint="team logo" />
                <span>{match.teamB.name}</span>
            </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center space-x-2">
            {isEditing ? (
              <>
                <Input
                  type="number"
                  className="w-16 h-8 text-center"
                  placeholder="0"
                  value={currentScores.teamAScore}
                  onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                />
                <span>-</span>
                <Input
                  type="number"
                  className="w-16 h-8 text-center"
                  placeholder="0"
                  value={currentScores.teamBScore}
                  onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                />
              </>
            ) : (
              <span>{match.teamAScore ?? '-'} : {match.teamBScore ?? '-'}</span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          {isEditing ? (
            <Button size="sm" onClick={() => handleSaveScore(match)}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => startEditing(match)}>
              <Edit className="h-4 w-4 mr-2" />
              {match.status === 'completed' ? 'Edit Score' : 'Enter Score'}
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <BarChartHorizontal className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Manage Standings</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Input and edit match results here to update the tournament data.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Pending Matches</CardTitle>
          <CardDescription>Matches that are waiting for a result to be entered.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingMatches.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Round</TableHead>
                        <TableHead>Team A</TableHead>
                        <TableHead>Team B</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>{pendingMatches.map(renderMatchRow)}</TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-green-500" />
                <p className="mt-4">No pending matches. All results are up to date!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completed Matches</CardTitle>
          <CardDescription>Recently completed matches. You can edit the scores if needed.</CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Round</TableHead>
                        <TableHead>Team A</TableHead>
                        <TableHead>Team B</TableHead>
                        <TableHead className="text-center">Final Score</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>{completedMatches.map(renderMatchRow)}</TableBody>
            </Table>
        </CardContent>
      </Card>

    </div>
  );
}
