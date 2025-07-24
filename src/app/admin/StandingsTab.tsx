
"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Edit, AlertCircle, CheckCircle2, Hourglass } from "lucide-react";
import { getAllMatches, updateMatchScores } from "@/lib/firestore";
import type { Match } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

type MatchScoreState = {
  [matchId: string]: {
    teamAScore: string;
    teamBScore: string;
  };
};

export function StandingsTab() {
  const { toast } = useToast();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [scores, setScores] = React.useState<MatchScoreState>({});
  const [editingMatchId, setEditingMatchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchMatches() {
      const allMatches = await getAllMatches();
      setMatches(allMatches);
    }
    fetchMatches();
  }, []);

  const handleScoreChange = (matchId: string, team: 'A' | 'B', value: string) => {
    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'A' ? 'teamAScore' : 'teamBScore']: value,
      },
    }));
  };

  const handleSaveScore = async (match: Match) => {
    const matchScores = scores[match.id];
    if (!matchScores || matchScores.teamAScore === '' || matchScores.teamBScore === '') {
      toast({
        title: "Error",
        description: "Please enter scores for both teams.",
        variant: "destructive",
      });
      return;
    }

    const teamAScore = parseInt(matchScores.teamAScore, 10);
    const teamBScore = parseInt(matchScores.teamBScore, 10);

    try {
      await updateMatchScores(match.id, teamAScore, teamBScore);
      
      setMatches(prevMatches => 
        prevMatches.map(m => 
          m.id === match.id 
            ? { ...m, teamA: {...m.teamA, score: teamAScore}, teamB: {...m.teamB, score: teamBScore}, status: 'completed' } 
            : m
        )
      );
      
      toast({
        title: "Success!",
        description: `Scores for ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'} have been saved.`,
      });
      setEditingMatchId(null);
    } catch (error) {
      console.error("Failed to save scores:", error);
      toast({
        title: "Error",
        description: "Could not save the scores. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const startEditing = (match: Match) => {
    setEditingMatchId(match.id);
    setScores(prev => ({
        ...prev,
        [match.id]: {
            teamAScore: match.teamA?.score?.toString() || '',
            teamBScore: match.teamB?.score?.toString() || ''
        }
    }));
  };

  const renderMatchRow = (match: Match) => {
    const isEditing = editingMatchId === match.id;
    const currentScores = scores[match.id] || { teamAScore: '', teamBScore: '' };

    return (
      <TableRow key={match.id}>
        <TableCell className="font-medium">{match.group_id || 'N/A'}</TableCell>
        <TableCell>
          {match.teamA ? (
            <div className="flex items-center space-x-2">
              <Image src={match.teamA.logoUrl!} alt={match.teamA.name} width={24} height={24} className="rounded-sm" />
              <span>{match.teamA.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Team TBD</span>
          )}
        </TableCell>
        <TableCell>
          {match.teamB ? (
            <div className="flex items-center space-x-2">
              <Image src={match.teamB.logoUrl!} alt={match.teamB.name} width={24} height={24} className="rounded-sm" />
              <span>{match.teamB.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Team TBD</span>
          )}
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
                  disabled={!match.teamA || !match.teamB}
                />
                <span>-</span>
                <Input
                  type="number"
                  className="w-16 h-8 text-center"
                  placeholder="0"
                  value={currentScores.teamBScore}
                  onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                  disabled={!match.teamA || !match.teamB}
                />
              </>
            ) : (
              <span>{match.teamA?.score ?? '-'} : {match.teamB?.score ?? '-'}</span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          {isEditing ? (
            <Button size="sm" onClick={() => handleSaveScore(match)} disabled={!match.teamA || !match.teamB}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => startEditing(match)} disabled={!match.teamA || !match.teamB}>
              <Edit className="h-4 w-4 mr-2" />
              {match.status === 'completed' ? 'Edit Score' : 'Enter Score'}
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const pendingMatches = matches.filter(m => m.status !== 'completed' && m.teamA && m.teamB);
  const completedMatches = matches.filter(m => m.status === 'completed');

  return (
    <div className="space-y-8">
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
                <Hourglass className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4">No matches are currently pending.</p>
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
          {completedMatches.length > 0 ? (
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
          ) : (
            <div className="text-center text-muted-foreground py-10">
                <CheckCircle2 className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4">No matches have been completed yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
