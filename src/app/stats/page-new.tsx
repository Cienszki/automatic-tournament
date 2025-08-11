'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Target, Sword, TrendingUp, Zap, Trophy } from 'lucide-react';

// Type definitions
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
  // Simple translation function
  const t = (key: string) => {
    const translations: { [key: string]: string } = {
      'stats.totalMatches': 'Total Matches',
      'stats.completed': 'completed',
      'stats.totalKills': 'Total Kills',
      'stats.avgPerMatch': 'avg per match',
      'stats.avgMatchDuration': 'Average Match Duration',
      'stats.minutes': 'minutes',
      'stats.totalFantasyPoints': 'Total Fantasy Points',
      'stats.playerRecords': 'Player Records',
      'stats.teamRecords': 'Team Records',
      'stats.metaStats': 'Meta Stats',
      'stats.topFantasyPerformers': 'Top Fantasy Performers',
      'stats.mostKills': 'Most Kills',
      'stats.highestGPM': 'Highest GPM',
      'stats.highestXPM': 'Highest XPM',
      'stats.mostLastHits': 'Most Last Hits',
      'stats.mostDenies': 'Most Denies',
      'stats.longestKillStreak': 'Longest Kill Streak',
      'stats.teamRankings': 'Team Rankings',
      'stats.avgMatch': 'avg match',
      'stats.fastestVictory': 'Fastest Victory',
      'stats.highestTeamKills': 'Highest Team Kills',
      'stats.perfectGames': 'Perfect Games',
      'stats.mostPickedHero': 'Most Picked Hero',
      'stats.picks': 'picks',
      'stats.mostBannedHero': 'Most Banned Hero',
      'stats.bans': 'bans',
      'stats.highestWinrateHero': 'Highest Winrate Hero',
      'stats.radiantWinRate': 'Radiant Win Rate',
      'stats.matches': 'matches'
    };
    return translations[key] || key;
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

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: 'url(/backgrounds/stats.png)' }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />
        <CardContent className="relative z-20 flex flex-col justify-center h-full">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Tournament Statistics
          </h1>
          <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto drop-shadow-lg">
            Comprehensive tournament statistics and performance data
          </p>
        </CardContent>
      </Card>

      {/* Tournament Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.totalMatches')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tournamentStats?.totalGames ?? totalMatches}</div>
            <p className="text-xs text-muted-foreground">
              {completedMatches.length} {t('stats.completed')}
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
            <CardTitle className="text-sm font-medium">{t('stats.totalFantasyPoints')}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tournamentStats?.totalGoldGenerated?.toLocaleString() ?? 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {tournamentStats && completedMatches.length > 0 ? (tournamentStats.totalGoldGenerated / completedMatches.length).toFixed(0) : 'N/A'} {t('stats.avgPerMatch')}
            </p>
          </CardContent>
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
            {/* Top Fantasy Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  {t('stats.topFantasyPerformers')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {playerStats.length > 0 ? (
                    playerStats.slice(0, 10).map((player, index) => {
                      // Find player data by looking through all team players
                      let playerData: Player | undefined;
                      let teamData: Team | undefined;
                      
                      for (const team of teams) {
                        const foundPlayer = team.players?.find(p => p.id === player.playerId);
                        if (foundPlayer) {
                          playerData = foundPlayer;
                          teamData = team;
                          break;
                        }
                      }
                      
                      return (
                        <div key={player.playerId} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Badge variant={index < 3 ? "default" : "secondary"}>
                              #{index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium">{playerData?.nickname || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{teamData?.name || 'No Team'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {playerData ? (teamData?.averageFantasyPoints || 0).toFixed(1) : '0.0'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {playerData ? (teamData?.averageFantasyPoints || 0).toFixed(1) : '0.0'} {t('stats.avgPerMatch')}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No player statistics available yet.</p>
                      <p className="text-sm text-muted-foreground mt-2">Player stats will appear here once matches are completed.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Player Records Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.mostKills')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostKillsSingleMatch?.value || 0)) : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {playerStats.length > 0 ? 
                        findPlayerName(playerStats.find(ps => ps.mostKillsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostKillsSingleMatch?.value || 0)))?.playerId || '') :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.highestGPM')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.highestGPMSingleMatch?.value || 0)) : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {playerStats.length > 0 ? 
                        findPlayerName(playerStats.find(ps => ps.highestGPMSingleMatch?.value === Math.max(...playerStats.map(p => p.highestGPMSingleMatch?.value || 0)))?.playerId || '') :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.highestXPM')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.highestXPMSingleMatch?.value || 0)) : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {playerStats.length > 0 ? 
                        findPlayerName(playerStats.find(ps => ps.highestXPMSingleMatch?.value === Math.max(...playerStats.map(p => p.highestXPMSingleMatch?.value || 0)))?.playerId || '') :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.mostLastHits')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostLastHitsSingleMatch?.value || 0)) : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {playerStats.length > 0 ? 
                        findPlayerName(playerStats.find(ps => ps.mostLastHitsSingleMatch?.value === Math.max(...playerStats.map(p => p.mostLastHitsSingleMatch?.value || 0)))?.playerId || '') :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.mostDenies')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.mostDeniesSingleMatch?.value || 0)) : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {playerStats.length > 0 ? 
                        findPlayerName(playerStats.find(ps => ps.mostDeniesSingleMatch?.value === Math.max(...playerStats.map(p => p.mostDeniesSingleMatch?.value || 0)))?.playerId || '') :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.longestKillStreak')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {playerStats.length > 0 ? Math.max(...playerStats.map(p => p.longestKillStreak?.value || 0)) : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {playerStats.length > 0 ? 
                        findPlayerName(playerStats.find(ps => ps.longestKillStreak?.value === Math.max(...playerStats.map(p => p.longestKillStreak?.value || 0)))?.playerId || '') :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <div className="grid gap-6">
            {/* Team Rankings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  {t('stats.teamRankings')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teams.length > 0 ? (
                    teams.slice(0, 8).map((team, index) => {
                      return (
                        <div key={team.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Badge variant={index < 3 ? "default" : "secondary"}>
                              #{index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium">{team.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {team.wins || 0}W - {team.losses || 0}L
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
                              {team.averageMatchDurationMinutes?.toFixed(0) || '0'}min {t('stats.avgMatch')}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No team data available yet.</p>
                      <p className="text-sm text-muted-foreground mt-2">Team rankings will appear here once teams are registered and matches are played.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Team Records Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.fastestVictory')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {teamStats.length > 0 ? 
                        `${Math.floor(Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)) / 60)}:${String(Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)) % 60).padStart(2, '0')}` :
                        'N/A'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {teamStats.length > 0 ? 
                        teams.find(t => t.id === teamStats.find(ts => ts.fastestVictory?.duration === Math.min(...teamStats.map(t => t.fastestVictory?.duration || Infinity)))?.teamId)?.name || 'Unknown' :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.highestTeamKills')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {teamStats.length > 0 ? Math.max(...teamStats.map(t => t.mostTeamKillsSingleMatch?.value || 0)) : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {teamStats.length > 0 ? 
                        teams.find(t => t.id === teamStats.find(ts => ts.mostTeamKillsSingleMatch?.value === Math.max(...teamStats.map(t => t.mostTeamKillsSingleMatch?.value || 0)))?.teamId)?.name || 'Unknown' :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.perfectGames')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {teamStats.length > 0 ? Math.max(...teamStats.map(t => t.perfectStructureGame ? 1 : 0)) : '0'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {teamStats.length > 0 ? 
                        teams.find(t => t.id === teamStats.find(ts => ts.perfectStructureGame?.value)?.teamId)?.name || 'No perfect games yet' :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="meta" className="space-y-6">
          <div className="grid gap-6">
            {/* Meta Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.mostPickedHero')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">{tournamentStats?.mostPickedHero?.heroName || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">
                      {tournamentStats?.mostPickedHero?.pickCount || '0'} {t('stats.picks')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.mostBannedHero')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">{tournamentStats?.mostBannedHero?.heroName || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">
                      {tournamentStats?.mostBannedHero?.banCount || '0'} {t('stats.bans')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.highestWinrateHero')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">{tournamentStats?.highestWinRateHero?.heroName || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">
                      {tournamentStats?.highestWinRateHero ? 
                        `${(tournamentStats.highestWinRateHero.winRate * 100).toFixed(1)}% (${tournamentStats.highestWinRateHero.gamesPlayed} games)` :
                        'No data available'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('stats.radiantWinRate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-bold text-2xl">
                      {completedMatches.length > 0 ? 
                        ((completedMatches.filter(m => m.winnerId === m.teamA.id).length / completedMatches.length) * 100).toFixed(1) : 
                        '50.0'
                      }%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {completedMatches.filter(m => m.winnerId === m.teamA.id).length}/{completedMatches.length} {t('stats.matches')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
