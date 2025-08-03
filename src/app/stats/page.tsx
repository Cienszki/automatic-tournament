"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Trophy, Target, Users, Zap, Crown, Award, TrendingUp, Activity } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";
import Image from 'next/image';
import Link from 'next/link';
import { getAllTeams, getAllMatches, getAllGroups, getAllTournamentPlayers } from '@/lib/firestore';
import type { Team, Match, Group, TournamentPlayer } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface TeamStats extends Team {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  points: number;
}

interface PlayerStats extends TournamentPlayer {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export default function StatsPage() {
  const { t } = useTranslation();
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const [teamsData, matchesData, groupsData, playersData] = await Promise.all([
          getAllTeams(),
          getAllMatches(),
          getAllGroups(),
          getAllTournamentPlayers()
        ]);

        setMatches(matchesData);
        setGroups(groupsData);

        // Calculate team stats
        const teamStats = teamsData.map(team => {
          const teamMatches = matchesData.filter(m => 
            (m.teamA?.id === team.id || m.teamB?.id === team.id) && m.status === 'completed'
          );
          
          const wins = teamMatches.filter(m => m.winnerId === team.id).length;
          const draws = teamMatches.filter(m => m.winnerId === null).length;
          const losses = teamMatches.length - wins - draws;
          const points = (wins * 3) + (draws * 1); // Standard tournament scoring
          
          return {
            ...team,
            matchesPlayed: teamMatches.length,
            wins,
            losses,
            draws,
            winRate: teamMatches.length > 0 ? (wins / teamMatches.length) * 100 : 0,
            points,
          };
        });

        // Calculate player stats
        const playerStats = playersData.map(player => {
          const playerMatches = matchesData.filter(m => 
            (m.teamA?.id === player.teamId || m.teamB?.id === player.teamId) && m.status === 'completed'
          );
          
          const wins = playerMatches.filter(m => m.winnerId === player.teamId).length;
          const losses = playerMatches.length - wins;

          return {
            ...player,
            matchesPlayed: playerMatches.length,
            wins,
            losses,
            winRate: playerMatches.length > 0 ? (wins / playerMatches.length) * 100 : 0,
          };
        });

        setTeams(teamStats.sort((a, b) => b.points - a.points || b.winRate - a.winRate));
        setPlayers(playerStats.sort((a, b) => b.winRate - a.winRate));
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const totalMatches = matches.filter(m => m.status === 'completed').length;
  const totalScheduledMatches = matches.length;
  const completionRate = totalScheduledMatches > 0 ? (totalMatches / totalScheduledMatches) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/stats.png)` }} 
          data-ai-hint="neon fantasy space"
        />
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('stats.overview')}
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('stats.teams')}
          </TabsTrigger>
          <TabsTrigger value="players" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t('stats.players')}
          </TabsTrigger>
          <TabsTrigger value="standings" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Standings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Matches</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMatches}</div>
                <p className="text-xs text-muted-foreground">of {totalScheduledMatches} scheduled</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tournament Progress</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
                <Progress value={completionRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teams.length}</div>
                <p className="text-xs text-muted-foreground">registered teams</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Top Teams by Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teams.slice(0, 5).map((team, index) => (
                    <div key={team.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          <Image 
                            src={team.logoUrl || `https://placehold.co/24x24.png?text=${team.name.charAt(0)}`} 
                            alt={team.name}
                            width={24}
                            height={24}
                            className="rounded-sm"
                            unoptimized={true}
                          />
                          <span className="font-medium">{team.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary">{team.points} pts</div>
                        <div className="text-xs text-muted-foreground">{team.wins}-{team.draws}-{team.losses}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Top Players by Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {players.slice(0, 5).map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{player.nickname}</div>
                          <div className="text-xs text-muted-foreground">{player.role} • {player.teamTag}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{player.winRate.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">{player.wins}-{player.losses}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Statistics
              </CardTitle>
              <CardDescription>Performance metrics for all teams in the tournament</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Matches</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team, index) => (
                      <TableRow key={team.id}>
                        <TableCell>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link href={`/teams/${team.id}`} className="flex items-center gap-3 hover:text-primary">
                            <Image 
                              src={team.logoUrl || `https://placehold.co/32x32.png?text=${team.name.charAt(0)}`} 
                              alt={team.name}
                              width={32}
                              height={32}
                              className="rounded-sm"
                              unoptimized={true}
                            />
                            <div>
                              <div className="font-medium">{team.name}</div>
                              <div className="text-xs text-muted-foreground">{team.tag}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>{team.matchesPlayed}</TableCell>
                        <TableCell>
                          <span className="font-bold text-primary">{team.points}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">{team.wins}</span>-
                          <span className="text-gray-600 font-medium">{team.draws}</span>-
                          <span className="text-red-600 font-medium">{team.losses}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={team.winRate} className="w-16 h-2" />
                            <span className="text-sm font-medium">{team.winRate.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Player Statistics
              </CardTitle>
              <CardDescription>Individual performance metrics for all tournament players</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Matches</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Win Rate</TableHead>
                      <TableHead>MMR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, index) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link href={`/teams/${player.teamId}/players/${player.id}`} className="font-medium hover:text-primary">
                            {player.nickname}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{player.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {player.teamTag}
                        </TableCell>
                        <TableCell>{player.matchesPlayed}</TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">{player.wins}</span>-
                          <span className="text-red-600 font-medium">{player.losses}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={player.winRate} className="w-12 h-2" />
                            <span className="text-sm">{player.winRate.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{player.mmr.toLocaleString()}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standings" className="space-y-6">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  {group.name}
                </CardTitle>
                <CardDescription>Current standings for {group.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pos</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Matches</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>W-D-L</TableHead>
                      <TableHead>Neustadtl</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(group.standings || {})
                      .sort((a: any, b: any) => b.points - a.points || b.neustadtlScore - a.neustadtlScore)
                      .map((standing: any, index: number) => (
                        <TableRow key={standing.teamId}>
                          <TableCell>
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/teams/${standing.teamId}`} className="font-medium hover:text-primary">
                              {standing.teamName}
                            </Link>
                          </TableCell>
                          <TableCell>{standing.matchesPlayed}</TableCell>
                          <TableCell>
                            <span className="font-bold text-primary">{standing.points}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600">{standing.wins}</span>-
                            <span className="text-gray-600">{standing.draws}</span>-
                            <span className="text-red-600">{standing.losses}</span>
                          </TableCell>
                          <TableCell>{standing.neustadtlScore.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
