"use client";

import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react';

/**
 * Stats page - player and team statistics
 */
export default function StatsPage() {
  const { tournament, theme } = useTournament();

  if (!tournament) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Statystyki</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle>Statystyki graczy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Statystyki graczy zostaną załadowane z bazy danych.
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle>Statystyki drużyn</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Statystyki drużyn zostaną załadowane z bazy danych.
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle>Statystyki bohaterów</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Statystyki bohaterów zostaną załadowane z bazy danych.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
