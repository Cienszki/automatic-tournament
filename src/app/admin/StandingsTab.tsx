
"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Edit, CheckCircle2, Hourglass, RotateCcw, Loader2 } from "lucide-react";
import { getAllMatches, updateMatchScores } from "@/lib/firestore";
import { revertMatchToPending } from "@/lib/admin-actions";
import type { Match } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
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

type MatchScoreState = {
  [matchId: string]: {
    teamAScore: string;
    teamBScore: string;
  };
};

export function StandingsTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [scores, setScores] = React.useState<MatchScoreState>({});
  const [editingMatchId, setEditingMatchId] = React.useState<string | null>(null);
  const [revertingMatchId, setRevertingMatchId] = React.useState<string | null>(null);


  React.useEffect(() => {
    async function fetchMatches() {
      const allMatches = await getAllMatches();
      setMatches(allMatches.sort((a,b) => (a.group_id || '').localeCompare(b.group_id || '')));
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

  const handleRevertMatch = async (matchId: string) => {
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
        return;
    }
    setRevertingMatchId(matchId);
    const token = await user.getIdToken();
    const result = await revertMatchToPending(token, matchId);
    toast({
        title: result.success ? "Success!" : "Revert Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive"
    });
    if (result.success) {
      // Update local state to reflect the change immediately
      setMatches(prevMatches => 
        prevMatches.map(m => 
          m.id === matchId 
            ? { ...m, status: 'scheduled', schedulingStatus: 'unscheduled', teamA: {...m.teamA, score: 0}, teamB: {...m.teamB, score: 0} } 
            : m
        )
      );
    }
    setRevertingMatchId(null);
  }

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
    const isReverting = revertingMatchId === match.id;
    const currentScores = scores[match.id] || { teamAScore: '', teamBScore: '' };

    return (
      <TableRow key={match.id} className={isEditing ? "bg-muted/50" : ""}>
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
            <div className="flex items-center justify-end gap-2">
                {isEditing ? (
                    <>
                        <Button size="sm" onClick={() => handleSaveScore(match)} disabled={!match.teamA || !match.teamB}>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingMatchId(null)}>
                            Cancel
                        </Button>
                    </>
                ) : (
                    <>
                        <Button size="sm" variant="outline" onClick={() => startEditing(match)} disabled={!match.teamA || !match.teamB || isReverting}>
                            <Edit className="h-4 w-4 mr-2" />
                            {match.status === 'completed' ? 'Edit Score' : 'Enter Score'}
                        </Button>
                        {match.status === 'completed' && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" disabled={isReverting}>
                                        {isReverting ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <RotateCcw className="h-4 w-4 mr-2" />}
                                        Revert
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Revert Match?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will reset the score of the match between {match.teamA.name} and {match.teamB.name} to 0-0 and set its status back to pending. This allows captains to manage it again. Are you sure?
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRevertMatch(match.id)}>Confirm Revert</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </>
                )}
            </div>
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
                        <TableHead>Group</TableHead>
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
          <CardDescription>Recently completed matches. You can edit the scores or revert the match to a pending state.</CardDescription>
        </CardHeader>
        <CardContent>
          {completedMatches.length > 0 ? (
            <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Group</TableHead>
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
