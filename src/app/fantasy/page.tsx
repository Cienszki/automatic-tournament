
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlayerAvatar } from "@/components/app/PlayerAvatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Crown, Info, UserCircle, BarChart2, Swords, Sparkles, Shield as ShieldIconLucide, HandHelping, Eye as EyeIconLucide, Lock } from "lucide-react";
import type { PlayerRole, FantasyLineup, FantasyData, TournamentPlayer, UserProfile } from "@/lib/definitions";
import { PlayerRoles, TEAM_MMR_CAP } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { getAllTournamentPlayers, getFantasyLeaderboard, getUserFantasyLineup, saveUserFantasyLineup, getUserProfile, updateUserProfile, getTournamentStatus } from "@/lib/firestore";
import { DiscordUsernameModal } from '@/components/app/DiscordUsernameModal';

const roleIcons: Record<PlayerRole, React.ElementType> = {
  Carry: Swords, Mid: Sparkles, Offlane: ShieldIconLucide, "Soft Support": HandHelping, "Hard Support": EyeIconLucide,
};

// Define a more specific type for leaderboard participants
interface LeaderboardParticipant {
    userId: string;
    displayName: string;
    totalFantasyScore: number;
    lineup: Partial<Record<PlayerRole, TournamentPlayer>>;
}

