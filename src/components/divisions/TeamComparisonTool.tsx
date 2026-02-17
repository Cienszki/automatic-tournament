// src/components/divisions/TeamComparisonTool.tsx
// Side-by-side team comparison tool

'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { TrendingUp, TrendingDown, Minus, Users, Trophy, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Match } from '@/lib/definitions';

interface TeamStanding {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
  position: number;
  form?: ('W' | 'D' | 'L')[];
}

interface TeamComparisonToolProps {
  standings: TeamStanding[];
  matches: Match[];
  divisionColor: string;
  theme: any;
}

interface TeamStats {
  winRate: number;
  avgGameDuration: number;
  totalKills: number;
  totalDeaths: number;
  avgKDA: number;
  fantasyPointsTotal: number;
  avgFantasyPoints: number;
}

export function TeamComparisonTool({ standings, matches, divisionColor, theme }: TeamComparisonToolProps) {
  const [teamA, setTeamA] = useState<string>('');
  const [teamB, setTeamB] = useState<string>('');

  const teamAData = standings.find(t => t.teamId === teamA);
  const teamBData = standings.find(t => t.teamId === teamB);

  // Calculate head-to-head record
  const getHeadToHead = () => {
    if (!teamA || !teamB) return null;

    const h2hMatches = matches.filter(m =>
      m.status === 'completed' &&
      ((m.teamA.id === teamA && m.teamB.id === teamB) ||
       (m.teamA.id === teamB && m.teamB.id === teamA))
    );

    let teamAWins = 0;
    let teamBWins = 0;
    let draws = 0;

    h2hMatches.forEach(match => {
      const isTeamAHome = match.teamA.id === teamA;
      const teamAScore = isTeamAHome ? match.teamA.score : match.teamB.score;
      const teamBScore = isTeamAHome ? match.teamB.score : match.teamA.score;

      if (teamAScore > teamBScore) teamAWins++;
      else if (teamBScore > teamAScore) teamBWins++;
      else draws++;
    });

    return { teamAWins, teamBWins, draws, totalMatches: h2hMatches.length };
  };

  // Calculate team statistics from matches
  const getTeamStats = (teamId: string): TeamStats => {
    const teamMatches = matches.filter(m =>
      m.status === 'completed' &&
      (m.teamA.id === teamId || m.teamB.id === teamId)
    );

    const wins = teamMatches.filter(m =>
      (m.teamA.id === teamId && m.teamA.score > m.teamB.score) ||
      (m.teamB.id === teamId && m.teamB.score > m.teamA.score)
    ).length;

    const winRate = teamMatches.length > 0 ? (wins / teamMatches.length) * 100 : 0;

    // Aggregate player performances
    let totalKills = 0;
    let totalDeaths = 0;
    let totalFantasyPoints = 0;
    let performanceCount = 0;

    teamMatches.forEach(match => {
      if (match.playerPerformances) {
        const teamPerformances = match.playerPerformances.filter(p => p.teamId === teamId);
        teamPerformances.forEach(p => {
          totalKills += p.kills;
          totalDeaths += p.deaths;
          totalFantasyPoints += p.fantasyPoints;
          performanceCount++;
        });
      }
    });

    const avgKDA = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;

    return {
      winRate,
      avgGameDuration: 0, // Would need game duration data
      totalKills,
      totalDeaths,
      avgKDA,
      fantasyPointsTotal: totalFantasyPoints,
      avgFantasyPoints: performanceCount > 0 ? totalFantasyPoints / performanceCount : 0
    };
  };

  const h2h = getHeadToHead();
  const statsA = teamA ? getTeamStats(teamA) : null;
  const statsB = teamB ? getTeamStats(teamB) : null;

  const ComparisonRow = ({ label, valueA, valueB, higherIsBetter = true, format = (v: any) => v, icon }: any) => {
    const aVal = typeof valueA === 'number' ? valueA : 0;
    const bVal = typeof valueB === 'number' ? valueB : 0;
    const aIsBetter = higherIsBetter ? aVal > bVal : aVal < bVal;
    const bIsBetter = higherIsBetter ? bVal > aVal : bVal < aVal;

    return (
      <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center py-3 border-b border-border/50 last:border-0">
        <div className={cn(
          "text-right font-semibold",
          aIsBetter && "text-green-500",
          bIsBetter && "opacity-60"
        )}>
          {format(valueA)}
        </div>
        <div className="flex flex-col items-center gap-1 min-w-[120px]">
          {icon}
          <span className="text-xs text-muted-foreground text-center">{label}</span>
        </div>
        <div className={cn(
          "text-left font-semibold",
          bIsBetter && "text-green-500",
          aIsBetter && "opacity-60"
        )}>
          {format(valueB)}
        </div>
      </div>
    );
  };

  return (
    <Card style={{ backgroundColor: theme.cardColor, borderColor: divisionColor, borderWidth: '2px' }}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: divisionColor }} />
          <CardTitle className="text-2xl">Porównanie drużyn</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Wybierz dwie drużyny aby porównać ich statystyki i historię bezpośrednich starć
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Drużyna A</label>
            <Select value={teamA} onValueChange={setTeamA}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz drużynę..." />
              </SelectTrigger>
              <SelectContent>
                {standings
                  .filter(t => t.teamId !== teamB)
                  .map(team => (
                    <SelectItem key={team.teamId} value={team.teamId}>
                      <div className="flex items-center gap-2">
                        {team.teamLogoUrl && (
                          <Image src={team.teamLogoUrl} alt={team.teamName} width={20} height={20} className="rounded-sm" unoptimized />
                        )}
                        {team.teamName}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Drużyna B</label>
            <Select value={teamB} onValueChange={setTeamB}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz drużynę..." />
              </SelectTrigger>
              <SelectContent>
                {standings
                  .filter(t => t.teamId !== teamA)
                  .map(team => (
                    <SelectItem key={team.teamId} value={team.teamId}>
                      <div className="flex items-center gap-2">
                        {team.teamLogoUrl && (
                          <Image src={team.teamLogoUrl} alt={team.teamName} width={20} height={20} className="rounded-sm" unoptimized />
                        )}
                        {team.teamName}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {teamAData && teamBData ? (
          <>
            {/* Team Headers */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-2" style={{ borderColor: divisionColor }}>
                <CardContent className="pt-6 text-center">
                  {teamAData.teamLogoUrl && (
                    <Image
                      src={teamAData.teamLogoUrl}
                      alt={teamAData.teamName}
                      width={64}
                      height={64}
                      className="mx-auto mb-3 rounded-sm"
                      unoptimized
                    />
                  )}
                  <p className="font-bold text-lg">{teamAData.teamName}</p>
                  <Badge className="mt-2" style={{ backgroundColor: `${divisionColor}20`, color: divisionColor, borderColor: divisionColor }}>
                    #{teamAData.position} w dywizji
                  </Badge>
                </CardContent>
              </Card>

              <Card className="border-2" style={{ borderColor: divisionColor }}>
                <CardContent className="pt-6 text-center">
                  {teamBData.teamLogoUrl && (
                    <Image
                      src={teamBData.teamLogoUrl}
                      alt={teamBData.teamName}
                      width={64}
                      height={64}
                      className="mx-auto mb-3 rounded-sm"
                      unoptimized
                    />
                  )}
                  <p className="font-bold text-lg">{teamBData.teamName}</p>
                  <Badge className="mt-2" style={{ backgroundColor: `${divisionColor}20`, color: divisionColor, borderColor: divisionColor }}>
                    #{teamBData.position} w dywizji
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Head-to-Head Record */}
            {h2h && h2h.totalMatches > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5" style={{ color: divisionColor }} />
                    Bezpośrednie starcia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="text-3xl font-bold text-green-500">{h2h.teamAWins}</div>
                      <div className="text-sm text-muted-foreground mt-1">Wygrane</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-3xl font-bold text-yellow-500">{h2h.draws}</div>
                      <div className="text-sm text-muted-foreground mt-1">Remisy</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-3xl font-bold text-green-500">{h2h.teamBWins}</div>
                      <div className="text-sm text-muted-foreground mt-1">Wygrane</div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Łącznie meczów: {h2h.totalMatches}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Statistics Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" style={{ color: divisionColor }} />
                  Statystyki w sezonie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ComparisonRow
                  label="Punkty"
                  valueA={teamAData.points}
                  valueB={teamBData.points}
                  icon={<Trophy className="h-4 w-4" style={{ color: divisionColor }} />}
                />
                <ComparisonRow
                  label="Mecze rozegrane"
                  valueA={teamAData.matchesPlayed}
                  valueB={teamBData.matchesPlayed}
                  higherIsBetter={false}
                  icon={<Users className="h-4 w-4" style={{ color: divisionColor }} />}
                />
                <ComparisonRow
                  label="Wygrane"
                  valueA={teamAData.wins}
                  valueB={teamBData.wins}
                  icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                />
                <ComparisonRow
                  label="Remisy"
                  valueA={teamAData.draws}
                  valueB={teamBData.draws}
                  icon={<Minus className="h-4 w-4 text-yellow-500" />}
                />
                <ComparisonRow
                  label="Przegrane"
                  valueA={teamAData.losses}
                  valueB={teamBData.losses}
                  higherIsBetter={false}
                  icon={<TrendingDown className="h-4 w-4 text-red-500" />}
                />
                <ComparisonRow
                  label="Bilans gier"
                  valueA={`${teamAData.gamesWon}-${teamAData.gamesLost}`}
                  valueB={`${teamBData.gamesWon}-${teamBData.gamesLost}`}
                  format={(v: string) => v}
                  icon={<Target className="h-4 w-4" style={{ color: divisionColor }} />}
                />
                {statsA && statsB && (
                  <>
                    <ComparisonRow
                      label="Win Rate"
                      valueA={statsA.winRate}
                      valueB={statsB.winRate}
                      format={(v: number) => `${v.toFixed(1)}%`}
                      icon={<Zap className="h-4 w-4 text-yellow-500" />}
                    />
                    <ComparisonRow
                      label="Łączne zabójstwa"
                      valueA={statsA.totalKills}
                      valueB={statsB.totalKills}
                      icon={<Target className="h-4 w-4 text-red-500" />}
                    />
                    <ComparisonRow
                      label="Śr. KDA"
                      valueA={statsA.avgKDA}
                      valueB={statsB.avgKDA}
                      format={(v: number) => v.toFixed(2)}
                      icon={<Trophy className="h-4 w-4" style={{ color: divisionColor }} />}
                    />
                    <ComparisonRow
                      label="Śr. Fantasy Points"
                      valueA={statsA.avgFantasyPoints}
                      valueB={statsB.avgFantasyPoints}
                      format={(v: number) => v.toFixed(1)}
                      icon={<Zap className="h-4 w-4 text-purple-500" />}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Form Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Forma (ostatnie 5 meczów)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-end gap-1">
                    {teamAData.form?.slice(-5).map((result, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          result === 'W' && "bg-green-500",
                          result === 'D' && "bg-yellow-500",
                          result === 'L' && "bg-red-500"
                        )}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {teamBData.form?.slice(-5).map((result, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          result === 'W' && "bg-green-500",
                          result === 'D' && "bg-yellow-500",
                          result === 'L' && "bg-red-500"
                        )}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Wybierz dwie drużyny aby zobaczyć szczegółowe porównanie
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
