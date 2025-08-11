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
  mostKillsSingleMatch?: { value: number };
  highestGPMSingleMatch?: { value: number };
  highestXPMSingleMatch?: { value: number };
  mostLastHitsSingleMatch?: { value: number };
  mostDeniesSingleMatch?: { value: number };
  longestKillStreak?: { value: number };
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
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">Loading tournament statistics...</p>
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
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: 'url(/backgrounds/stats.png)' }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/30 via-black/20 to-black/30" />
        <CardContent className="relative z-20 flex flex-col justify-center h-full">
          {/* Hero section text removed to reveal background image */}
        </CardContent>
      </Card>

      {/* Tournament Overview - Expanded Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.totalMatches')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tournamentStats?.totalGames ?? totalMatches}</div>
            <p className="text-xs text-muted-foreground">
              {completedMatches.length} {t('stats.completed')} ({totalMatches > 0 ? ((completedMatches.length / totalMatches) * 100).toFixed(1) : '0'}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.totalKills')}</CardTitle>
            <Sword className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tournamentStats?.totalKills ?? 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {tournamentStats && completedMatches.length > 0 ? (tournamentStats.totalKills / completedMatches.length).toFixed(1) : 'N/A'} {t('stats.avgPerMatch')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.avgMatchDuration')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tournamentStats ? 
                `${Math.floor(tournamentStats.averageMatchDuration / 60)}:${String(tournamentStats.averageMatchDuration % 60).padStart(2, '0')}` 
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">{t('stats.minutes')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gold</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tournamentStats?.totalGoldGenerated?.toLocaleString() ?? 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {tournamentStats && completedMatches.length > 0 ? (tournamentStats.totalGoldGenerated / completedMatches.length).toFixed(0) : 'N/A'} {t('stats.avgPerMatch')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground">
              {teams.filter(t => (t.matchesPlayed || 0) > 0).length} played matches
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {completedMatches.filter(m => m.winnerId === m.teamA?.id).length}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.radiantWins')}</div>
            <div className="text-xs text-muted-foreground">
              {completedMatches.length > 0 ? ((completedMatches.filter(m => m.winnerId === m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) : '50.0'}%
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">
              {completedMatches.filter(m => m.winnerId !== m.teamA?.id).length}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.direWins')}</div>
            <div className="text-xs text-muted-foreground">
              {completedMatches.length > 0 ? ((completedMatches.filter(m => m.winnerId !== m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) : '50.0'}%
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {tournamentStats?.totalKills && tournamentStats?.totalGames ? Math.round(tournamentStats.totalKills / tournamentStats.totalGames) : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.killsPerGame')}</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">
              {tournamentStats?.mostPickedHero?.pickCount ?? 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.mostPicks')}</div>
            <div className="text-xs text-muted-foreground truncate">
              {tournamentStats?.mostPickedHero?.heroName ?? 'N/A'}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">
              {tournamentStats?.mostBannedHero?.banCount ?? 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.mostBans')}</div>
            <div className="text-xs text-muted-foreground truncate">
              {tournamentStats?.mostBannedHero?.heroName ?? 'N/A'}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">
              {tournamentStats?.totalKills ? Math.round(tournamentStats.totalKills / 10) : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">{t('stats.avgTeamFight')}</div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="players">{t('stats.playerRecords')}</TabsTrigger>
          <TabsTrigger value="teams">{t('stats.teamRecords')}</TabsTrigger>
          <TabsTrigger value="meta">{t('stats.metaStats')}</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="space-y-6">
          <div className="grid gap-6">
            {/* MVP Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-600">
                    <Trophy className="h-5 w-5" />
                    <Tooltip content={t('stats.tournamentMVPTooltip')}>
                      <span className="flex items-center gap-1">
                        {t('stats.tournamentMVP')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </span>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-xl">{t('stats.noData')}</p>
                    <p className="text-sm text-muted-foreground">{t('stats.tournamentMVPTooltip')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-600">
                    <Target className="h-5 w-5" />
                    <Tooltip content={t('stats.supportMVPTooltip')}>
                      <span className="flex items-center gap-1">
                        {t('stats.supportMVP')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </span>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-xl">{t('stats.noData')}</p>
                    <p className="text-sm text-muted-foreground">{t('stats.supportMVPTooltip')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <Zap className="h-5 w-5" />
                    <Tooltip content={t('stats.carryMVPTooltip')}>
                      <span className="flex items-center gap-1">
                        {t('stats.carryMVP')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </span>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-xl">{t('stats.noData')}</p>
                    <p className="text-sm text-muted-foreground">{t('stats.carryMVPTooltip')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Combat Performance Records */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⚔️ {t('stats.combatPerformance')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">
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

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <Tooltip content={t('stats.mostAssistsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostAssists')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <Tooltip content={t('stats.highestKDATooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        Highest KDA
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <Tooltip content={t('stats.mostHeroDamageTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostHeroDamage')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <Tooltip content={t('stats.mostHeroHealingTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostHeroHealing')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <Tooltip content={t('stats.mostTowerDamageTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostTowerDamage')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">
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

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-indigo-600">
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
                </div>
              </CardContent>
            </Card>

            {/* Farming & Economy Records */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🌾 {t('stats.farmingEconomy')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">
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

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">
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

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <Tooltip content={t('stats.highestNetWorthTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.highestNetWorth')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <Tooltip content={t('stats.mostGoldSpentTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostGoldSpent')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <Tooltip content={t('stats.mostBuybacksTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostBuybacks')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <Tooltip content={t('stats.fastestMidasTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.fastestMidas')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <Tooltip content={t('stats.mostTPScrollsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostTPScrolls')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <Tooltip content={t('stats.earliestLevel25Tooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.earliestLevel25')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Support & Vision Records */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👁️ {t('stats.supportVision')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <Tooltip content={t('stats.mostObserverWardsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostObserverWards')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <Tooltip content={t('stats.mostSentryWardsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostSentryWards')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">N/A</div>
                    <Tooltip content={t('stats.mostObserverKillsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostObserverKills')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <Tooltip content={t('stats.mostSentryKillsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostSentryKills')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <Tooltip content={t('stats.mostCampsStackedTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostCampsStacked')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Runes Collected</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <div className="text-sm font-medium">Highest APM</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-indigo-600">N/A</div>
                    <div className="text-sm font-medium">Longest Stun</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Special Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🏆 Special Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">
                      {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.longestKillStreak?.value || 0)) : 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Longest Kill Streak</div>
                    <div className="text-xs text-muted-foreground">
                      {playerStats.length > 0 ? 
                        findPlayerName(playerStats.find(ps => ps.longestKillStreak?.value === Math.max(...playerStats.map(p => p.longestKillStreak?.value || 0)))?.playerId || '') :
                        'No data'
                      }
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <div className="text-sm font-medium">Most Courier Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">Most Roshan Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <div className="text-sm font-medium">Most Versatile</div>
                    <div className="text-xs text-muted-foreground">Most unique heroes</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <div className="text-sm font-medium">Most Neutral Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Ancient Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Fastest Aghanim's</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <div className="text-sm font-medium">Total Rampages</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <div className="grid gap-6">
            {/* Team Achievement Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Trophy className="h-5 w-5" />
                    <Tooltip content={t('stats.dominanceKingTooltip')}>
                      <span className="flex items-center gap-1">
                        {t('stats.dominanceKing')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </span>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-xl">{t('stats.noData')}</p>
                    <p className="text-sm text-muted-foreground">{t('stats.dominanceKingTooltip')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-600">
                    <Sword className="h-5 w-5" />
                    <Tooltip content={t('stats.darkHorseTooltip')}>
                      <span className="flex items-center gap-1">
                        {t('stats.darkHorse')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </span>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-xl">{t('stats.noData')}</p>
                    <p className="text-sm text-muted-foreground">{t('stats.darkHorseTooltip')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-600">
                    <Target className="h-5 w-5" />
                    <Tooltip content={t('stats.bestDraftTooltip')}>
                      <span className="flex items-center gap-1">
                        {t('stats.bestDraft')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </span>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-xl">{t('stats.noData')}</p>
                    <p className="text-sm text-muted-foreground">{t('stats.bestDraftTooltip')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Combat Performance Records */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⚔️ {t('stats.teamCombat')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">
                      {teamStats.length > 0 ? Math.max(...teamStats.map(t => t.mostTeamKillsSingleMatch?.value || 0)) : 'N/A'}
                    </div>
                    <Tooltip content={t('stats.mostTeamKillsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.highestTeamKills')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">
                      {teamStats.length > 0 ? 
                        teams.find(t => t.id === teamStats.find(ts => ts.mostTeamKillsSingleMatch?.value === Math.max(...teamStats.map(t => t.mostTeamKillsSingleMatch?.value || 0)))?.teamId)?.name || 'Unknown' :
                        t('stats.noData')
                      }
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <Tooltip content={t('stats.fewestDeathsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.fewestDeaths')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <Tooltip content={t('stats.highestTeamKDATooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.highestTeamKDA')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <Tooltip content={t('stats.mostTeamAssistsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.mostTeamAssists')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{t('stats.noData')}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Hero Damage</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">Most Hero Healing</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <div className="text-sm font-medium">Most Tower Damage</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Most First Bloods</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Economy & Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Economy & Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">Highest Team GPM</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <div className="text-sm font-medium">Highest Team XPM</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <div className="text-sm font-medium">Biggest Net Worth Lead</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <div className="text-sm font-medium">Most Gold Earned</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Gold Spent</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">N/A</div>
                    <div className="text-sm font-medium">Most Last Hits</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <div className="text-sm font-medium">Most Total XP</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Most Buybacks</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vision & Map Control */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👁️ Vision & Map Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <div className="text-sm font-medium">Most Observer Wards</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <div className="text-sm font-medium">Most Sentry Wards</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">N/A</div>
                    <div className="text-sm font-medium">Most Wards Killed</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <div className="text-sm font-medium">Most Camps Stacked</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Runes Secured</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <div className="text-sm font-medium">Highest Team APM</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">Most Neutral Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Most Ancient Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Objectives & Structures */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🏰 Objectives & Structures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">
                      {teamStats.length > 0 ? 
                        `${Math.floor(Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)) / 60)}:${String(Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)) % 60).padStart(2, '0')}` :
                        'N/A'
                      }
                    </div>
                    <div className="text-sm font-medium">Fastest Victory</div>
                    <div className="text-xs text-muted-foreground">
                      {teamStats.length > 0 ? 
                        teams.find(t => t.id === teamStats.find(ts => ts.fastestVictory?.duration === Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)))?.teamId)?.name || 'Unknown' :
                        'No data'
                      }
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">N/A</div>
                    <div className="text-sm font-medium">Most Tower Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <div className="text-sm font-medium">Most Roshan Kills</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <div className="text-sm font-medium">Most Barracks</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">
                      {teamStats.length > 0 ? teamStats.filter(t => t.perfectStructureGame?.value).length : '0'}
                    </div>
                    <div className="text-sm font-medium">Perfect Games</div>
                    <div className="text-xs text-muted-foreground">
                      {teamStats.length > 0 ? 
                        teams.find(t => t.id === teamStats.find(ts => ts.perfectStructureGame?.value)?.teamId)?.name || 'No perfect games yet' :
                        'No data'
                      }
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Teamfights Won</div>
                    <div className="text-xs text-muted-foreground">No data</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Rankings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Current Team Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teams.length > 0 ? (
                    teams
                      .sort((a, b) => {
                        const aWinRate = a.wins && a.matchesPlayed ? (a.wins / a.matchesPlayed) : 0;
                        const bWinRate = b.wins && b.matchesPlayed ? (b.wins / b.matchesPlayed) : 0;
                        return bWinRate - aWinRate;
                      })
                      .slice(0, 10)
                      .map((team, index) => {
                        return (
                          <div key={team.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <Badge variant={index < 3 ? "default" : "secondary"}>
                                #{index + 1}
                              </Badge>
                              <div>
                                <p className="font-medium">{team.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {team.wins || 0}W - {team.losses || 0}L ({team.matchesPlayed || 0} played)
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">
                                {team.wins && team.matchesPlayed 
                                  ? ((team.wins / team.matchesPlayed) * 100).toFixed(1) 
                                  : '0.0'}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {team.averageFantasyPoints?.toFixed(1) || '0.0'} avg fantasy
                              </p>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No team data available yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="meta" className="space-y-6">
          <div className="grid gap-6">
            {/* Tournament Overview Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🏆 {t('stats.tournamentOverview')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">{teams.length}</div>
                    <Tooltip content={t('stats.totalTeamsTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.totalTeams')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">Zarejestrowane</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">{completedMatches.length}</div>
                    <Tooltip content={t('stats.matchesCompletedTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.matchesCompleted')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">Z {totalMatches}</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">
                      {tournamentStats?.totalGames || completedMatches.length}
                    </div>
                    <Tooltip content={t('stats.totalGamesTooltip')}>
                      <div className="text-sm font-medium flex items-center gap-1 cursor-help">
                        {t('stats.totalGames')}
                        <InfoIcon className="h-3 w-3 opacity-50" />
                      </div>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">Rozegrane</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">
                      {tournamentStats ? 
                        `${Math.floor(tournamentStats.averageMatchDuration / 60)}:${String(tournamentStats.averageMatchDuration % 60).padStart(2, '0')}` 
                        : 'N/A'
                      }
                    </div>
                    <div className="text-sm font-medium">Avg Match Duration</div>
                    <div className="text-xs text-muted-foreground">Minutes</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">N/A</div>
                    <div className="text-sm font-medium">Longest Match</div>
                    <div className="text-xs text-muted-foreground">Duration</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">Shortest Match</div>
                    <div className="text-xs text-muted-foreground">Duration</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">
                      {completedMatches.length > 0 ? 
                        ((completedMatches.filter(m => m.winnerId === m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) : 
                        '50.0'
                      }%
                    </div>
                    <div className="text-sm font-medium">Radiant Win Rate</div>
                    <div className="text-xs text-muted-foreground">
                      {completedMatches.filter(m => m.winnerId === m.teamA?.id).length}/{completedMatches.length}
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">
                      {completedMatches.length > 0 ? 
                        ((completedMatches.filter(m => m.winnerId !== m.teamA?.id).length / completedMatches.length) * 100).toFixed(1) : 
                        '50.0'
                      }%
                    </div>
                    <div className="text-sm font-medium">Dire Win Rate</div>
                    <div className="text-xs text-muted-foreground">
                      {completedMatches.filter(m => m.winnerId !== m.teamA?.id).length}/{completedMatches.length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Combat Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⚔️ Tournament Combat Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">
                      {tournamentStats?.totalKills?.toLocaleString() || 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Total Kills</div>
                    <div className="text-xs text-muted-foreground">All matches</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <div className="text-sm font-medium">Total Deaths</div>
                    <div className="text-xs text-muted-foreground">All matches</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <div className="text-sm font-medium">Total Assists</div>
                    <div className="text-xs text-muted-foreground">All matches</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <div className="text-sm font-medium">Total Rampages</div>
                    <div className="text-xs text-muted-foreground">5+ kill streaks</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Total Ultra Kills</div>
                    <div className="text-xs text-muted-foreground">4 kill streaks</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">First Bloods</div>
                    <div className="text-xs text-muted-foreground">Secured</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">
                      {tournamentStats?.totalKills && completedMatches.length > 0 ? 
                        (tournamentStats.totalKills / completedMatches.length).toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Kills Per Game</div>
                    <div className="text-xs text-muted-foreground">Average</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Bloodiest Game</div>
                    <div className="text-xs text-muted-foreground">Most kills</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Heroes & Meta */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🦸 Heroes & Meta Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">
                      {tournamentStats?.mostPickedHero?.heroName || 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Most Picked Hero</div>
                    <div className="text-xs text-muted-foreground">
                      {tournamentStats?.mostPickedHero?.pickCount || '0'} picks
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">
                      {tournamentStats?.mostBannedHero?.heroName || 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Most Banned Hero</div>
                    <div className="text-xs text-muted-foreground">
                      {tournamentStats?.mostBannedHero?.banCount || '0'} bans
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      {tournamentStats?.highestWinRateHero?.heroName || 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Highest Win Rate</div>
                    <div className="text-xs text-muted-foreground">
                      {tournamentStats?.highestWinRateHero ? 
                        `${(tournamentStats.highestWinRateHero.winRate * 100).toFixed(1)}%` : 'N/A'
                      } ({tournamentStats?.highestWinRateHero?.gamesPlayed || 0} games)
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <div className="text-sm font-medium">Unique Heroes Played</div>
                    <div className="text-xs text-muted-foreground">Total different</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Versatile Player</div>
                    <div className="text-xs text-muted-foreground">Most unique heroes</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">Most Popular Role</div>
                    <div className="text-xs text-muted-foreground">Lane preference</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <div className="text-sm font-medium">Meta Shift Count</div>
                    <div className="text-xs text-muted-foreground">Hero rotations</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Sleeper Pick</div>
                    <div className="text-xs text-muted-foreground">Unexpected success</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Economy & Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Economy & Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">
                      {tournamentStats?.totalGoldGenerated?.toLocaleString() || 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Total Gold Earned</div>
                    <div className="text-xs text-muted-foreground">All matches</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <div className="text-sm font-medium">Total Gold Spent</div>
                    <div className="text-xs text-muted-foreground">All purchases</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">N/A</div>
                    <div className="text-sm font-medium">Divine Rapiers</div>
                    <div className="text-xs text-muted-foreground">High-risk items</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <div className="text-sm font-medium">Aghanim's Scepters</div>
                    <div className="text-xs text-muted-foreground">Ultimate upgrades</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <div className="text-sm font-medium">Hand of Midas</div>
                    <div className="text-xs text-muted-foreground">Farming items</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Most Expensive Item</div>
                    <div className="text-xs text-muted-foreground">Highest cost built</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">
                      {tournamentStats?.totalGoldGenerated && completedMatches.length > 0 ? 
                        Math.round(tournamentStats.totalGoldGenerated / completedMatches.length).toLocaleString() : 'N/A'}
                    </div>
                    <div className="text-sm font-medium">Avg Gold Per Game</div>
                    <div className="text-xs text-muted-foreground">Economy pace</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Total Buybacks</div>
                    <div className="text-xs text-muted-foreground">Desperation plays</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Map Control & Objectives */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🗺️ Map Control & Objectives</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">N/A</div>
                    <div className="text-sm font-medium">Observer Wards</div>
                    <div className="text-xs text-muted-foreground">Total placed</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">N/A</div>
                    <div className="text-sm font-medium">Sentry Wards</div>
                    <div className="text-xs text-muted-foreground">Total placed</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-red-600">N/A</div>
                    <div className="text-sm font-medium">Roshan Kills</div>
                    <div className="text-xs text-muted-foreground">Total secured</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">N/A</div>
                    <div className="text-sm font-medium">Towers Destroyed</div>
                    <div className="text-xs text-muted-foreground">Total fallen</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">N/A</div>
                    <div className="text-sm font-medium">Ancient Creeps</div>
                    <div className="text-xs text-muted-foreground">Total killed</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">N/A</div>
                    <div className="text-sm font-medium">Runes Collected</div>
                    <div className="text-xs text-muted-foreground">Total secured</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-cyan-600">N/A</div>
                    <div className="text-sm font-medium">Vision Score</div>
                    <div className="text-xs text-muted-foreground">Tournament average</div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="text-lg font-bold text-pink-600">N/A</div>
                    <div className="text-sm font-medium">Map Control %</div>
                    <div className="text-xs text-muted-foreground">Territory average</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
