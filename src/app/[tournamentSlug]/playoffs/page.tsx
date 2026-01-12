"use client";

import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { GitFork } from 'lucide-react';

/**
 * Playoffs page - shows playoff bracket
 */
export default function PlayoffsPage() {
  const { tournament, theme } = useTournament();

  if (!tournament) return null;

  const playoffsEnabled = tournament.playoffs?.enabled;
  const format = tournament.playoffs?.format;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitFork className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Playoffs</h1>
      </div>

      {playoffsEnabled ? (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle>
              {format === 'double-elimination' 
                ? 'Drabinka Double Elimination' 
                : 'Drabinka pucharowa'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Drabinka playoffs zostanie załadowana z bazy danych.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Playoffs nie zostały jeszcze skonfigurowane.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
