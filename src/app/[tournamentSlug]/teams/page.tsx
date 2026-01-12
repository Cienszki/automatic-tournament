"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

/**
 * Teams page - lists all teams registered in the tournament
 */
export default function TeamsPage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();

  if (!tournament) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Drużyny</h1>
      </div>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>
            {isLeague ? 'Drużyny w lidze' : 'Zarejestrowane drużyny'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Lista drużyn zostanie załadowana z bazy danych.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
