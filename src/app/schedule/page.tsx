
import { MatchListItem } from "@/components/app/MatchListItem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockMatches } from "@/lib/mock-data";
import type { Match } from "@/lib/definitions";
import { AlertCircle, Calendar, CalendarClock, History } from "lucide-react"; // Imported History and CalendarClock

async function getUpcomingMatches(): Promise<Match[]> {
  // In a real app, fetch this data from your Google Sheet or API
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return mockMatches
    .filter(match => {
      const matchDate = new Date(match.dateTime);
      return matchDate >= now && matchDate <= sevenDaysLater && match.status === 'upcoming';
    })
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

async function getRecentMatches(): Promise<Match[]> {
  const now = new Date();
  return mockMatches
    .filter(match => {
      const matchDate = new Date(match.dateTime);
      return matchDate <= now && match.status === 'completed';
    })
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()); // Sort by most recent first
}


export default async function SchedulePage() {
  const upcomingMatches = await getUpcomingMatches();
  const recentMatches = await getRecentMatches();

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
            View upcoming games, past results, and add matches to your calendar.
          </p>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent Matches Column (Left) */}
        <section className="space-y-4">
          <div className="text-center py-2">
            <h2 className="text-3xl font-semibold text-accent flex items-center justify-center">
              <History className="h-8 w-8 mr-3" /> {/* Icon added */}
              Recent Results
            </h2>
          </div>
          {recentMatches.length === 0 ? (
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
              {recentMatches.map((match) => (
                <MatchListItem key={match.id} match={match} />
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Matches Column (Right) */}
        <section className="space-y-4">
           <div className="text-center py-2">
            <h2 className="text-3xl font-semibold text-accent flex items-center justify-center">
                <CalendarClock className="h-8 w-8 mr-3" /> {/* Icon added */}
                Upcoming Games
            </h2>
          </div>
          {upcomingMatches.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="p-10 flex flex-col items-center text-center">
                <AlertCircle className="w-16 h-16 text-primary mb-4" />
                <h3 className="text-2xl font-semibold mb-2">No Upcoming Matches</h3>
                <p className="text-muted-foreground">
                  There are no matches scheduled in the next 7 days.
                  Please check back later for updates.
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
      </div>
      <p className="text-sm text-muted-foreground text-center mt-8">
        Note: Match schedules are typically imported from a Google Sheet or other data source. This page displays simulated data.
      </p>
    </div>
  );
}

export const metadata = {
  title: "Schedule | Tournament Tracker",
  description: "View upcoming and recent matches for the tournament."
}

