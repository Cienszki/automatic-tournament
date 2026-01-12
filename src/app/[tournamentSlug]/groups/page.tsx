"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { LayoutGrid } from 'lucide-react';

/**
 * Groups page - shows group stage standings (MMR tournaments only)
 */
export default function GroupsPage() {
  const { tournament, theme } = useTournament();
  const { isMmrLimited } = useTournamentType();

  if (!tournament) return null;

  // This page is only for MMR-limited tournaments
  if (!isMmrLimited) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Strona niedostępna</h1>
        <p className="text-muted-foreground">
          Ten turniej nie posiada fazy grupowej.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutGrid className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Faza grupowa</h1>
      </div>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>Tabele grup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Tabele grup zostaną załadowane z bazy danych.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
