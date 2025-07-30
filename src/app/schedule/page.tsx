
import { MatchListItem } from "@/components/app/MatchListItem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllMatches } from "@/lib/firestore";
import type { Match } from "@/lib/definitions";
import { AlertCircle, Calendar, CalendarClock, History } from "lucide-react";
import { unstable_noStore as noStore } from 'next/cache';

async function getMatches(): Promise<{ upcomingMatches: Match[], completedMatches: Match[] }> {
  noStore();
  const allMatches = await getAllMatches();

  // Only show matches that have a confirmed custom time (dateTime).
  const upcomingMatches = allMatches
    .filter(match => match.status !== 'completed' && match.dateTime)
    .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime());

  // Completed matches are sorted by their completion or scheduled date.
  const completedMatches = allMatches
    .filter(match => match.status === 'completed')
    .sort((a, b) => {
        const dateA = a.completed_at ? new Date(a.completed_at) : new Date(a.dateTime || 0);
        const dateB = b.completed_at ? new Date(b.completed_at) : new Date(b.dateTime || 0);
        return dateB.getTime() - dateA.getTime();
    });

  return { upcomingMatches, completedMatches };
}

export default async function SchedulePage() {
  const { upcomingMatches, completedMatches } = await getMatches();

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/schedule.png)` }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="relative z-10">
          <Calendar className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Match Schedule
          </h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
            View upcoming games and past results.
          </p>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        
        <section className="space-y-4">
           <div className="text-center py-2">
            <h2 className="text-3xl font-semibold text-accent flex items-center justify-center">
                <CalendarClock className="h-8 w-8 mr-3" />
                Upcoming Games
            </h2>
          </div>
          {upcomingMatches.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="p-10 flex flex-col items-center text-center">
                <AlertCircle className="w-16 h-16 text-primary mb-4" />
                <h3 className="text-2xl font-semibold mb-2">No Upcoming Matches</h3>
                <p className="text-muted-foreground">
                  There are no confirmed matches scheduled.
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
              Recent Results
            </h2>
          </div>
          {completedMatches.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="p-10 flex flex-col items-center text-center">
                <AlertCircle className="w-16 h-16 text-primary mb-4" />
                <h3 className="text-2xl font-semibold mb-2">No Recent Matches</h3>
                <p className="text-muted-foreground">
                  There are no recently completed matches to display.
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

export const metadata = {
  title: "Schedule | Tournament Tracker",
  description: "View upcoming and recent matches for the tournament."
}
