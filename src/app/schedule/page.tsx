
import { MatchListItem } from "@/components/app/MatchListItem";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockMatches } from "@/lib/mock-data";
import type { Match } from "@/lib/definitions";
import { AlertCircle } from "lucide-react";

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

export default async function SchedulePage() {
  const upcomingMatches = await getUpcomingMatches();

  return (
    <div className="space-y-8">
      <Card className="shadow-xl bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold text-primary">Upcoming Matches</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Catch all the action! Here are the matches scheduled for the next 7 days.
            Add them to your calendar so you don&apos;t miss out.
          </CardDescription>
        </CardHeader>
      </Card>

      {upcomingMatches.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="p-10 flex flex-col items-center text-center">
            <AlertCircle className="w-16 h-16 text-primary mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Upcoming Matches</h2>
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
      <p className="text-sm text-muted-foreground text-center mt-8">
        Note: Match schedules are typically imported from a Google Sheet or other data source. This page displays simulated data.
      </p>
    </div>
  );
}

export const metadata = {
  title: "Schedule | Tournament Tracker",
  description: "View upcoming matches for the tournament."
}
