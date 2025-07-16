
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Crown, Info, UserCircle, BarChart2, Swords, Sparkles, Shield as ShieldIconLucide, HandHelping, Eye as EyeIconLucide, Lock } from "lucide-react";
import type { PlayerRole, FantasyLineup, FantasyData, TournamentPlayer } from "@/lib/definitions";
import { PlayerRoles, FANTASY_BUDGET_MMR } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getAllTournamentPlayers, getFantasyLeaderboard, getUserFantasyLineup, saveUserFantasyLineup } from "@/lib/firestore";
import { getTournamentStatus, TournamentStatus } from "@/lib/admin";

const roleIcons: Record<PlayerRole, React.ElementType> = {
  Carry: Swords, Mid: Sparkles, Offlane: ShieldIconLucide, "Soft Support": HandHelping, "Hard Support": EyeIconLucide,
};

export default function FantasyLeaguePage() {
  const { user, signInWithDiscord, signOut } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<TournamentStatus | null>(null);
  const [selectedLineup, setSelectedLineup] = useState<FantasyLineup>({});
  const [currentBudgetUsed, setCurrentBudgetUsed] = useState(0);
  const [availablePlayers, setAvailablePlayers] = useState<TournamentPlayer[]>([]);
  const [fantasyLeaderboard, setFantasyLeaderboard] = useState<FantasyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadFantasyData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [players, leaderboard, currentStatus] = await Promise.all([
        getAllTournamentPlayers(),
        getFantasyLeaderboard(),
        getTournamentStatus(),
      ]);
      setAvailablePlayers(players);
      setFantasyLeaderboard(leaderboard);
      setStatus(currentStatus);

      if (user) {
        const userLineup = await getUserFantasyLineup(user.uid);
        if (userLineup) {
          setSelectedLineup(userLineup);
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not load fantasy data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadFantasyData();
  }, [loadFantasyData]);

  useEffect(() => {
    const cost = Object.values(selectedLineup).reduce((sum, player) => sum + (player ? player.mmr : 0), 0);
    setCurrentBudgetUsed(cost);
  }, [selectedLineup]);

  const handlePlayerSelect = (role: PlayerRole, playerId: string) => {
    const playerToSelect = availablePlayers.find(p => p.id === playerId);
    if (!playerToSelect) return;

    const currentLineup = { ...selectedLineup };
    const existingPlayerInRole = currentLineup[role];
    let tempBudget = currentBudgetUsed - (existingPlayerInRole?.mmr || 0) + playerToSelect.mmr;

    if (tempBudget > FANTASY_BUDGET_MMR) {
      toast({ title: "Budget Exceeded", description: `Cannot select this player.`, variant: "destructive" });
      return;
    }
    const isAlreadySelected = Object.values(currentLineup).some(p => p?.id === playerId && p.role !== role);
    if (isAlreadySelected) {
      toast({ title: "Player Already Picked", description: "This player is in another role.", variant: "destructive" });
      return;
    }

    currentLineup[role] = playerToSelect;
    setSelectedLineup(currentLineup);
  };

  const handleConfirmLineup = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await saveUserFantasyLineup(user.uid, selectedLineup, user.displayName || "Anonymous");
      toast({ title: "Success!", description: "Your fantasy lineup has been saved for the next round." });
      await loadFantasyData(); // Refresh all data
    } catch (error) {
      toast({ title: "Error", description: "Failed to save your lineup.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const canSaveLineup = useMemo(() => {
      const rolesFilled = Object.values(selectedLineup).filter(p => p).length === PlayerRoles.length;
      const budgetOK = currentBudgetUsed <= FANTASY_BUDGET_MMR;
      return rolesFilled && budgetOK;
  }, [selectedLineup, currentBudgetUsed]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-12">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/liga_fantasy.png)` }} />
        <div className="relative z-10">
          <Crown className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>Fantasy League</h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>Assemble your dream team and climb the ranks!</p>
        </div>
      </Card>

      {!user ? (
        <Card className="shadow-lg text-center"><CardHeader><CardTitle>Join the League!</CardTitle></CardHeader><CardContent><p className="mb-4">Login to create your team.</p><Button onClick={signInWithDiscord}>Login with Discord</Button></CardContent></Card>
      ) : (
        <>
          <div className="flex justify-end items-center"><Button onClick={signOut} variant="outline">Logout</Button></div>
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-2xl flex items-center"><UserCircle className="mr-2" />Build Your Team</CardTitle><CardDescription>Current Round: <span className="font-bold text-primary">{status?.roundId || 'N/A'}</span></CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg"><div className="flex justify-between items-center mb-1"><Label>Budget Used:</Label><div className={cn("font-bold", currentBudgetUsed > FANTASY_BUDGET_MMR ? 'text-destructive' : 'text-primary')}>{currentBudgetUsed.toLocaleString()} / {FANTASY_BUDGET_MMR.toLocaleString()}</div></div><Progress value={(currentBudgetUsed / FANTASY_BUDGET_MMR) * 100} indicatorClassName={cn(currentBudgetUsed > FANTASY_BUDGET_MMR && "bg-destructive")} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PlayerRoles.map(role => <PlayerSelectionCard key={role} role={role} availablePlayers={availablePlayers} selectedLineup={selectedLineup} onPlayerSelect={handlePlayerSelect} currentBudgetUsed={currentBudgetUsed} />)}
              </div>
            </CardContent>
            <CardFooter><Button onClick={handleConfirmLineup} size="lg" disabled={!canSaveLineup || isSaving} className="w-full">{isSaving ? <><Loader2 className="mr-2 animate-spin" /> Saving...</> : <><Lock className="mr-2" /> Save Lineup</>}</Button></CardFooter>
          </Card>
        </>
      )}

      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-2xl flex items-center"><BarChart2 className="mr-2" />Leaderboard</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Player</TableHead><TableHead>Current Lineup</TableHead><TableHead className="text-right">Total Points</TableHead></TableRow></TableHeader>
              <TableBody>
                {fantasyLeaderboard.map((p, i) => <LeaderboardRow key={p.userId} participant={p} rank={i + 1} isCurrentUser={user?.uid === p.userId} />)}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

const PlayerSelectionCard = ({ role, availablePlayers, selectedLineup, onPlayerSelect, currentBudgetUsed }: { role: PlayerRole, availablePlayers: TournamentPlayer[], selectedLineup: FantasyLineup, onPlayerSelect: Function, currentBudgetUsed: number }) => {
  const RoleIcon = roleIcons[role];
  const playersForRole = availablePlayers.filter(p => p.role === role);
  const selectedPlayer = selectedLineup[role];

  return (
    <Card className="flex flex-col"><CardHeader><CardTitle className="flex items-center"><RoleIcon className="mr-2" />{role}</CardTitle></CardHeader>
      <CardContent className="flex-grow grid grid-cols-2 gap-x-4 items-center">
        <div>{selectedPlayer ? <div className="p-3 border rounded-md flex items-center space-x-3"><Avatar><AvatarImage src={selectedPlayer.profileScreenshotUrl} /><AvatarFallback>{selectedPlayer.nickname.charAt(0)}</AvatarFallback></Avatar><div><p className="font-semibold truncate">{selectedPlayer.nickname}</p><p className="text-xs text-muted-foreground">Cost: {selectedPlayer.mmr.toLocaleString()}</p></div></div> : <div className="p-3 border rounded-md text-center flex items-center justify-center min-h-[76px]"><p className="text-sm italic">Not Selected</p></div>}</div>
        <div>
          <Select value={selectedPlayer?.id || ""} onValueChange={(pid) => onPlayerSelect(role, pid)}>
            <SelectTrigger><SelectValue placeholder="Select Player..." /></SelectTrigger>
            <SelectContent>
              {playersForRole.map(p => {
                const isSelected = Object.values(selectedLineup).some(sp => sp?.id === p.id && sp.role !== role);
                const budgetAfter = currentBudgetUsed - (selectedPlayer?.mmr || 0) + p.mmr;
                const isDisabled = isSelected || budgetAfter > FANTASY_BUDGET_MMR;
                return <SelectItem key={p.id} value={p.id} disabled={isDisabled}><div className="flex justify-between w-full"><span>{p.nickname}</span><span className={cn("text-xs ml-2",isDisabled && !isSelected ? 'text-destructive' : 'text-muted-foreground')}>{p.mmr.toLocaleString()}</span></div></SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

const LeaderboardRow = ({ participant, rank, isCurrentUser }: { participant: FantasyData, rank: number, isCurrentUser: boolean }) => (
  <TableRow className={cn(isCurrentUser && "bg-primary/10")}>
    <TableCell className="font-bold text-center">{rank}</TableCell>
    <TableCell>{participant.participantName} {isCurrentUser && "(You)"}</TableCell>
    <TableCell>
      <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1">
        {PlayerRoles.map(role => {
          const player = participant.currentLineup?.[role];
          return <div key={role} className="flex items-center space-x-1.5 text-xs" title={`${role}: ${player?.nickname || 'N/A'}`}>
            {React.createElement(roleIcons[role], { className: "h-3.5 w-3.5 text-muted-foreground shrink-0" })}
            {player ? <Link href={`/teams/${player.teamId}/players/${player.id}`} className="text-primary hover:underline truncate">{player.nickname}</Link> : <span className="italic">-</span>}
          </div>
        })}
      </div>
    </TableCell>
    <TableCell className="text-right font-semibold">{participant.totalFantasyPoints.toLocaleString()}</TableCell>
  </TableRow>
);
