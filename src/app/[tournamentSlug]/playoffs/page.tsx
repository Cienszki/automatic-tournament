"use client";

import React, { useEffect, useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardContent } from '@/components/ui/card';
import PlayoffBracketDisplay from '@/components/app/PlayoffBracketDisplay';
import { getPlayoffDataWithResults } from '@/lib/playoff-management';
import { GitFork } from 'lucide-react';
import type { PlayoffData } from '@/lib/definitions';

/**
 * Playoffs page - shows playoff bracket
 */
export default function PlayoffsPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const [bracketData, setBracketData] = useState<PlayoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlayoffData = async () => {
      try {
        setLoading(true);
        if (isLegacyTournament) {
          const data = await getPlayoffDataWithResults();
          setBracketData(data);
        } else {
          // New tournament structure - would load from /tournaments/{id}/playoffs
          setBracketData(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load playoffs');
      } finally {
        setLoading(false);
      }
    };

    loadPlayoffData();
  }, [isLegacyTournament]);

  if (!tournament) return null;

  const playoffsEnabled = tournament.playoffs?.enabled;
  const format = tournament.playoffs?.format;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <GitFork className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Playoffs</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-muted-foreground mt-4">Ładowanie drabinki...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <GitFork className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Playoffs</h1>
        </div>
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="p-10 text-center">
            <h3 className="text-lg font-semibold text-red-500 mb-2">Błąd ładowania</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Spróbuj ponownie
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitFork className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Playoffs</h1>
        {format && (
          <span className="text-sm text-muted-foreground">
            ({format === 'double-elimination' ? 'Double Elimination' : 'Single Elimination'})
          </span>
        )}
      </div>

      {/* Bracket */}
      {playoffsEnabled && bracketData ? (
        <PlayoffBracketDisplay bracketData={bracketData} />
      ) : (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-16 text-center">
            <GitFork className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Playoffs jeszcze się nie rozpoczęły</h3>
            <p className="text-muted-foreground">
              Drabinka playoffs zostanie opublikowana po zakończeniu fazy grupowej.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
