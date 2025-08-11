'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Target, Sword, TrendingUp, Zap, Trophy, InfoIcon } from 'lucide-react';
import { translations } from '@/lib/translations';

// Tooltip component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-50 w-64 p-2 mt-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg -translate-x-1/2 left-1/2">
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
          {content}
        </div>
      )}
    </div>
  );
};

// Type definitions (you may need to adjust these based on your actual types)
interface TournamentStats {
  id: string;
  totalGames: number;
  totalKills: number;
  averageMatchDuration: number;
  totalGoldGenerated: number;
  mostPickedHero?: {
    heroName: string;
    pickCount: number;
  };
  mostBannedHero?: {
    heroName: string;
    banCount: number;
  };
  highestWinRateHero?: {
    heroName: string;
    winRate: number;
    gamesPlayed: number;
  };
}

interface PlayerStats {
  id: string;
  playerId: string;
  // Combat Records
  mostKillsSingleMatch?: { value: number };
  mostAssistsSingleMatch?: { value: number };
  highestKDA?: { value: number };
  mostHeroDamageSingleMatch?: { value: number };
  mostTowerDamageSingleMatch?: { value: number };
  mostHealingSingleMatch?: { value: number };
  longestKillStreak?: { value: number };
  fastestVictory?: { value: number };
  mostCourierKills?: { value: number };
  mostRoshanKills?: { value: number };
  
  // Farming & Economy
  highestGPMSingleMatch?: { value: number };
  highestXPMSingleMatch?: { value: number };
  mostLastHitsSingleMatch?: { value: number };
  mostDeniesSingleMatch?: { value: number };
  mostGoldSpentSingleMatch?: { value: number };
  mostBuybacksSingleMatch?: { value: number };
  fastestMidasTime?: { value: number };
  mostTPScrollsUsed?: { value: number };
  earliestLevel25?: { value: number };
  highestNetWorth?: { value: number };
  fastestAghanims?: { value: number };
  
  // Vision & Map Control  
  mostObserverWardsSingleMatch?: { value: number };
  mostSentryWardsSingleMatch?: { value: number };
  mostObserverKillsSingleMatch?: { value: number };
  mostSentryKillsSingleMatch?: { value: number };
  mostCampsStacked?: { value: number };
  mostRunesCollected?: { value: number };
  highestAPMSingleMatch?: { value: number };
  longestStunDuration?: { value: number };
  
  // Special Achievements
  mostRampagesSingleMatch?: { value: number };
  mostNeutralKillsSingleMatch?: { value: number };
  mostAncientKillsSingleMatch?: { value: number };
  totalRampages?: { value: number };
  mostVersatile?: { value: number }; // number of different heroes played
  
  // Fantasy Performance
  bestFantasyScore?: { value: number };
  averageFantasyPoints?: { value: number };
}

interface TeamStats {
  id: string;
  teamId: string;
  fastestVictory?: { duration: number };
  mostTeamKillsSingleMatch?: { value: number };
  perfectStructureGame?: { value: boolean };
}

interface Match {
  id: string;
  status: string;
  winnerId: string;
  teamA: { id: string };
}

interface Player {
  id: string;
  nickname: string;
}

interface Team {
  id: string;
  name: string;
  wins?: number;
  losses?: number;
  matchesPlayed?: number;
  averageFantasyPoints?: number;
  averageMatchDurationMinutes?: number;
  players?: Player[];
}

