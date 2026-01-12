"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Crown } from 'lucide-react';

/**
 * Fantasy page - fantasy league interface
 */
export default function FantasyPage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();

  if (!tournament) return null;

  const fantasyEnabled = tournament.fantasy?.enabled;
  const fantasyType = tournament.fantasy?.type;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-8 w-8" style={{ color: theme.secondaryColor }} />
        <h1 className="text-3xl font-bold">Fantasy League</h1>
      </div>

      {fantasyEnabled ? (
        <>
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>
                {fantasyType === 'season-long' 
                  ? 'Twój skład sezonowy' 
                  : 'Skład na tę kolejkę'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Wybierz swój skład fantasy tutaj.
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Ranking Fantasy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Ranking fantasy zostanie załadowany z bazy danych.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Fantasy nie jest dostępne w tym turnieju.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
