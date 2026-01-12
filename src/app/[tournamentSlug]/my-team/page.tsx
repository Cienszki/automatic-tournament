"use client";

import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

/**
 * My Team page - team registration and management
 */
export default function MyTeamPage() {
  const { tournament, theme } = useTournament();

  if (!tournament) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Moja drużyna</h1>
      </div>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>Rejestracja drużyny</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            {tournament.status === 'registration' 
              ? 'Formularz rejestracji drużyny.'
              : 'Rejestracja jest zamknięta.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
