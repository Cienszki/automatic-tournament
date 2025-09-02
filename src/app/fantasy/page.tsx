"use client";

import PlayerSelectionCard from './PlayerSelectionCard';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Info, UserCircle, Lock, Trophy, Clock, Target, Users, BookOpen, Calculator, Award, TrendingUp, Swords, Zap } from "lucide-react";
import CreativeLeaderboards from '@/components/fantasy/CreativeLeaderboards';
import { useTranslation } from '@/hooks/useTranslation';
import type { PlayerRole, FantasyLineup, TournamentPlayer } from "@/lib/definitions";
import { PlayerRoles, FANTASY_BUDGET_MMR } from "@/lib/definitions";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getAllTournamentPlayers, getUserFantasyLineup, saveUserFantasyLineup, getTournamentStatus } from "@/lib/firestore";
import { DiscordUsernameModal } from '@/components/app/DiscordUsernameModal';

// Simple number formatter to avoid hydration issues
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Mock data that simulates the real API structure
const mockLeaderboards = {
  overall: [
    {
      userId: "28vD5PHBQCMefj1gbWrX1R8kBjM2",
      displayName: "Valais",
      averageScore: 95.24,
      gamesPlayed: 18,
      rank: 1,
      currentLineup: {
        "Carry": { id: "1", nickname: "Valais", role: "Carry" },
        "Mid": { id: "2", nickname: "Gandalf1k", role: "Mid" }
      }
    },
    {
      userId: "CTRKrFfa37MuLQymMNEv9r4kVUh2",
      displayName: ".joxxi",
      averageScore: 93.17,
      gamesPlayed: 25,
      rank: 2,
      currentLineup: {}
    },
    {
      userId: "1uTIoCrW2vaa0rMy04MR55Pt3GA2",
      displayName: "BeBoy", 
      averageScore: 92.97,
      gamesPlayed: 30,
      rank: 3,
      currentLineup: {}
    },
    {
      userId: "ECWWYGZeAuRh4nyD8zcNh2NFX2r2",
      displayName: "AaDeHaDe",
      averageScore: 92.97,
      gamesPlayed: 30,
      rank: 4,
      currentLineup: {}
    },
    {
      userId: "vqqEyhJ9U7ZMESuFm4RelmByIhm2",
      displayName: "Pocieszny",
      averageScore: 92.97,
      gamesPlayed: 30,
      rank: 5,
      currentLineup: {}
    }
  ],
  byRole: {
    'Carry': [
      { playerId: "oXYYBpa30uErWzrnzdAk", nickname: "Valais", teamName: "Pora na Przygode", averageScore: 120.5, totalMatches: 10, rank: 1 },
      { playerId: "HsMv06e5VSBpzpkBsNQd", nickname: "Juxi1337", teamName: "CINCO PERROS", averageScore: 115.2, totalMatches: 12, rank: 2 }
    ],
    'Mid': [
      { playerId: "UTsAbjuxuaPuQbzkAZND", nickname: "Gandalf1k", teamName: "Psychiatryk", averageScore: 125.3, totalMatches: 8, rank: 1 },
      { playerId: "7sXBiIbXSl5ijRV0weub", nickname: "Joxxi", teamName: "CINCO PERROS", averageScore: 118.7, totalMatches: 11, rank: 2 }
    ],
    'Offlane': [
      { playerId: "ak4dmw4VEYK0zCY1O2Zo", nickname: "Budda-", teamName: "Pora na Przygode", averageScore: 108.9, totalMatches: 9, rank: 1 }
    ],
    'Soft Support': [
      { playerId: "zkw87djJSxaAqf4Pu3Yr", nickname: "AaDeHaDe", teamName: "Jest Letko", averageScore: 85.3, totalMatches: 18, rank: 1 }
    ],
    'Hard Support': [
      { playerId: "73vueKAfZLRv0zeXYjAE", nickname: "Be Boy", teamName: "Jest Letko", averageScore: 75.8, totalMatches: 22, rank: 1 }
    ]
  }
};

const mockPlayers = [
  { id: "1", nickname: "Valais", role: "Carry", mmr: 4167, teamName: "Pora na Przygode" },
  { id: "2", nickname: "Gandalf1k", role: "Mid", mmr: 9500, teamName: "Psychiatryk" },
  { id: "3", nickname: "Budda-", role: "Offlane", mmr: 5338, teamName: "Pora na Przygode" },
  { id: "4", nickname: "AaDeHaDe", role: "Soft Support", mmr: 3891, teamName: "Jest Letko" },
  { id: "5", nickname: "Be Boy", role: "Hard Support", mmr: 3856, teamName: "Jest Letko" },
];

