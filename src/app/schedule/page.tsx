
"use client";

import { MatchListItem } from "@/components/app/MatchListItem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllMatches } from "@/lib/firestore";
import { useTranslation } from "@/hooks/useTranslation";
import type { Match } from "@/lib/definitions";
import { AlertCircle, Calendar, CalendarClock, History } from "lucide-react";
import { useEffect, useState } from "react";

export default function SchedulePage() {
  const { t } = useTranslation();
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [completedMatches, setCompletedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const allMatches = await getAllMatches();

        // Only show matches that have a confirmed custom time (dateTime).
        const upcoming = allMatches
          .filter(match => match.status !== 'completed' && match.dateTime)
          .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime());

        // Completed matches are sorted by their completion or scheduled date.
        const completed = allMatches
          .filter(match => match.status === 'completed')
          .sort((a, b) => {
              const dateA = a.completed_at ? new Date(a.completed_at) : new Date(a.dateTime || 0);
              const dateB = b.completed_at ? new Date(b.completed_at) : new Date(b.dateTime || 0);
              return dateB.getTime() - dateA.getTime();
          });

        setUpcomingMatches(upcoming);
        setCompletedMatches(completed);
      } catch (error) {
        console.error("Failed to load matches:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, []);

  if (loading) {
    return <div className="text-center py-10">{t('common.loading')}...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/schedule.png)` }} 
          data-ai-hint="neon fantasy space"
        />
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        
        <section className="space-y-4">
           <div className="text-center py-2">
            <h2 className="text-3xl font-semibold text-accent flex items-center justify-center">
                <CalendarClock className="h-8 w-8 mr-3" />
                {t('schedule.upcomingGames')}
            </h2>
          </div>
          {upcomingMatches.length === 0 ? (
            <Card className="shadow-none border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
              <CardContent className="p-10 flex flex-col items-center text-center">
                <AlertCircle className="w-16 h-16 text-primary mb-4" />
                <h3 className="text-2xl font-semibold mb-2">{t('schedule.noUpcomingMatches')}</h3>
                <p className="text-muted-foreground">
                  {t('schedule.noUpcomingMatchesDesc')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {upcomingMatches.map((match) => (
                <MatchListItem key={match.id} match={match} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="text-center py-2">
            <h2 className="text-3xl font-semibold text-accent flex items-center justify-center">
              <History className="h-8 w-8 mr-3" />
              {t('schedule.recentResults')}
            </h2>
          </div>
          {completedMatches.length === 0 ? (
            <Card className="shadow-none border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
              <CardContent className="p-10 flex flex-col items-center text-center">
                <AlertCircle className="w-16 h-16 text-primary mb-4" />
                <h3 className="text-2xl font-semibold mb-2">{t('schedule.noRecentMatches')}</h3>
                <p className="text-muted-foreground">
                  {t('schedule.noRecentMatchesDesc')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {completedMatches.map((match) => (
                <MatchListItem key={match.id} match={match} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
