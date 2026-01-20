// src/components/divisions/DivisionRecords.tsx
// Player and team records for the division

'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Trophy, Award, Target, Zap, TrendingUp, Users, Calendar } from 'lucide-react';
import type { Match } from '@/lib/definitions';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface DivisionRecordsProps {
  matches: Match[];
  divisionColor: string;
  theme: any;
}

interface PlayerRecord {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  value: number;
  matchId?: string;
  round?: number;
}

interface TeamRecord {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  value: number;
  matchId?: string;
  round?: number;
  opponent?: string;
}

export function DivisionRecords({ matches, divisionColor, theme }: DivisionRecordsProps) {
  const completedMatches = matches.filter(m => m.status === 'completed');

  // Calculate player records
  const calculatePlayerRecords = () => {
    const records = {
      mostKills: [] as PlayerRecord[],
      mostDeaths: [] as PlayerRecord[],
      mostAssists: [] as PlayerRecord[],
      mostNetWorth: [] as PlayerRecord[],
      mostLastHits: [] as PlayerRecord[],
      mostHeroDamage: [] as PlayerRecord[],
      mostFantasyPoints: [] as PlayerRecord[],
    };

    completedMatches.forEach(match => {
      if (!match.playerPerformances) return;

      match.playerPerformances.forEach(perf => {
        // Most kills
        if (!records.mostKills[0] || perf.kills > records.mostKills[0].value) {
          records.mostKills = [{
            playerId: perf.playerId,
            playerName: perf.playerId, // Would need actual player name
            teamId: perf.teamId,
            teamName: match.teamA.id === perf.teamId ? match.teamA.name : match.teamB.name,
            teamLogo: match.teamA.id === perf.teamId ? match.teamA.logoUrl : match.teamB.logoUrl,
            value: perf.kills,
            matchId: match.id,
          }];
        }

        // Most deaths
        if (!records.mostDeaths[0] || perf.deaths > records.mostDeaths[0].value) {
          records.mostDeaths = [{
            playerId: perf.playerId,
            playerName: perf.playerId,
            teamId: perf.teamId,
            teamName: match.teamA.id === perf.teamId ? match.teamA.name : match.teamB.name,
            teamLogo: match.teamA.id === perf.teamId ? match.teamA.logoUrl : match.teamB.logoUrl,
            value: perf.deaths,
            matchId: match.id,
          }];
        }

        // Most assists
        if (!records.mostAssists[0] || perf.assists > records.mostAssists[0].value) {
          records.mostAssists = [{
            playerId: perf.playerId,
            playerName: perf.playerId,
            teamId: perf.teamId,
            teamName: match.teamA.id === perf.teamId ? match.teamA.name : match.teamB.name,
            teamLogo: match.teamA.id === perf.teamId ? match.teamA.logoUrl : match.teamB.logoUrl,
            value: perf.assists,
            matchId: match.id,
          }];
        }

        // Most fantasy points
        if (!records.mostFantasyPoints[0] || perf.fantasyPoints > records.mostFantasyPoints[0].value) {
          records.mostFantasyPoints = [{
            playerId: perf.playerId,
            playerName: perf.playerId,
            teamId: perf.teamId,
            teamName: match.teamA.id === perf.teamId ? match.teamA.name : match.teamB.name,
            teamLogo: match.teamA.id === perf.teamId ? match.teamA.logoUrl : match.teamB.logoUrl,
            value: perf.fantasyPoints,
            matchId: match.id,
          }];
        }
      });
    });

    return records;
  };

  // Calculate team records
  const calculateTeamRecords = () => {
    const records = {
      longestWinStreak: [] as TeamRecord[],
      mostPointsInRound: [] as TeamRecord[],
      highestTeamKills: [] as TeamRecord[],
    };

    // Placeholder calculations
    // Would need proper implementation with game data

    return records;
  };

  const playerRecords = calculatePlayerRecords();
  const teamRecords = calculateTeamRecords();

  const RecordCard = ({ icon, title, records, unit, color }: any) => (
    <Card style={{ backgroundColor: theme.cardColor, borderColor: `${color}40` }}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {records && records.length > 0 && records[0].value ? (
          <div className="space-y-3">
            {records.slice(0, 3).map((record: PlayerRecord | TeamRecord, index: number) => (
              <div key={index} className="flex items-center gap-3">
                <Badge 
                  className={cn(
                    "text-lg font-bold px-3 py-1",
                    index === 0 && "bg-yellow-500 text-white",
                    index === 1 && "bg-gray-400 text-white",
                    index === 2 && "bg-orange-600 text-white"
                  )}
                >
                  {index + 1}
                </Badge>
                <div className="flex items-center gap-2 flex-1">
                  {'teamLogo' in record && record.teamLogo && (
                    <Image
                      src={record.teamLogo}
                      alt={record.teamName || ''}
                      width={24}
                      height={24}
                      className="rounded-sm"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {'playerName' in record ? record.playerName : record.teamName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {'teamName' in record && 'playerName' in record ? record.teamName : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color }}>
                    {typeof record.value === 'number' ? record.value.toFixed(unit === 'FP' ? 1 : 0) : record.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{unit}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Brak danych
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Card style={{ backgroundColor: theme.cardColor, borderColor: divisionColor, borderWidth: '2px' }}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: divisionColor }} />
          <CardTitle className="text-2xl">Rekordy dywizji</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Najlepsze osiągnięcia graczy i drużyn w sezonie
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="player" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="player">
              <Award className="h-4 w-4 mr-2" />
              Rekordy graczy
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />
              Rekordy drużyn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="player" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RecordCard
                icon={<Target className="h-5 w-5 text-red-500" />}
                title="Najwięcej zabójstw"
                records={playerRecords.mostKills}
                unit="zabójstw"
                color="#ef4444"
              />
              <RecordCard
                icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
                title="Najwięcej asyst"
                records={playerRecords.mostAssists}
                unit="asyst"
                color="#3b82f6"
              />
              <RecordCard
                icon={<Zap className="h-5 w-5 text-purple-500" />}
                title="Najwięcej Fantasy Points"
                records={playerRecords.mostFantasyPoints}
                unit="FP"
                color="#a855f7"
              />
              <RecordCard
                icon={<Trophy className="h-5 w-5 text-gray-500" />}
                title="Najwięcej zgonów"
                records={playerRecords.mostDeaths}
                unit="zgonów"
                color="#6b7280"
              />
            </div>

            {/* Season-long records */}
            <div className="pt-6 border-t" style={{ borderColor: `${divisionColor}20` }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: divisionColor }} />
                Rekordy całego sezonu
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card style={{ backgroundColor: theme.cardColor }}>
                  <CardContent className="pt-6 text-center">
                    <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                    <p className="text-sm text-muted-foreground mb-1">Najlepszy gracz sezonu</p>
                    <p className="text-xl font-bold" style={{ color: divisionColor }}>-</p>
                    <p className="text-xs text-muted-foreground mt-2">Na podstawie Fantasy Points</p>
                  </CardContent>
                </Card>
                <Card style={{ backgroundColor: theme.cardColor }}>
                  <CardContent className="pt-6 text-center">
                    <Target className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <p className="text-sm text-muted-foreground mb-1">Łącznie zabójstw</p>
                    <p className="text-xl font-bold" style={{ color: divisionColor }}>-</p>
                    <p className="text-xs text-muted-foreground mt-2">Lider w zabójstwach</p>
                  </CardContent>
                </Card>
                <Card style={{ backgroundColor: theme.cardColor }}>
                  <CardContent className="pt-6 text-center">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm text-muted-foreground mb-1">Najwyższe KDA</p>
                    <p className="text-xl font-bold" style={{ color: divisionColor }}>-</p>
                    <p className="text-xs text-muted-foreground mt-2">Średnie przez sezon</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card style={{ backgroundColor: theme.cardColor }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Najdłuższa seria zwycięstw
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Będzie dostępne po większej liczbie meczów
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: theme.cardColor }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-red-500" />
                    Najwięcej zabójstw w meczu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Będzie dostępne po większej liczbie meczów
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: theme.cardColor }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-500" />
                    Najwyższe Fantasy Points w kolejce
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Będzie dostępne po większej liczbie meczów
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: theme.cardColor }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" style={{ color: divisionColor }} />
                    Najlepsza drużyna sezonu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Określona na koniec sezonu
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Season stats */}
            <div className="pt-6 border-t" style={{ borderColor: `${divisionColor}20` }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" style={{ color: divisionColor }} />
                Statystyki drużynowe
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card style={{ backgroundColor: theme.cardColor }}>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold" style={{ color: divisionColor }}>-</p>
                    <p className="text-xs text-muted-foreground mt-2">Najwyższy avg GPM</p>
                  </CardContent>
                </Card>
                <Card style={{ backgroundColor: theme.cardColor }}>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold" style={{ color: divisionColor }}>-</p>
                    <p className="text-xs text-muted-foreground mt-2">Najszybsze zwycięstwo</p>
                  </CardContent>
                </Card>
                <Card style={{ backgroundColor: theme.cardColor }}>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold" style={{ color: divisionColor }}>-</p>
                    <p className="text-xs text-muted-foreground mt-2">Najdłuższe zwycięstwo</p>
                  </CardContent>
                </Card>
                <Card style={{ backgroundColor: theme.cardColor }}>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold" style={{ color: divisionColor }}>-</p>
                    <p className="text-xs text-muted-foreground mt-2">Comeback victories</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
