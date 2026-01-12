"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ClipboardCheck } from 'lucide-react';

/**
 * Pick'em page - predictions interface
 */
export default function PickemPage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();

  if (!tournament) return null;

  const pickemEnabled = tournament.pickem?.enabled;
  const standingsPredictions = tournament.pickem?.standingsPredictions;
  const matchPredictions = tournament.pickem?.matchPredictions;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-8 w-8" style={{ color: theme.accentColor }} />
        <h1 className="text-3xl font-bold">Pick'em</h1>
      </div>

      {pickemEnabled ? (
        <>
          {standingsPredictions && (
            <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
              <CardHeader>
                <CardTitle>
                  {isLeague 
                    ? 'Wytypuj końcowe tabele dywizji' 
                    : 'Wytypuj wyniki grup'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Wybierz swoje typy tutaj.
                </p>
              </CardContent>
            </Card>
          )}

          {matchPredictions && (
            <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
              <CardHeader>
                <CardTitle>Typuj mecze</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Wytypuj wyniki nadchodzących meczów.
                </p>
              </CardContent>
            </Card>
          )}

          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Ranking Pick'em</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Ranking pick'em zostanie załadowany z bazy danych.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Pick'em nie jest dostępne w tym turnieju.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
