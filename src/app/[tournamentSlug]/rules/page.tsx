"use client";

import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ScrollText } from 'lucide-react';

/**
 * Rules page - tournament rules and regulations
 */
export default function RulesPage() {
  const { tournament, theme } = useTournament();

  if (!tournament) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Regulamin</h1>
      </div>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>Regulamin {tournament.name}</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none">
          <p className="text-muted-foreground text-center py-8">
            Regulamin turnieju zostanie załadowany.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