export default function FantasyLeaguePage() {
  const { user, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedLineup, setSelectedLineup] = useState<Partial<Record<PlayerRole, TournamentPlayer>>>({});
  const [availablePlayers, setAvailablePlayers] = useState<TournamentPlayer[]>([]);
  const [fantasyLeaderboard, setFantasyLeaderboard] = useState<LeaderboardParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);

  const loadFantasyData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("Loading fantasy data...");
      
      const [players, leaderboard, status] = await Promise.all([
        getAllTournamentPlayers().catch(err => {
          console.error("Error loading players:", err);
          throw new Error(`Failed to load players: ${err.message}`);
        }),
        getFantasyLeaderboard().catch(err => {
          console.error("Error loading leaderboard:", err);
          throw new Error(`Failed to load leaderboard: ${err.message}`);
        }),
        getTournamentStatus().catch(err => {
          console.error("Error loading tournament status:", err);
          throw new Error(`Failed to load tournament status: ${err.message}`);
        }),
      ]);
      
      console.log("Loaded data:", { playersCount: players.length, leaderboardCount: leaderboard.length, status });
      
      setAvailablePlayers(players);
      setFantasyLeaderboard(leaderboard as LeaderboardParticipant[]);
      setCurrentRoundId(status?.roundId || 'initial');

      if (user && status?.roundId) {
        const [userLineup, profile] = await Promise.all([
            getUserFantasyLineup(user.uid, status.roundId),
            getUserProfile(user.uid)
        ]);
        if (userLineup) setSelectedLineup(userLineup.lineup);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error("Fantasy data loading error:", error);
      toast({ 
        title: t('fantasy.messages.error'), 
        description: `${t('fantasy.messages.failedToLoadData')}: ${error instanceof Error ? error.message : t('fantasy.messages.unknownError')}`, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadFantasyData();
  }, [loadFantasyData]);

  const currentBudgetUsed = useMemo(() => {
    return Object.values(selectedLineup).reduce((sum, player) => sum + (player ? player.mmr : 0), 0);
  }, [selectedLineup]);

  const playersByRole = useMemo(() => {
    const grouped: Record<PlayerRole, TournamentPlayer[]> = {
      "Carry": [], "Mid": [], "Offlane": [], "Soft Support": [], "Hard Support": [],
    };
    availablePlayers.forEach(player => {
        if (grouped[player.role]) {
            grouped[player.role].push(player);
        }
    });
    for (const role in grouped) {
        grouped[role as PlayerRole].sort((a, b) => a.nickname.localeCompare(b.nickname));
    }
    return grouped;
  }, [availablePlayers]);

  const handlePlayerSelect = (role: PlayerRole, playerId: string) => {
    const playerToSelect = availablePlayers.find(p => p.id === playerId);
    if (!playerToSelect) return;
    
    if (Object.values(selectedLineup).some(p => p?.id === playerId)) {
        toast({ 
          title: t('fantasy.messages.playerAlreadySelected'), 
          description: t('fantasy.messages.playerAlreadySelectedDescription'), 
          variant: "destructive" 
        });
        return;
    }

    setSelectedLineup(prev => ({ ...prev, [role]: playerToSelect }));
  };

  const performSave = async () => {
    if (!user || !canSaveLineup || !currentRoundId) return;
    setIsSaving(true);
    try {
      await saveUserFantasyLineup(user.uid, selectedLineup as Record<PlayerRole, TournamentPlayer>, currentRoundId, user.displayName || "Anonymous");
      toast({ 
        title: t('fantasy.messages.success'), 
        description: t('fantasy.messages.lineupSaved') 
      });
      await loadFantasyData();
    } catch (error) {
      toast({ 
        title: t('fantasy.messages.error'), 
        description: t('fantasy.messages.failedToSave'), 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
      if (!userProfile?.discordUsername) {
          setIsModalOpen(true);
      } else {
          performSave();
      }
  };

  const handleModalSubmit = async (username: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
        await updateUserProfile(user.uid, { discordUsername: username });
        setUserProfile(prev => ({ ...prev, uid: user.uid, discordUsername: username }));
        setIsModalOpen(false);
        await performSave();
    } catch (error) {
        toast({ 
          title: t('fantasy.messages.error'), 
          description: t('fantasy.messages.failedToSaveDiscord'), 
          variant: "destructive"
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const canSaveLineup = useMemo(() => {
      const rolesFilled = Object.keys(selectedLineup).length === PlayerRoles.length;
      const budgetOK = currentBudgetUsed <= TEAM_MMR_CAP;
      return rolesFilled && budgetOK;
  }, [selectedLineup, currentBudgetUsed]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-12">
      <DiscordUsernameModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        isSubmitting={isSaving}
      />
      {/* Desktop: show image banner with fixed height */}
      <Card className="hidden md:flex shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/fantasy.png)` }} />
      </Card>
      {/* Mobile: show text banner with neon font */}
      <Card className="flex md:hidden shadow-xl text-center relative overflow-hidden h-[120px] flex-col justify-center items-center p-4 bg-black">
        <span className="text-3xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_#39ff14] font-neon-bines">
          {t('fantasy.title')}
        </span>
      </Card>

      {!user ? (
        <Card className="shadow-lg text-center">
          <CardHeader>
            <CardTitle>{t('fantasy.joinLeague.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{t('fantasy.joinLeague.description')}</p>
            <Button onClick={signInWithGoogle}>{t('common.signIn')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <UserCircle className="mr-2" />
                {t('fantasy.buildTeam.title')}
              </CardTitle>
              <CardDescription>
                {t('fantasy.buildTeam.currentRound')}: <span className="font-bold text-primary">{currentRoundId || 'N/A'}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <Label>{t('fantasy.buildTeam.budgetUsed')}:</Label>
                  <div className={cn("font-bold", currentBudgetUsed > TEAM_MMR_CAP ? 'text-destructive' : 'text-primary')}>
                    {currentBudgetUsed.toLocaleString()} / {TEAM_MMR_CAP.toLocaleString()}
                  </div>
                </div>
                <Progress value={(currentBudgetUsed / TEAM_MMR_CAP) * 100} indicatorClassName={cn(currentBudgetUsed > TEAM_MMR_CAP && "bg-destructive")} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PlayerRoles.map(role => 
                  <PlayerSelectionCard 
                    key={role} 
                    role={role} 
                    playersByRole={playersByRole} 
                    selectedLineup={selectedLineup} 
                    onPlayerSelect={handlePlayerSelect} 
                  />
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveClick} size="lg" disabled={!canSaveLineup || isSaving} className="w-full">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" /> 
                    {t('fantasy.buildTeam.saving')}...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2" /> 
                    {t('fantasy.buildTeam.saveLineup')}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <BarChart2 className="mr-2" />
            {t('fantasy.leaderboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fantasy.leaderboard.rank')}</TableHead>
                  <TableHead>{t('fantasy.leaderboard.player')}</TableHead>
                  <TableHead>{t('fantasy.leaderboard.currentLineup')}</TableHead>
                  <TableHead className="text-right">{t('fantasy.leaderboard.totalPoints')}</TableHead>
                </TableRow>
              </TableHeader>
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

const PlayerSelectionCard = ({ role, playersByRole, selectedLineup, onPlayerSelect }: { role: PlayerRole, playersByRole: Record<PlayerRole, TournamentPlayer[]>, selectedLineup: Partial<Record<PlayerRole, TournamentPlayer>>, onPlayerSelect: Function }) => {
  const { t } = useTranslation();
  const RoleIcon = roleIcons[role];
  const selectedPlayer = selectedLineup[role];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <RoleIcon className="mr-2" />
          {t(`players.roles.${role}` as any)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between space-y-4 pt-0">
        <Select value={selectedPlayer?.id || ""} onValueChange={(pid) => onPlayerSelect(role, pid)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`${t('fantasy.buildTeam.selectA')} ${t(`players.roles.${role}` as any)}...`} />
          </SelectTrigger>
          <SelectContent>
            {playersByRole[role].map(p => (
              <SelectItem key={p.id} value={p.id} disabled={Object.values(selectedLineup).some(sp => sp?.id === p.id && sp.role !== role)}>
                <div className="flex justify-between w-full">
                  <span className="truncate" title={`${p.nickname} (${p.teamTag})`}>{p.nickname} ({p.teamTag})</span>
                  <span className="text-xs text-muted-foreground ml-4 shrink-0">{p.mmr.toLocaleString()} MMR</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPlayer ? (
          <div className="p-3 border rounded-md flex items-center space-x-3 bg-muted/20 min-h-[76px]">
            <PlayerAvatar player={selectedPlayer} />
            <div className="overflow-hidden">
              <p className="font-semibold truncate" title={selectedPlayer.nickname}>{selectedPlayer.nickname}</p>
              <p className="text-xs text-muted-foreground">MMR: {selectedPlayer.mmr.toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 border rounded-md text-center flex items-center justify-center min-h-[76px] bg-muted/20">
            <p className="text-sm italic text-muted-foreground">No player selected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const LeaderboardRow = ({ participant, rank, isCurrentUser }: { participant: LeaderboardParticipant, rank: number, isCurrentUser: boolean }) => {
  const { t } = useTranslation();
  
  return (
    <TableRow className={cn(isCurrentUser && "bg-primary/10")}>
      <TableCell className="font-bold text-center">{rank}</TableCell>
      <TableCell>
        {participant.displayName} {isCurrentUser && `(${t('fantasy.leaderboard.you')})`}
      </TableCell>
      <TableCell>
        <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {PlayerRoles.map(role => {
            const player = participant.lineup?.[role];
            return (
              <div key={role} className="flex items-center space-x-1.5 text-xs" title={`${t(`players.roles.${role}` as any)}: ${player?.nickname || 'N/A'}`}>
                {React.createElement(roleIcons[role], { className: "h-3.5 w-3.5 text-muted-foreground shrink-0" })}
                {player ? (
                  <Link href={`/teams/${player.teamId}/players/${player.id}`} className="text-primary hover:underline truncate">
                    {player.nickname}
                  </Link>
                ) : (
                  <span className="italic">-</span>
                )}
              </div>
            );
          })}
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold">{participant.totalFantasyScore.toLocaleString()}</TableCell>
    </TableRow>
  );
};
