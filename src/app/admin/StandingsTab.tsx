
"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Edit, CheckCircle2, Hourglass, RotateCcw, Loader2, FileJson } from "lucide-react";
import { getAllMatches, updateMatchScores } from "@/lib/firestore";
import { revertMatchToPending } from "@/lib/admin-actions";
// Removed direct import of adminDeleteGameAndHandleScore - now using API
import { GameDeleteModal } from "@/components/admin/GameDeleteModal";
import type { Match } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
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

// Import the new modal component (we'll create this next)
import { MatchImportModal } from '@/components/admin/MatchImportModal';

type MatchScoreState = {
  [matchId: string]: {
    teamAScore: string;
    teamBScore: string;
  };
};

export function StandingsTab() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [scores, setScores] = React.useState<MatchScoreState>({});
  const [editingMatchId, setEditingMatchId] = React.useState<string | null>(null);
  const [revertingMatchId, setRevertingMatchId] = React.useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [matchToImport, setMatchToImport] = React.useState<Match | null>(null);
  const [isGameDeleteModalOpen, setIsGameDeleteModalOpen] = React.useState(false);
  const [gameDeleteMatch, setGameDeleteMatch] = React.useState<Match | null>(null);
  const [gamesForDelete, setGamesForDelete] = React.useState<{ id: string; name: string }[]>([]);
  const [isRecalculatingStandings, setIsRecalculatingStandings] = React.useState(false);
  // Helper to fetch games for a match (from games subcollection)
  async function fetchGamesForMatch(match: Match) {
    // This should be replaced with a real API call or Firestore query
    // For now, fake it with game_ids
    if (!match.game_ids || match.game_ids.length === 0) return [];
    return match.game_ids.map((id) => ({ id: id.toString(), name: `Game ${id}` }));
  }

  const handleOpenGameDeleteModal = async (match: Match) => {
    setGameDeleteMatch(match);
    setIsGameDeleteModalOpen(true);
    const games = await fetchGamesForMatch(match);
    setGamesForDelete(games);
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!gameDeleteMatch || !user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/deleteGame', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          match: gameDeleteMatch, 
          gameId 
        }),
      });

      const result = await response.json();
      
      toast({
        title: result.success ? "Game Deleted" : "Delete Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete the game. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsGameDeleteModalOpen(false);
    setGameDeleteMatch(null);
    setGamesForDelete([]);
    // Optionally re-fetch matches to update UI
    const allMatches = await getAllMatches();
    setMatches(allMatches.sort((a,b) => (a.group_id || '').localeCompare(b.group_id || '')));
  };

  const handleRecalculateStandings = async () => {
    if (!user) {
      toast({ 
        title: t('toasts.errors.auth.title'), 
        description: t('toasts.errors.auth.loginRequired'), 
        variant: "destructive" 
      });
      return;
    }

    setIsRecalculatingStandings(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/recalculateStandings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      
      if (result.success) {
        toast({ 
          title: t('toasts.success.title'), 
          description: t('toasts.success.standingsRecalculated') 
        });
      } else {
        toast({ 
          title: t('toasts.errors.title'), 
          description: result.message || t('toasts.errors.admin.recalculateStandings'), 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('Error recalculating standings:', error);
      toast({ 
        title: t('toasts.errors.title'), 
        description: t('toasts.errors.unexpectedStandings'), 
        variant: "destructive" 
      });
    } finally {
      setIsRecalculatingStandings(false);
    }
  };

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
        toast({ 
          title: t('toasts.errors.auth.title'), 
          description: t('toasts.errors.auth.loginRequired'), 
          variant: "destructive" 
        });
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
            ? { ...m, status: 'scheduled', schedulingStatus: 'unscheduled', teamA: {...m.teamA, score: 0}, teamB: {...m.teamB, score: 0}, game_ids: [] } 
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

  const handleOpenImportModal = (match: Match) => {
    setMatchToImport(match);
    setIsImportModalOpen(true);
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
                <Button size="sm" variant="destructive" onClick={() => handleOpenGameDeleteModal(match)} disabled={!match.game_ids || match.game_ids.length === 0}>
                  Delete Game
                </Button>
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
                         {match.status !== 'completed' && match.teamA && match.teamB && (
                            <Button size="sm" variant="outline" onClick={() => handleOpenImportModal(match)} disabled={isReverting}>
                                <FileJson className="h-4 w-4 mr-2" />
                                Import Game Data
                            </Button>
                         )}
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
      <MatchImportModal 
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          match={matchToImport}
          onImportSuccess={() => {
            setIsImportModalOpen(false);
            setMatchToImport(null);
            // Optionally re-fetch matches here to update the UI
            // fetchMatches(); // You might need to pass fetchMatches down or use a context
          }}
      />
      <GameDeleteModal
        isOpen={isGameDeleteModalOpen}
        onClose={() => setIsGameDeleteModalOpen(false)}
        games={gamesForDelete}
        onDelete={handleDeleteGame}
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Group Stage Management</CardTitle>
          <CardDescription>Administrative tools for managing group stage standings and calculations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleRecalculateStandings}
              disabled={isRecalculatingStandings}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isRecalculatingStandings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {isRecalculatingStandings ? "Recalculating..." : "Recalculate Group Standings"}
            </Button>
            <p className="text-sm text-muted-foreground self-center">
              Use this button to manually recalculate all group standings based on completed matches.
            </p>
          </div>
        </CardContent>
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
