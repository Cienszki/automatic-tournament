"use client";

import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';

/**
 * FAQ page - frequently asked questions
 */
export default function FaqPage() {
  const { tournament, theme } = useTournament();

  if (!tournament) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">FAQ</h1>
      </div>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>Często zadawane pytania</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            FAQ zostanie załadowane.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
