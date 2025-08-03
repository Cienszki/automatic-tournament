
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getUserTeam } from "@/lib/team-actions";
import { getMatchesForTeam } from "@/lib/firestore";
import type { Team, Match } from "@/lib/definitions";
import NoTeamFound from '@/components/app/my-team/NoTeamFound';

export default function MyTeamPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
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
      <div className="flex justify-center items-center h-[calc(100vh-80px)] p-4">
        <Card className="w-full max-w-lg text-center shadow-lg border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c]">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-[#0ff0fc] drop-shadow-[0_0_8px_#0ff0fc]">Welcome, Future Captain!</CardTitle>
            <CardDescription className="text-lg text-[#b86fc6] pt-2">
              Ready to join the tournament? Register your team and lead them to glory.<br />
              <span className="block mt-2 text-[#e0d7f7]">Need a team or looking for players? Join our <a href="https://discord.gg/letniatournament" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0ff0fc]">Discord</a> and visit the #find-a-team channel!</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-[#e0d7f7]">Sign in to get started and create your team.</p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full py-3 px-6 rounded-lg font-bold text-lg bg-[#0ff0fc] text-[#181c2f] hover:bg-[#b86fc6] hover:text-[#fff] transition-all duration-300 shadow-lg drop-shadow-[0_0_8px_#0ff0fc]"
            >
              Sign in with Google
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!hasTeam) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-80px)] p-4">
        <Card className="w-full max-w-lg text-center shadow-lg border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c]">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-[#0ff0fc] drop-shadow-[0_0_8px_#0ff0fc]">Welcome, Future Captain!</CardTitle>
            <CardDescription className="text-lg text-[#b86fc6] pt-2">
              Ready to join the tournament? Register your team and lead them to glory.<br />
              <span className="block mt-2 text-[#e0d7f7]">Need a team or looking for players? Join our <a href="https://discord.gg/letniatournament" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0ff0fc]">Discord</a> and visit the #find-a-team channel!</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-[#e0d7f7]">Take the first step and register your team.</p>
            <button
              type="button"
              onClick={() => window.location.href = '/register'}
              className="w-full py-3 px-6 rounded-lg font-bold text-lg bg-[#b86fc6] text-[#fff] hover:bg-[#0ff0fc] hover:text-[#181c2f] transition-all duration-300 shadow-lg drop-shadow-[0_0_8px_#b86fc6]"
            >
              Register your team
            </button>
          </CardContent>
        </Card>
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
          <MatchHistoryTable matches={pastMatches} teamId={team.id} />
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
