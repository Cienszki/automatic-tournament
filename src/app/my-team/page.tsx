
"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { MyTeamHeader } from "@/components/app/my-team/MyTeamHeader";
import { RosterCard } from "@/components/app/my-team/RosterCard";
import { TeamStatusCard } from "@/components/app/my-team/TeamStatusCard";
import { SchedulingCard } from "@/components/app/my-team/SchedulingCard";
import { MatchHistoryTable } from "@/components/app/my-team/MatchHistoryTable";
import { TeamStatsGrid } from "@/components/app/my-team/TeamStatsGrid";
import { PlayerAnalyticsTable } from "@/components/app/my-team/PlayerAnalyticsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getUserTeam } from "@/lib/team-actions";
import { getMatchesForTeam } from "@/lib/firestore";
import type { Team, Match } from "@/lib/definitions";
import NoTeamFound from '@/components/app/my-team/NoTeamFound';

export default function MyTeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [team, setTeam] = React.useState<Team | null>(null);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [hasTeam, setHasTeam] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTeamData = async () => {
      if (user) {
        setLoading(true);
        const { hasTeam, team } = await getUserTeam(user.uid);
        setHasTeam(hasTeam);
        setTeam(team || null);

        if (team) {
            const teamMatches = await getMatchesForTeam(team.id);
            setMatches(teamMatches);
        }
        
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    if (!authLoading) {
      fetchTeamData();
    }
  }, [user, authLoading]);
  
  if (authLoading || loading) {
    return <div className="flex justify-center items-center h-[calc(100vh-80px)]"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }
  
  if (!user) {
    return (
        <div className="flex justify-center items-center h-[calc(100vh-80px)]">
            <Card className="text-center">
                <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                <CardContent>
                <p>You must be signed in to view your team page.</p>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  if (!hasTeam) {
    return (
        <div className="flex justify-center items-center h-[calc(100vh-80px)]">
            <NoTeamFound />
        </div>
    );
  }

  if (!team) {
     return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }

  const upcomingMatches = matches.filter(m => m.status !== 'completed');
  const pastMatches = matches.filter(m => m.status === 'completed');

  return (
    <div className="space-y-8">
      <MyTeamHeader team={team} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {upcomingMatches.length > 0 ? (
            upcomingMatches.map(match => (
              <SchedulingCard key={match.id} match={match} teamId={team.id} captainId={user.uid} />
            ))
          ) : (
            <Card>
              <CardHeader><CardTitle>No Upcoming Matches</CardTitle></CardHeader>
              <CardContent><p>Your team has no matches scheduled.</p></CardContent>
            </Card>
          )}
          <MatchHistoryTable matches={pastMatches} />
        </div>
        <div className="space-y-8">
          <RosterCard team={team} />
          <TeamStatusCard team={team} />
        </div>
      </div>
      <TeamStatsGrid team={team} />
      <PlayerAnalyticsTable team={team} />
    </div>
  );
}
