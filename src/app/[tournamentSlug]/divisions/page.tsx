"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';

/**
 * Divisions page - shows division standings (League tournaments only)
 */
export default function DivisionsPage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();

  if (!tournament) return null;

  // This page is only for league tournaments
  if (!isLeague) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Strona niedostępna</h1>
        <p className="text-muted-foreground">
          Ten turniej nie posiada systemu dywizji.
        </p>
      </div>
    );
  }

  const divisions = tournament.divisions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Dywizje</h1>
      </div>

      {divisions.length > 0 ? (
        <div className="grid gap-6">
          {divisions.map((division) => (
            <Card 
              key={division.id} 
              style={{ 
                backgroundColor: theme.cardColor, 
                borderColor: division.color || theme.borderColor 
              }}
            >
              <CardHeader>
                <CardTitle style={{ color: division.color || theme.primaryColor }}>
                  {division.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Tabela dywizji zostanie załadowana z bazy danych.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Dywizje zostaną ogłoszone wkrótce.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
