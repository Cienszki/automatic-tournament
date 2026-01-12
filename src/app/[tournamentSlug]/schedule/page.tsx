"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardContent } from '@/components/ui/card';
import { MatchListItem } from "@/components/app/MatchListItem";
import { getAllMatches } from "@/lib/firestore";
import type { Match } from "@/lib/definitions";
import { CalendarDays, CalendarClock, History, AlertCircle } from 'lucide-react';
import { useEffect, useState } from "react";

/**
 * Schedule page - shows upcoming and past matches
 */
export default function SchedulePage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { isLeague } = useTournamentType();
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [completedMatches, setCompletedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatches = async () => {
      try {
        if (isLegacyTournament) {
          const allMatches = await getAllMatches();

          const upcoming = allMatches
            .filter(match => match.status !== 'completed' && match.dateTime)
            .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime());

          const completed = allMatches
            .filter(match => match.status === 'completed')
            .sort((a, b) => {
                const dateA = a.completed_at ? new Date(a.completed_at) : new Date(a.dateTime || 0);
                const dateB = b.completed_at ? new Date(b.completed_at) : new Date(b.dateTime || 0);
                return dateB.getTime() - dateA.getTime();
            });

          setUpcomingMatches(upcoming);
          setCompletedMatches(completed);
        } else {
          // New tournament structure - would load from /tournaments/{id}/matches
          setUpcomingMatches([]);
          setCompletedMatches([]);
        }
      } catch (error) {
        console.error("Failed to load matches:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, [isLegacyTournament]);

  if (!tournament) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Terminarz</h1>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-muted-foreground">Ładowanie meczów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarDays className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Terminarz</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upcoming Matches */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: theme.accentColor }}>
            <CalendarClock className="h-6 w-6" />
            Nadchodzące mecze
          </h2>
          {upcomingMatches.length === 0 ? (
            <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
              <CardContent className="p-10 flex flex-col items-center text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Brak zaplanowanych meczów</h3>
                <p className="text-muted-foreground text-sm">
                  Sprawdź ponownie później.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingMatches.map((match) => (
                <MatchListItem key={match.id} match={match} />
              ))}
            </div>
          )}
        </section>

        {/* Completed Matches */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: theme.accentColor }}>
            <History className="h-6 w-6" />
            Ostatnie wyniki
          </h2>
          {completedMatches.length === 0 ? (
            <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
              <CardContent className="p-10 flex flex-col items-center text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Brak zakończonych meczów</h3>
                <p className="text-muted-foreground text-sm">
                  Wyniki pojawią się tutaj po rozegraniu meczów.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedMatches.slice(0, 10).map((match) => (
                <MatchListItem key={match.id} match={match} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
