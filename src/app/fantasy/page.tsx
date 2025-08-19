"use client";

import PlayerSelectionCard from './PlayerSelectionCard';
import LeaderboardRow from './LeaderboardRow';
import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/app/PlayerAvatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Crown, Info, UserCircle, BarChart2, Lock } from "lucide-react";
import type { PlayerRole, FantasyLineup, FantasyData, TournamentPlayer, UserProfile } from "@/lib/definitions";
import { PlayerRoles, TEAM_MMR_CAP } from "@/lib/definitions";
import { roleIcons } from "./roleIcons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import type { PlayerSelectionCardProps } from "./PlayerSelectionCardProps";
import { getAllTournamentPlayers, getFantasyLeaderboard, getUserFantasyLineup, saveUserFantasyLineup, getUserProfile, updateUserProfile, getTournamentStatus, createUserProfileIfNotExists } from "@/lib/firestore";
import { translations } from "@/lib/translations";
import { DiscordUsernameModal } from '@/components/app/DiscordUsernameModal';


// Get the round that lineups should be saved FOR based on the current round
function getTargetRoundForLineup(currentRound: string): string {
  const roundSequence = [
    'initial', 
    'pre_season', 
    'group_stage', 
    'wildcards', 
    'playoffs_round1', 
    'playoffs_round2', 
    'playoffs_round3', 
    'playoffs_round4', 
    'playoffs_round5', 
    'playoffs_round6', 
    'playoffs_round7'
  ];
  const currentIndex = roundSequence.indexOf(currentRound);
  if (currentIndex === -1 || currentIndex === roundSequence.length - 1) {
    return currentRound; // Unknown round or last round, use as-is
  }
  return roundSequence[currentIndex + 1]; // Return next round
}

interface LeaderboardParticipant {
  userId: string;
  displayName: string;
  totalFantasyScore: number;
  lineup: Partial<Record<PlayerRole, TournamentPlayer>>;
}


function FantasyLeaguePage() {
  // ...existing code...
  const { t } = useTranslation();
  const { user, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [selectedLineup, setSelectedLineup] = useState<Partial<Record<PlayerRole, TournamentPlayer>>>({});
  const [availablePlayers, setAvailablePlayers] = useState<TournamentPlayer[]>([]);
  const [fantasyLeaderboard, setFantasyLeaderboard] = useState<LeaderboardParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);

  type Scoring = {
    title: string;
    general: string;
    roshan: string;
    win: string;
    barracks: string;
    towers: string;
    playerStats: string;
    kill: string;
    death: string;
    assist: string;
    gpm: string;
    xpm: string;
    points: string;
  };

  const scoringDefaults: Scoring = {
    title: '',
    general: '',
    roshan: '',
    win: '',
    barracks: '',
    towers: '',
    playerStats: '',
    kill: '',
    death: '',
    assist: '',
    gpm: '',
    xpm: '',
    points: ''
  };

  const lang = typeof window !== 'undefined' && (navigator.language.startsWith('pl') ? 'pl' : 'en');

  const scoring: Scoring = (typeof translations.fantasyScoring === 'object' && translations.fantasyScoring !== null && !Array.isArray(translations.fantasyScoring))
    ? { ...scoringDefaults, ...(translations.fantasyScoring[lang as keyof typeof translations.fantasyScoring] || translations.fantasyScoring.pl) }
    : scoringDefaults;

  const currentBudgetUsed = useMemo(() => {
    return Object.values(selectedLineup).reduce(
      (sum, player) => sum + (player && typeof player.mmr === 'number' ? player.mmr : 0),
      0
    );
  }, [selectedLineup]);

  // Fantasy scoring table
  const ScoringTable = () => {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{scoring.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <div className="mb-4">
              <strong>{scoring.general}:</strong>
              <ul className="list-disc ml-6 mt-2">
                <li>{scoring.roshan}: +20 {scoring.points}</li>
                <li>{scoring.win}: +10 {scoring.points}</li>
                <li>{scoring.barracks}: +10 {scoring.points}</li>
                <li>{scoring.towers}: +10 {scoring.points}</li>
              </ul>
            </div>
            <div>
              <strong>{scoring.playerStats}:</strong>
              <ul className="list-disc ml-6 mt-2">
                <li>{scoring.kill}: +3 {scoring.points}</li>
                <li>{scoring.death}: -1 {scoring.points}</li>
                <li>{scoring.assist}: +2 {scoring.points}</li>
                <li>{scoring.gpm}: +1 {scoring.points} / 100 GPM</li>
                <li>{scoring.xpm}: +1 {scoring.points} / 100 XPM</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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
        const [profile] = await Promise.all([
            createUserProfileIfNotExists(user).catch(() => getUserProfile(user.uid)) // fallback to getUserProfile if createUserProfileIfNotExists fails
        ]);
        
        // Try to get lineup for current round, then fallback to previous rounds to preserve selections
        let userLineup = null;
        const currentRound = status.roundId;
        
        // Define round priority for fallback (most recent first)
        const roundPriority = ['playoffs', 'group_stage', 'pre_season', 'initial'];
        const rounds = [currentRound, ...roundPriority.filter(r => r !== currentRound)];
        
        for (const roundId of rounds) {
          try {
            userLineup = await getUserFantasyLineup(user.uid, roundId);
            if (userLineup) break;
          } catch (error) {
            console.log(`No lineup found for round: ${roundId}`);
          }
        }
        
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
  }, [user, toast, t]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadFantasyData();
  }, []);

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
    
    // Require Discord username - no fallbacks for privacy
    if (!userProfile?.discordUsername) {
      setIsModalOpen(true);
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Get the target round to save lineup FOR (next round)
      const targetRound = getTargetRoundForLineup(currentRoundId);
      console.log(`Saving lineup for target round: ${targetRound} (current round: ${currentRoundId})`);
      
      await saveUserFantasyLineup(user.uid, selectedLineup as Record<PlayerRole, TournamentPlayer>, targetRound, userProfile.discordUsername);
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
      // Always require Discord username - no privacy fallbacks
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
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div></div>;
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

      {/* Instructions Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Info className="mr-2" />
            {t('fantasy.buildTeam.instructions.title')}
          </CardTitle>
          <CardDescription>
            {t('fantasy.hero.openToAll')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
              <p>{t('fantasy.buildTeam.instructions.step1')}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
              <p>{t('fantasy.buildTeam.instructions.step2')}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
              <p>{t('fantasy.buildTeam.instructions.step3')}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">4</div>
              <p>{t('fantasy.buildTeam.instructions.step4')}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">5</div>
              <p>{t('fantasy.buildTeam.instructions.step5')}</p>
            </div>
          </div>
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center space-x-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm">{t('fantasy.buildTeam.instructions.scoring')}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-destructive" />
              <p className="font-semibold text-sm text-destructive">{t('fantasy.buildTeam.instructions.deadline')}</p>
            </div>
          </div>
        </CardContent>
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
            <CardFooter className="flex-col space-y-3">
              {!userProfile?.discordUsername && (
                <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-amber-800">
                    <Info className="h-4 w-4 flex-shrink-0" />
                    <div className="text-sm">
                      <strong>Discord username required:</strong> You need to provide your Discord username to save lineups and participate in the leaderboard.
                    </div>
                  </div>
                </div>
              )}
              <Button onClick={handleSaveClick} size="lg" disabled={!canSaveLineup || isSaving} className="w-full">
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div>
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

export default FantasyLeaguePage;