const TEAM_MMR_CAP = 25000;

// Helper function to get display name for round
function getRoundDisplayName(roundId: string): string {
  const roundNames: Record<string, string> = {
    'initial': 'Registration',
    'pre_season': 'Pre-Season',
    'group_stage': 'Group Stage',
    'wildcards': 'Wildcards',
    'playoffs_round1': 'Playoffs Round 1',
    'playoffs_round2': 'Playoffs Round 2', 
    'playoffs_round3': 'Playoffs Round 3',
    'playoffs_round4': 'Playoffs Round 4',
    'playoffs_round5': 'Playoffs Round 5',
    'playoffs_round6': 'Playoffs Round 6',
    'playoffs_round7': 'Finals',
    'finished': 'Tournament Finished'
  };
  return roundNames[roundId] || roundId;
}

// Helper function to get the next round (what users are selecting for)
function getTargetRound(currentRound: string): string {
  const roundSequence = [
    'initial', 'pre_season', 'group_stage', 'wildcards', 
    'playoffs_round1', 'playoffs_round2', 'playoffs_round3', 
    'playoffs_round4', 'playoffs_round5', 'playoffs_round6', 'playoffs_round7'
  ];
  const currentIndex = roundSequence.indexOf(currentRound);
  if (currentIndex === -1 || currentIndex === roundSequence.length - 1) {
    return currentRound;
  }
  return roundSequence[currentIndex + 1];
}

