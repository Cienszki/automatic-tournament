// src/components/divisions/DivisionStatsDashboard.tsx
// Division-wide statistics dashboard

'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Clock, Target, Zap, Shield } from 'lucide-react';
import type { Match } from '@/lib/definitions';
import Image from 'next/image';

interface DivisionStatsDashboardProps {
  matches: Match[];
  divisionColor: string;
  theme: any;
}

interface HeroStat {
  heroId: string;
  heroName: string;
  picks: number;
  bans: number;
  wins: number;
  losses: number;
  winRate: number;
}

export function DivisionStatsDashboard({ matches, divisionColor, theme }: DivisionStatsDashboardProps) {
  const completedMatches = matches.filter(m => m.status === 'completed');

  // Calculate statistics
  const totalMatches = completedMatches.length;
  const totalGames = completedMatches.reduce((sum, m) => sum + (m.game_ids?.length || 0), 0);

  // Calculate average game duration (would need actual game data)
  const avgGameDuration = 35; // Placeholder

  // Calculate total kills/deaths from player performances
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let performanceCount = 0;

  completedMatches.forEach(match => {
    if (match.playerPerformances) {
      match.playerPerformances.forEach(perf => {
        totalKills += perf.kills;
        totalDeaths += perf.deaths;
        totalAssists += perf.assists;
        performanceCount++;
      });
    }
  });

  const avgKills = performanceCount > 0 ? (totalKills / performanceCount).toFixed(1) : '0';
  const avgDeaths = performanceCount > 0 ? (totalDeaths / performanceCount).toFixed(1) : '0';
  const avgAssists = performanceCount > 0 ? (totalAssists / performanceCount).toFixed(1) : '0';

  // Calculate match outcomes
  const decisiveWins = completedMatches.filter(m => 
    m.teamA.score === 2 || m.teamB.score === 2
  ).length;
  const draws = completedMatches.filter(m => 
    m.teamA.score === 1 && m.teamB.score === 1
  ).length;

  const decisiveWinRate = totalMatches > 0 ? ((decisiveWins / totalMatches) * 100).toFixed(1) : '0';
  const drawRate = totalMatches > 0 ? ((draws / totalMatches) * 100).toFixed(1) : '0';

  // Most common heroes (placeholder - would need actual hero data)
  const topHeroes = [
    { name: 'Będzie dostępne wkrótce', picks: 0, winRate: 0 }
  ];

  const StatCard = ({ title, value, subtitle, icon, color }: any) => (
    <Card style={{ backgroundColor: theme.cardColor, borderColor: `${color}40` }}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold" style={{ color }}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card style={{ backgroundColor: theme.cardColor, borderColor: divisionColor, borderWidth: '2px' }}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: divisionColor }} />
          <CardTitle className="text-2xl">Statystyki dywizji</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Zagregowane statystyki wszystkich meczów w dywizji
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Match Statistics */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" style={{ color: divisionColor }} />
            Statystyki meczów
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Rozegrane mecze"
              value={totalMatches}
              subtitle="Serie BO2"
              icon={<Target className="h-6 w-6" style={{ color: divisionColor }} />}
              color={divisionColor}
            />
            <StatCard
              title="Łączne gry"
              value={totalGames}
              subtitle="Pojedyncze gry"
              icon={<Zap className="h-6 w-6 text-yellow-500" />}
              color="#eab308"
            />
            <StatCard
              title="Rozstrzygnięcia"
              value={`${decisiveWinRate}%`}
              subtitle={`${decisiveWins} meczów 2-0`}
              icon={<TrendingUp className="h-6 w-6 text-green-500" />}
              color="#22c55e"
            />
            <StatCard
              title="Remisy"
              value={`${drawRate}%`}
              subtitle={`${draws} meczów 1-1`}
              icon={<Shield className="h-6 w-6 text-blue-500" />}
              color="#3b82f6"
            />
          </div>
        </div>

        {/* Player Performance Averages */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" style={{ color: divisionColor }} />
            Średnie statystyki graczy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card style={{ backgroundColor: theme.cardColor }}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Średnie zabójstwa</p>
                <p className="text-4xl font-bold text-green-500">{avgKills}</p>
                <p className="text-xs text-muted-foreground mt-2">na gracza / grę</p>
              </CardContent>
            </Card>
            <Card style={{ backgroundColor: theme.cardColor }}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Średnie zgony</p>
                <p className="text-4xl font-bold text-red-500">{avgDeaths}</p>
                <p className="text-xs text-muted-foreground mt-2">na gracza / grę</p>
              </CardContent>
            </Card>
            <Card style={{ backgroundColor: theme.cardColor }}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Średnie asysty</p>
                <p className="text-4xl font-bold text-blue-500">{avgAssists}</p>
                <p className="text-xs text-muted-foreground mt-2">na gracza / grę</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Game Duration */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" style={{ color: divisionColor }} />
            Czas trwania gier
          </h3>
          <Card style={{ backgroundColor: theme.cardColor }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Średni czas</p>
                  <p className="text-3xl font-bold" style={{ color: divisionColor }}>
                    {avgGameDuration} min
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Najkrótsza gra</p>
                  <p className="text-2xl font-bold text-green-500">-</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Najdłuższa gra</p>
                  <p className="text-2xl font-bold text-orange-500">-</p>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                Dane będą dostępne po zakończeniu większej liczby meczów
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Popular Heroes */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: divisionColor }} />
            Meta bohaterów
          </h3>
          <Card style={{ backgroundColor: theme.cardColor }}>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                Statystyki bohaterów będą dostępne wkrótce
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="pt-4 border-t" style={{ borderColor: `${divisionColor}20` }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: divisionColor }}>
                {(totalKills + totalDeaths + totalAssists)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Łączne akcje</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: divisionColor }}>
                {totalMatches * 10}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Gracze zaangażowani</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: divisionColor }}>
                {(totalGames * avgGameDuration).toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Minut rozgrywki</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: divisionColor }}>
                {performanceCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Występów graczy</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
