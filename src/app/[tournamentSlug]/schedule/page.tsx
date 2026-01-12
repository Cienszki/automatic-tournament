"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

/**
 * Schedule page - shows upcoming and past matches
 */
export default function SchedulePage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();

  if (!tournament) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Terminarz</h1>
      </div>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>
            {isLeague ? 'Mecze ligowe' : 'Mecze grupowe i playoffs'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Terminarz meczów zostanie załadowany z bazy danych.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