export default function FantasyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [selectedLineup, setSelectedLineup] = useState<Partial<Record<PlayerRole, TournamentPlayer>>>({});
  const [currentRound, setCurrentRound] = useState<string>('group_stage');
  const [existingLineup, setExistingLineup] = useState<FantasyLineup | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  
  // Leaderboards
  const [leaderboards, setLeaderboards] = useState<any>(null);
  const [leaderboardsLoading, setLeaderboardsLoading] = useState(true);
  const [leaderboardsError, setLeaderboardsError] = useState<string | null>(null);
  
  // User fantasy stats
  const [userFantasyStats, setUserFantasyStats] = useState<{
    averageScore: number;
    totalGames: number;
  }>({
    averageScore: 0,
    totalGames: 0
  });

  // Computed values
  const playersByRole = useMemo(() => {
    const grouped: Record<PlayerRole, TournamentPlayer[]> = {
      "Carry": [],
      "Mid": [],
      "Offlane": [],
      "Soft Support": [],
      "Hard Support": []
    };
    
    players.forEach(player => {
      if (PlayerRoles.includes(player.role)) {
        grouped[player.role].push(player);
      }
    });
    
    // Sort by MMR descending within each role
    Object.keys(grouped).forEach(role => {
      grouped[role as PlayerRole].sort((a, b) => b.mmr - a.mmr);
    });
    
    return grouped;
  }, [players]);

  const currentBudgetUsed = useMemo(() => {
    return Object.values(selectedLineup).reduce((total, player) => {
      return total + (player?.mmr || 0);
    }, 0);
  }, [selectedLineup]);

  const budgetRemaining = FANTASY_BUDGET_MMR - currentBudgetUsed;
  const budgetPercentage = (currentBudgetUsed / FANTASY_BUDGET_MMR) * 100;

  const isLineupComplete = PlayerRoles.every(role => selectedLineup[role]);
  const canSaveLineup = isLineupComplete && currentBudgetUsed <= FANTASY_BUDGET_MMR;

  // Event handlers
  const handlePlayerSelect = useCallback((role: PlayerRole, playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    setSelectedLineup(prev => ({
      ...prev,
      [role]: player
    }));
  }, [players]);

  const handleSaveLineup = useCallback(async () => {
    if (!user || !canSaveLineup) return;

    setIsSubmitting(true);
    try {
      await saveUserFantasyLineup(
        user.uid,
        selectedLineup as Record<PlayerRole, TournamentPlayer>,
        currentRound,
        user.displayName || 'Anonymous'
      );

      const lineup: FantasyLineup = {
        userId: user.uid,
        displayName: user.displayName || 'Anonymous',
        roundId: currentRound,
        lineup: selectedLineup as Record<PlayerRole, TournamentPlayer>,
        submittedAt: new Date().toISOString(),
      };
      setExistingLineup(lineup);

      toast({
        title: t('fantasy.messages.success'),
        description: t('fantasy.messages.lineupSaved'),
      });
    } catch (error) {
      console.error('Error saving fantasy lineup:', error);
      toast({
        title: t('fantasy.messages.error'),
        description: t('fantasy.messages.failedToSave'),
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  }, [user, canSaveLineup, currentRound, selectedLineup, t, toast]);

  // Data fetching
  useEffect(() => {
    const loadData = async () => {
      try {
        setPlayersLoading(true);
        const [tournamentPlayers, tournamentStatus] = await Promise.all([
          getAllTournamentPlayers(),
          getTournamentStatus(),
        ]);

        setPlayers(tournamentPlayers);
        setCurrentRound(tournamentStatus?.roundId || 'group_stage');

        // Load existing lineup if user is logged in
        if (user) {
          try {
            const existingLineup = await getUserFantasyLineup(user.uid, tournamentStatus?.roundId || 'group_stage');
            if (existingLineup) {
              setExistingLineup(existingLineup);
              setSelectedLineup(existingLineup.lineup);
            }
          } catch (error) {
            console.log('No existing lineup found, starting fresh');
          }
        }
      } catch (error) {
        console.error('Error loading fantasy data:', error);
        toast({
          title: t('fantasy.messages.error'),
          description: t('fantasy.messages.failedToLoadData'),
          variant: "destructive",
        });
      }
      setPlayersLoading(false);
    };

    loadData();
  }, [user]);

  useEffect(() => {
    const fetchLeaderboards = async () => {
      try {
        console.log('🚀 Starting leaderboard fetch...');
        setLeaderboardsLoading(true);
        const response = await fetch('/api/fantasy/leaderboards');
        console.log('📡 Response received:', response.status, response.ok);
        const data = await response.json();
        console.log('📊 Data received:', data.success, 'Keys:', Object.keys(data));
        
        if (data.success) {
          console.log('✅ Setting leaderboards data - FIXED ALGORITHM');
          console.log('📊 Algorithm:', data.algorithm);
          console.log('📅 Generated at:', data.generatedAt);
          setLeaderboards(data.leaderboards);
        } else {
          console.log('❌ API returned error:', data.message);
          setLeaderboardsError(data.message || 'Failed to load leaderboards. Please run fixed fantasy recalculation first.');
          setLeaderboards(null);
        }
      } catch (err) {
        console.error('💥 Error fetching leaderboards:', err);
        setLeaderboardsError('Network error: Failed to load leaderboards');
        setLeaderboards(null);
      } finally {
        console.log('🏁 Setting loading to false');
        setLeaderboardsLoading(false);
      }
    };

    fetchLeaderboards();
  }, []);

  // Extract user's fantasy stats from leaderboards data when available
  useEffect(() => {
    if (leaderboards && user) {
      try {
        // Find current user in the overall leaderboard
        const userStats = leaderboards.overall?.find(
          (player: any) => player.userId === user.uid
        );
        
        if (userStats) {
          setUserFantasyStats({
            averageScore: userStats.averageScore || 0,
            totalGames: userStats.gamesPlayed || 0
          });
        }
      } catch (error) {
        console.log('Could not extract user stats from leaderboards:', error);
      }
    }
  }, [leaderboards, user]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <Card className="hidden md:flex shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/fantasy.png)` }} />
      </Card>

      <Card className="flex md:hidden shadow-xl text-center relative overflow-hidden h-[120px] flex-col justify-center items-center p-4 bg-black">
        <span className="text-3xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_#39ff14] font-neon-bines">
          {t('fantasy.title')}
        </span>
      </Card>

      {/* How to Play Section */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {t('fantasy.howToPlay.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {t('fantasy.howToPlay.teamBuilding.title')}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• {t('fantasy.howToPlay.teamBuilding.selectPlayers')}</li>
                <li>• {t('fantasy.howToPlay.teamBuilding.mmrLimit')}</li>
                <li>• {t('fantasy.howToPlay.teamBuilding.chooseWisely')}</li>
                <li>• {t('fantasy.howToPlay.teamBuilding.changeLineup')}</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t('fantasy.howToPlay.scoring.title')}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• {t('fantasy.howToPlay.scoring.point1')}</li>
                <li>• {t('fantasy.howToPlay.scoring.point2')}</li>
                <li>• {t('fantasy.howToPlay.scoring.point3')}</li>
                <li>• {t('fantasy.howToPlay.scoring.point4')}</li>
                <li>• {t('fantasy.howToPlay.scoring.point5')}</li>
                <li>• {t('fantasy.howToPlay.scoring.point6')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Selection Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t('fantasy.teamBuilder.title')}
          </CardTitle>
          <CardDescription>
            {t('fantasy.teamBuilder.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enhanced Round and Stats Info */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/30 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            <div className="relative p-6">
              <div className="flex flex-col space-y-6">
                {/* Current Tournament Status */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-primary animate-pulse" />
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('fantasy.rounds.currentRound')}</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-2">{getRoundDisplayName(currentRound)}</div>
                  <div className="w-16 h-1 bg-primary/50 rounded-full mx-auto"></div>
                </div>

                {/* Selection Target - Most Important */}
                <div className="text-center bg-primary/20 rounded-lg p-4 border-2 border-primary/40">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Target className="h-6 w-6 text-primary" />
                    <span className="text-base font-semibold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">WYBIERASZ SKŁAD DLA:</span>
                  </div>
                  <div className="text-3xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-2 drop-shadow-sm">
                    {getRoundDisplayName(getTargetRound(currentRound))}
                  </div>
                  <div className="text-xs bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent font-medium">
                    Ten skład zostanie użyty w rundzie {getRoundDisplayName(getTargetRound(currentRound))}
                  </div>
                </div>

                {/* Player Stats */}
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center bg-white/10 rounded-lg p-3 min-w-[80px]">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {userFantasyStats.averageScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wynik</div>
                  </div>
                  <div className="w-px h-12 bg-primary/30"></div>
                  <div className="text-center bg-white/10 rounded-lg p-3 min-w-[80px]">
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {userFantasyStats.totalGames}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('fantasy.stats.gamesPlayed')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>{t('fantasy.teamBuilder.mmrBudgetUsed')}</Label>
              <span className="font-mono">
                {formatNumber(currentBudgetUsed)} / {formatNumber(FANTASY_BUDGET_MMR)}
              </span>
            </div>
            <Progress 
              value={budgetPercentage} 
              className={`h-3 ${budgetPercentage > 100 ? 'bg-red-200' : ''}`}
            />
            <div className="text-xs text-muted-foreground">
              {t('fantasy.teamBuilder.remaining')}: {formatNumber(budgetRemaining)} MMR
            </div>
            {budgetRemaining < 0 && (
              <div className="text-xs text-red-600 font-medium">
                Over budget by {formatNumber(Math.abs(budgetRemaining))} MMR
              </div>
            )}
          </div>

          {playersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Role Selection Grid */}
              <div className="grid lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 gap-4">
                {PlayerRoles.map((role) => (
                  <PlayerSelectionCard
                    key={role}
                    role={role}
                    playersByRole={playersByRole}
                    selectedLineup={selectedLineup}
                    onPlayerSelect={handlePlayerSelect}
                  />
                ))}
              </div>

              <div className="text-center">
                {user ? (
                  <Button 
                    size="lg" 
                    className="w-full md:w-auto" 
                    disabled={!canSaveLineup || isSubmitting}
                    onClick={handleSaveLineup}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : canSaveLineup ? (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        {existingLineup ? 'Update Lineup' : t('fantasy.buildTeam.saveLineup')}
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        {!isLineupComplete ? 'Complete team first' : 'Over budget'}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button size="lg" className="w-full md:w-auto" disabled>
                    <UserCircle className="h-4 w-4 mr-2" />
                    {t('common.login')} to save lineup
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Fantasy Leaderboards */}
      {leaderboardsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('fantasy.leaderboards.loading')}</p>
        </div>
      ) : leaderboardsError ? (
        <div className="text-center py-8">
          <p className="text-destructive mb-4">⚠️ {leaderboardsError}</p>
          <p className="text-muted-foreground text-sm">{t('fantasy.leaderboards.showingFallback')}</p>
        </div>
      ) : null}
      
      {leaderboards && (
        <CreativeLeaderboards leaderboards={leaderboards} />
      )}
      
      {!leaderboards && !leaderboardsLoading && (
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t('fantasy.leaderboards.notAvailable')}</h3>
            <p className="text-muted-foreground mb-4">
              {leaderboardsError || t('fantasy.leaderboards.notReady')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('fantasy.leaderboards.contactAdmin')}
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}