export default function StatsPage() {
  // Translation function
  const t = (key: string): string => {
    const keys = key.split('.');
    let current: any = translations;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return typeof current === 'string' ? current : key;
  };
  const [isLoading, setIsLoading] = useState(true);
  const [tournamentStats, setTournamentStats] = useState<TournamentStats | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  // Helper function to find player name by ID
  const findPlayerName = (playerId: string): string => {
    for (const team of teams) {
      const foundPlayer = team.players?.find(p => p.id === playerId);
      if (foundPlayer) {
        return foundPlayer.nickname;
      }
    }
    return 'Unknown';
  };

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    let subscriptionsCompleted = 0;
    const totalSubscriptions = 6;

    const checkAllLoaded = () => {
      subscriptionsCompleted++;
      console.log(`Firestore subscription ${subscriptionsCompleted}/${totalSubscriptions} completed`);
      if (subscriptionsCompleted >= totalSubscriptions) {
        setIsLoading(false);
      }
    };

    // Subscribe to tournament stats
    const tournamentStatsRef = collection(db, 'tournamentStats');
    const unsubscribeTournamentStats = onSnapshot(tournamentStatsRef, (snapshot) => {
      console.log('Tournament stats snapshot:', snapshot.size, 'documents');
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setTournamentStats({ id: doc.id, ...doc.data() } as TournamentStats);
        console.log('Tournament stats loaded:', doc.data());
      }
      checkAllLoaded();
    }, (error) => {
      console.error('Error loading tournament stats:', error);
      checkAllLoaded();
    });
    unsubscribers.push(unsubscribeTournamentStats);

    // Subscribe to player stats
    const playerStatsRef = collection(db, 'playerStats');
    const unsubscribePlayerStats = onSnapshot(playerStatsRef, (snapshot) => {
      console.log('Player stats snapshot:', snapshot.size, 'documents');
      const stats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats));
      setPlayerStats(stats);
      checkAllLoaded();
    }, (error) => {
      console.error('Error loading player stats:', error);
      checkAllLoaded();
    });
    unsubscribers.push(unsubscribePlayerStats);

    // Subscribe to team stats
    const teamStatsRef = collection(db, 'teamStats');
    const unsubscribeTeamStats = onSnapshot(teamStatsRef, (snapshot) => {
      console.log('Team stats snapshot:', snapshot.size, 'documents');
      const stats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamStats));
      setTeamStats(stats);
      checkAllLoaded();
    }, (error) => {
      console.error('Error loading team stats:', error);
      checkAllLoaded();
    });
    unsubscribers.push(unsubscribeTeamStats);

    // Subscribe to matches
    const matchesRef = collection(db, 'matches');
    const unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
      console.log('Matches snapshot:', snapshot.size, 'documents');
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setMatches(matchesData);
      checkAllLoaded();
    }, (error) => {
      console.error('Error loading matches:', error);
      checkAllLoaded();
    });
    unsubscribers.push(unsubscribeMatches);

    // Subscribe to teams
    const teamsRef = collection(db, 'teams');
    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      console.log('Teams snapshot:', snapshot.size, 'documents');
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);
      checkAllLoaded();
    }, (error) => {
      console.error('Error loading teams:', error);
      checkAllLoaded();
    });
    unsubscribers.push(unsubscribeTeams);

    // Subscribe to players
    const playersRef = collection(db, 'players');
    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      console.log('Players snapshot:', snapshot.size, 'documents');
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(playersData);
      checkAllLoaded();
    }, (error) => {
      console.error('Error loading players:', error);
      checkAllLoaded();
    });
    unsubscribers.push(unsubscribePlayers);

    // Timeout fallback
    const timeout = setTimeout(() => {
      console.log('Timeout reached, stopping loading state');
      setIsLoading(false);
    }, 2000);

    return () => {
      clearTimeout(timeout);
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-primary to-accent rounded-full shadow-lg mb-6">
            <Loader2 className="h-12 w-12 animate-spin text-white" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            {t('stats.loadingStats')}
          </h2>
          <p className="text-muted-foreground">{t('stats.statsWillAppear')}</p>
        </div>
      </div>
    );
  }

  const completedMatches = matches.filter(m => m.status === 'completed');
  const totalMatches = matches.length;
  const completionRate = totalMatches > 0 ? (completedMatches.length / totalMatches) * 100 : 0;

  console.log('Stats Page Debug:', {
    isLoading,
    tournamentStats: !!tournamentStats,
    playerStatsCount: playerStats.length,
    teamStatsCount: teamStats.length,
    matchesCount: matches.length,
    teamsCount: teams.length,
    playersCount: players.length
  });

  // Show empty state if no data is available
  const hasAnyData = tournamentStats || playerStats.length > 0 || teamStats.length > 0 || matches.length > 0 || teams.length > 0 || players.length > 0;
  
  // Always show the dashboard, but with N/A values when data is missing

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
        {/* Hero Section with Clean Background Image */}
        <Card className="shadow-xl text-center relative overflow-hidden h-[400px] flex-col justify-center p-0 border-0">
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center" 
            style={{ backgroundImage: 'url(/backgrounds/stats.png)' }} 
          />
          {/* Minimal overlay for text readability */}
          <div className="absolute inset-0 z-10 bg-black/10" />
          <div className="relative z-20 h-full flex flex-col justify-center space-y-6 px-6">
            <div className="space-y-4">
              {/* Title removed */}
            </div>
          </div>
        </Card>

        {/* Quick Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
              {matches.length}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.totalMatches')}</div>
          </Card>
          <Card className="p-4 text-center border border-accent/20 bg-gradient-to-br from-accent/5 to-accent/10">
            <div className="text-2xl md:text-3xl font-bold text-accent mb-1">
              {teams.length}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.totalTeams')}</div>
          </Card>
          <Card className="p-4 text-center border border-secondary/20 bg-gradient-to-br from-secondary/5 to-secondary/10">
            <div className="text-2xl md:text-3xl font-bold text-secondary mb-1">
              {players.length}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.totalPlayers')}</div>
          </Card>
          <Card className="p-4 text-center border border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
            <div className="text-2xl md:text-3xl font-bold text-secondary mb-1">
              {Math.round(completionRate)}%
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.completionRate')}</div>
          </Card>
        </div>

        <Tabs defaultValue="players" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 h-12 rounded-xl p-1 bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-md border-2 border-primary/30">
            <TabsTrigger 
              value="players" 
              className="text-sm font-bold rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Target className="w-4 h-4 mr-2" />
              {t('stats.playerRecords')}
            </TabsTrigger>
            <TabsTrigger 
              value="vision" 
              className="text-sm font-bold rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Zap className="w-4 h-4 mr-2" />
              {t('stats.tournamentOverview')}
            </TabsTrigger>
            <TabsTrigger 
              value="teams" 
              className="text-sm font-bold rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Sword className="w-4 h-4 mr-2" />
              {t('stats.teamRecords')}
            </TabsTrigger>
            <TabsTrigger 
              value="meta" 
              className="text-sm font-bold rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Trophy className="w-4 h-4 mr-2" />
              {t('stats.metaStats')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="players" className="space-y-8">
            <div className="grid gap-6">
              {/* Individual Combat Records */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sword className="h-5 w-5 text-primary" />
                    {t('stats.combatRecords')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                      <div className="text-lg font-bold text-primary">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostKillsSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostKillsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostKills')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostKillsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostKillsSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-accent/20 to-accent/10">
                      <div className="text-lg font-bold text-accent">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostAssistsSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostAssistsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostAssists')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostAssistsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostAssistsSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-2/20 to-chart-2/10">
                      <div className="text-lg font-bold text-chart-2">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.highestKDA?.value || 0)).toFixed(2) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.highestKDATooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.highestKDA')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.highestKDA?.value === Math.max(...playerStats.map(p => p.highestKDA?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-4/20 to-chart-4/10">
                      <div className="text-lg font-bold text-chart-4">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.fastestVictory?.value || 0)) + 'm' : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.fastestVictoryTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.fastestVictory')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.fastestVictory?.value === Math.max(...playerStats.map(p => p.fastestVictory?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-3/20 to-chart-3/10">
                      <div className="text-lg font-bold text-chart-3">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostHeroDamageSingleMatch?.value || 0)).toLocaleString() : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostHeroDamageTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostHeroDamage')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostHeroDamageSingleMatch?.value === Math.max(...playerStats.map(p => p.mostHeroDamageSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10">
                      <div className="text-lg font-bold text-secondary">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostHealingSingleMatch?.value || 0)).toLocaleString() : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostHealingTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostHealing')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostHealingSingleMatch?.value === Math.max(...playerStats.map(p => p.mostHealingSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-1/20 to-chart-1/10">
                      <div className="text-lg font-bold text-chart-1">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostTowerDamageSingleMatch?.value || 0)).toLocaleString() : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostTowerDamageTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostTowerDamage')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostTowerDamageSingleMatch?.value === Math.max(...playerStats.map(p => p.mostTowerDamageSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-5/20 to-chart-5/10">
                      <div className="text-lg font-bold text-chart-5">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.longestKillStreak?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.longestKillStreakTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.longestKillStreak')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.longestKillStreak?.value === Math.max(...playerStats.map(p => p.longestKillStreak?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-1/20 to-chart-1/10">
                      <div className="text-lg font-bold text-chart-1">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostCourierKills?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostCourierKillsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostCourierKills')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostCourierKills?.value === Math.max(...playerStats.map(p => p.mostCourierKills?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                      <div className="text-lg font-bold text-primary">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostRoshanKills?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostRoshanKillsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostRoshanKills')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostRoshanKills?.value === Math.max(...playerStats.map(p => p.mostRoshanKills?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Farming & Economy Records */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-secondary" />
                    ?? {t('stats.farmingEconomy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10">
                      <div className="text-lg font-bold text-secondary">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.highestGPMSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.highestGPMTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.highestGPM')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.highestGPMSingleMatch?.value === Math.max(...playerStats.map(p => p.highestGPMSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-accent/20 to-accent/10">
                      <div className="text-lg font-bold text-accent">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.highestXPMSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.highestXPMTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.highestXPM')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.highestXPMSingleMatch?.value === Math.max(...playerStats.map(p => p.highestXPMSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-2/20 to-chart-2/10">
                      <div className="text-lg font-bold text-chart-2">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostLastHitsSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostLastHitsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostLastHits')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostLastHitsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostLastHitsSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-3/20 to-chart-3/10">
                      <div className="text-lg font-bold text-chart-3">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostDeniesSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostDeniesTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostDenies')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostDeniesSingleMatch?.value === Math.max(...playerStats.map(p => p.mostDeniesSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-4/20 to-chart-4/10">
                      <div className="text-lg font-bold text-chart-4">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostGoldSpentSingleMatch?.value || 0)).toLocaleString() : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostGoldSpentTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostGoldSpent')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostGoldSpentSingleMatch?.value === Math.max(...playerStats.map(p => p.mostGoldSpentSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                      <div className="text-lg font-bold text-primary">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostBuybacksSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostBuybacksTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostBuybacks')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostBuybacksSingleMatch?.value === Math.max(...playerStats.map(p => p.mostBuybacksSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                      <div className="text-lg font-bold text-primary">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.fastestMidasTime?.value || 0)) + 'm' : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.fastestMidasTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.fastestMidas')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.fastestMidasTime?.value === Math.max(...playerStats.map(p => p.fastestMidasTime?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-accent/20 to-accent/10">
                      <div className="text-lg font-bold text-accent">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.earliestLevel25?.value || 0)) + 'm' : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.earliestLevel25Tooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.earliestLevel25')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.earliestLevel25?.value === Math.max(...playerStats.map(p => p.earliestLevel25?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10">
                      <div className="text-lg font-bold text-secondary">
                        {playerStats.length > 0 ? (Math.max(...playerStats.map(p => p.highestNetWorth?.value || 0)) / 1000).toFixed(0) + 'K' : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.highestNetWorthTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.highestNetWorth')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.highestNetWorth?.value === Math.max(...playerStats.map(p => p.highestNetWorth?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Special Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-chart-2" />
                    ?? {t('stats.specialAchievements')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-2/20 to-chart-2/10">
                      <div className="text-lg font-bold text-chart-2">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.totalRampages?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.totalRampagesTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.totalRampages')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.totalRampages?.value === Math.max(...playerStats.map(p => p.totalRampages?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10">
                      <div className="text-lg font-bold text-secondary">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostNeutralKillsSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostNeutralKillsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostNeutralKills')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostNeutralKillsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostNeutralKillsSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-3/20 to-chart-3/10">
                      <div className="text-lg font-bold text-chart-3">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostAncientKillsSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostAncientKillsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostAncientKills')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostAncientKillsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostAncientKillsSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-5/20 to-chart-5/10">
                      <div className="text-lg font-bold text-chart-5">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.fastestAghanims?.value || 0)) + 'm' : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.fastestAghanimsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.fastestAghanims')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.fastestAghanims?.value === Math.max(...playerStats.map(p => p.fastestAghanims?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-4/20 to-chart-4/10">
                      <div className="text-lg font-bold text-chart-4">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostVersatile?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostVersatileTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostVersatile')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostVersatile?.value === Math.max(...playerStats.map(p => p.mostVersatile?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vision" className="space-y-6">
            <div className="grid gap-6">
              {/* Tournament Overview Records */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-chart-2" />
                    ?? {t('stats.tournamentOverview')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-lg">
                      <div className="text-2xl font-bold text-secondary mb-1">
                        {teams.length || 0}
                      </div>
                      <Tooltip content={t('stats.totalTeamsTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.totalTeams')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {teams.filter(t => t.matchesPlayed && t.matchesPlayed > 0).length} {t('stats.playedMatches')}
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg">
                      <div className="text-2xl font-bold text-accent mb-1">
                        {completedMatches.length}
                      </div>
                      <Tooltip content={t('stats.matchesCompletedTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.matchesCompleted')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        of {totalMatches} scheduled
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-chart-4/20 to-chart-4/10 rounded-lg">
                      <div className="text-2xl font-bold text-chart-4 mb-1">
                        {players.length || 0}
                      </div>
                      <Tooltip content={t('stats.activeTeamsTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.activePlayers')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        registered players
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-chart-3/20 to-chart-3/10 rounded-lg">
                      <div className="text-2xl font-bold text-chart-3 mb-1">
                        {tournamentStats?.averageMatchDuration ? Math.round(tournamentStats.averageMatchDuration / 60) + 'm' : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.avgMatchDurationTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.avgMatchDuration')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {tournamentStats?.averageMatchDuration ? Math.round(tournamentStats.averageMatchDuration % 60) + 's' : ''}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* MVP & Performance Awards */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-chart-3" />
                    ?? {t('stats.topPerformers')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-chart-2/20 to-chart-2/10 rounded-lg border-2 border-chart-2/30">
                      <div className="text-lg font-bold text-chart-2 mb-1">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.highestKDA?.value === Math.max(...playerStats.map(p => p.highestKDA?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                      <Tooltip content={t('stats.tournamentMVPTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.tournamentMVP')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          (Math.max(...playerStats.map(p => p.highestKDA?.value || 0)) / 1).toFixed(2) + ' KDA' :
                          'N/A'
                        }
                      </div>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg border-2 border-accent/30">
                      <div className="text-lg font-bold text-accent mb-1">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.mostObserverWardsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostObserverWardsSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                      <Tooltip content={t('stats.supportMVPTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.supportMVP')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          Math.max(...playerStats.map(p => p.mostObserverWardsSingleMatch?.value || 0)) + ' wards' :
                          'N/A'
                        }
                      </div>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-lg border-2 border-secondary/30">
                      <div className="text-lg font-bold text-secondary mb-1">
                        {playerStats.length > 0 ? 
                          findPlayerName(playerStats.find(ps => ps.highestGPMSingleMatch?.value === Math.max(...playerStats.map(p => p.highestGPMSingleMatch?.value || 0)))?.playerId || '') :
                          t('stats.noData')
                        }
                      </div>
                      <Tooltip content={t('stats.carryMVPTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.carryMVP')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {playerStats.length > 0 ? 
                          Math.max(...playerStats.map(p => p.highestGPMSingleMatch?.value || 0)) + ' GPM' :
                          'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tournament Combat Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sword className="h-5 w-5 text-primary" />
                    ?? {t('stats.tournamentCombat')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {tournamentStats?.totalKills?.toLocaleString() || 'N/A'}
                      </div>
                      <Tooltip content={t('stats.totalKillsTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.totalKills')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {tournamentStats?.totalKills && completedMatches.length > 0 ? 
                          Math.round(tournamentStats.totalKills / completedMatches.length) + ' avg/match' : 
                          ''
                        }
                      </div>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-br from-chart-4/20 to-chart-4/10 rounded-lg">
                      <div className="text-2xl font-bold text-chart-4 mb-1">
                        {playerStats.length > 0 ? playerStats.reduce((sum, p) => sum + (p.totalRampages?.value || 0), 0) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.totalRampagesCountTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.totalRampagesCount')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        pentakills total
                      </div>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-lg">
                      <div className="text-2xl font-bold text-secondary mb-1">
                        {completedMatches.length > 0 ? 
                          ((completedMatches.filter(m => m.winnerId === m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) :
                          '50.0'
                        }%
                      </div>
                      <Tooltip content={t('stats.radiantWinRateTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.radiantWinRate')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        vs {completedMatches.length > 0 ? 
                          ((completedMatches.filter(m => m.winnerId !== m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) :
                          '50.0'
                        }% Dire
                      </div>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-br from-chart-2/20 to-chart-2/10 rounded-lg">
                      <div className="text-2xl font-bold text-chart-2 mb-1">
                        {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostKillsSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.bloodiestGameTooltip')}>
                        <div className="text-sm font-medium cursor-help flex items-center justify-center gap-1">
                          {t('stats.bloodiestGame')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        single match record
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <div className="grid gap-6">
              {/* Team Performance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-chart-2" />
                    ?? {t('stats.teamPerformance')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {teams.slice(0, 8).map((team, index) => (
                      <div key={team.id} className="p-4 border rounded-lg bg-gradient-to-br from-primary/5 to-primary/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-lg font-bold text-primary">{team.name}</div>
                          <div className="text-sm font-medium text-muted-foreground">#{index + 1}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Wins:</span>
                            <span className="font-medium text-secondary">{team.wins || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Losses:</span>
                            <span className="font-medium text-primary">{team.losses || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Win Rate:</span>
                            <span className="font-medium">
                              {((team.wins || 0) / Math.max((team.wins || 0) + (team.losses || 0), 1) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Avg Match:</span>
                            <span className="font-medium">{team.averageMatchDurationMinutes || 0}m</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Team Records */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sword className="h-5 w-5 text-primary" />
                    ?? {t('stats.teamRecords')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 border rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10">
                      <div className="text-lg font-bold text-secondary">
                        {teamStats.length > 0 ? Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)) + 'm' : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.fastestTeamVictoryTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.fastestTeamVictory')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {teamStats.length > 0 ? 
                          teams.find(t => t.id === teamStats.find(ts => ts.fastestVictory?.duration === Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)))?.teamId)?.name || t('stats.noData') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                      <div className="text-lg font-bold text-primary">
                        {teamStats.length > 0 ? Math.max(...teamStats.map(t => t.mostTeamKillsSingleMatch?.value || 0)) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.mostTeamKillsTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.mostTeamKills')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {teamStats.length > 0 ? 
                          teams.find(t => t.id === teamStats.find(ts => ts.mostTeamKillsSingleMatch?.value === Math.max(...teamStats.map(t => t.mostTeamKillsSingleMatch?.value || 0)))?.teamId)?.name || t('stats.noData') :
                          t('stats.noData')
                        }
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-chart-2/20 to-chart-2/10">
                      <div className="text-lg font-bold text-chart-2">
                        {teamStats.filter(t => t.perfectStructureGame?.value).length}
                      </div>
                      <Tooltip content={t('stats.perfectStructureGamesTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.perfectStructureGames')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {t('stats.totalAchieved')}
                      </div>
                    </div>

                    <div className="p-3 border rounded-lg bg-gradient-to-br from-accent/20 to-accent/10">
                      <div className="text-lg font-bold text-accent">
                        {teams.length > 0 ? Math.max(...teams.map(t => t.averageFantasyPoints || 0)).toFixed(1) : 'N/A'}
                      </div>
                      <Tooltip content={t('stats.bestFantasyPerformanceTooltip')}>
                        <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                          {t('stats.bestFantasyPerformance')}
                          <InfoIcon className="h-3 w-3 opacity-50" />
                        </div>
                      </Tooltip>
                      <div className="text-xs text-muted-foreground">
                        {teams.length > 0 ? 
                          teams.find(t => t.averageFantasyPoints === Math.max(...teams.map(t => t.averageFantasyPoints || 0)))?.name || t('stats.noData') :
                          t('stats.noData')
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tournament Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-secondary" />
                    ?? {t('stats.tournamentStatistics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg">
                      <div className="text-2xl font-bold text-accent mb-1">{teams.length}</div>
                      <div className="text-sm font-medium">{t('stats.totalTeams')}</div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-lg">
                      <div className="text-2xl font-bold text-secondary mb-1">
                        {completedMatches.length}
                      </div>
                      <div className="text-sm font-medium">{t('stats.completedMatches')}</div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-chart-4/20 to-chart-4/10 rounded-lg">
                      <div className="text-2xl font-bold text-chart-4 mb-1">
                        {Math.round(completionRate)}%
                      </div>
                      <div className="text-sm font-medium">{t('stats.completionRate')}</div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-chart-3/20 to-chart-3/10 rounded-lg">
                      <div className="text-2xl font-bold text-chart-3 mb-1">
                        {tournamentStats?.averageMatchDuration ? Math.round(tournamentStats.averageMatchDuration / 60) : 'N/A'}
                      </div>
                      <div className="text-sm font-medium">{t('stats.avgMatchDuration')} (min)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="meta" className="space-y-6">
            <div className="grid gap-6">
              {/* Hero Meta Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2 text-lg">
                      <Target className="h-5 w-5 text-primary" />
                      {t('stats.mostPopularHero')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary mb-2">
                      {tournamentStats?.mostPickedHero?.heroName || t('stats.noData')}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tournamentStats?.mostPickedHero?.pickCount || 0} {t('stats.picks')}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2 text-lg">
                      <Zap className="h-5 w-5 text-chart-4" />
                      {t('stats.mostBannedHero')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-chart-4 mb-2">
                      {tournamentStats?.mostBannedHero?.heroName || t('stats.noData')}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tournamentStats?.mostBannedHero?.banCount || 0} {t('stats.bans')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2 text-lg">
                      <Trophy className="h-5 w-5 text-secondary" />
                      {t('stats.highestWinRate')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-secondary mb-2">
                      {tournamentStats?.highestWinRateHero?.heroName || t('stats.noData')}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tournamentStats?.highestWinRateHero?.winRate ? Math.round(tournamentStats.highestWinRateHero.winRate * 100) : 0}% {t('stats.winRate')}
                      <span className="block text-xs">
                        ({tournamentStats?.highestWinRateHero?.gamesPlayed || 0} games)
                      </span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tournament Meta Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-accent" />
                    ?? {t('stats.tournamentMeta')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {tournamentStats?.totalKills?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="text-sm font-medium">{t('stats.totalKills')}</div>
                      <div className="text-xs text-muted-foreground">
                        {tournamentStats?.totalKills && completedMatches.length > 0 ? 
                          Math.round(tournamentStats.totalKills / completedMatches.length) + ' avg/match' : 
                          ''
                        }
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-chart-2/20 to-chart-2/10 rounded-lg">
                      <div className="text-2xl font-bold text-chart-2 mb-1">
                        {tournamentStats?.totalGoldGenerated ? Math.round(tournamentStats.totalGoldGenerated / 1000000) + 'M' : 'N/A'}
                      </div>
                      <div className="text-sm font-medium">{t('stats.totalGold')}</div>
                      <div className="text-xs text-muted-foreground">
                        {tournamentStats?.totalGoldGenerated && completedMatches.length > 0 ? 
                          Math.round(tournamentStats.totalGoldGenerated / completedMatches.length / 1000) + 'K avg/match' : 
                          ''
                        }
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg">
                      <div className="text-2xl font-bold text-accent mb-1">
                        {tournamentStats?.averageMatchDuration ? Math.round(tournamentStats.averageMatchDuration / 60) + 'm' : 'N/A'}
                      </div>
                      <div className="text-sm font-medium">{t('stats.avgGameLength')}</div>
                      <div className="text-xs text-muted-foreground">
                        {tournamentStats?.averageMatchDuration ? 
                          Math.round(tournamentStats.averageMatchDuration % 60) + 's' : 
                          ''
                        }
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-lg">
                      <div className="text-2xl font-bold text-secondary mb-1">
                        {players.length || 0}
                      </div>
                      <div className="text-sm font-medium">{t('stats.activePlayers')}</div>
                      <div className="text-xs text-muted-foreground">
                        {teams.length} teams
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Game Phases & Side Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sword className="h-5 w-5 text-chart-3" />
                      ?? {t('stats.sideAnalysis')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-secondary/20 to-secondary/10 rounded-lg">
                        <div>
                          <div className="font-medium text-secondary">{t('stats.radiantWins')}</div>
                          <div className="text-xs text-muted-foreground">
                            {completedMatches.filter(m => m.winnerId === m.teamA?.id).length} victories
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-secondary">
                          {completedMatches.length > 0 ? 
                            ((completedMatches.filter(m => m.winnerId === m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) :
                            '50.0'
                          }%
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg">
                        <div>
                          <div className="font-medium text-primary">{t('stats.direWins')}</div>
                          <div className="text-xs text-muted-foreground">
                            {completedMatches.filter(m => m.winnerId !== m.teamA?.id).length} victories
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {completedMatches.length > 0 ? 
                            ((completedMatches.filter(m => m.winnerId !== m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) :
                            '50.0'
                          }%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-chart-4" />
                      ?? {t('stats.gamePhases')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{t('stats.earlyGame')} (0-15m)</span>
                        <span className="text-sm font-medium text-secondary">N/A</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{t('stats.midGame')} (15-35m)</span>
                        <span className="text-sm font-medium text-chart-2">N/A</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{t('stats.lateGame')} (35m+)</span>
                        <span className="text-sm font-medium text-primary">N/A</span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{t('stats.avgGameDuration')}</span>
                          <span className="text-sm font-bold text-primary">
                            {tournamentStats?.averageMatchDuration ? 
                              Math.round(tournamentStats.averageMatchDuration / 60) + 'm ' + 
                              Math.round(tournamentStats.averageMatchDuration % 60) + 's' : 
                              'N/A'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
