
"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { MyTeamHeader } from "@/components/app/my-team/MyTeamHeader";
import { RosterCard } from "@/components/app/my-team/RosterCard";
import { TeamStatusCard } from "@/components/app/my-team/TeamStatusCard";
import { SchedulingCard } from "@/components/app/my-team/SchedulingCard";
import { MatchHistoryTable } from "@/components/app/my-team/MatchHistoryTable";
import { TeamStatsGrid } from "@/components/app/my-team/TeamStatsGrid";
import { PlayerAnalyticsTable } from "@/components/app/my-team/PlayerAnalyticsTable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getUserTeam } from "@/lib/firestore";
import { getMatchesForTeam, getAllTeams, getAllStandins } from "@/lib/firestore";
import type { Team, Match, Standin } from "@/lib/definitions";
import NoTeamFound from '@/components/app/my-team/NoTeamFound';

export default function MyTeamPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const [team, setTeam] = React.useState<Team | null>(null);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [standins, setStandins] = React.useState<Standin[]>([]);
  const [hasTeam, setHasTeam] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTeamData = async () => {
      // Only proceed if we have a user and we're on the client side
      if (user && typeof window !== 'undefined') {
        setLoading(true);
        try {
          // Small delay to ensure Firebase is fully initialized
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const { hasTeam, team } = await getUserTeam(user.uid);
          setHasTeam(hasTeam);
          setTeam(team || null);

          if (team) {
              const teamMatches = await getMatchesForTeam(team.id);
              setMatches(teamMatches);
          }
          
          // Fetch teams and standins for standin display
          const [allTeams, allStandins] = await Promise.all([
            getAllTeams(),
            getAllStandins()
          ]);
          setTeams(allTeams);
          setStandins(allStandins);
        } catch (error) {
          console.error('Error fetching team data:', error);
        } finally {
          setLoading(false);
        }
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
            <CardTitle className="text-3xl font-bold text-[#0ff0fc] drop-shadow-[0_0_8px_#0ff0fc]">{t("myTeam.welcomeCaptain")}</CardTitle>
            <CardDescription className="text-lg text-[#b86fc6] pt-2">
              {t("myTeam.welcomeDesc")}<br />
              <span className="block mt-2 text-[#e0d7f7]">{t("myTeam.needTeamOrPlayers")} <a href="https://discord.gg/ZxgmF7Kr4t" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0ff0fc]">{t("myTeam.discord")}</a> {t("myTeam.findTeamChannel")}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-[#e0d7f7]">{t("myTeam.signInToStart")}</p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full py-3 px-6 rounded-lg font-bold text-lg bg-[#0ff0fc] text-[#181c2f] hover:bg-[#b86fc6] hover:text-[#fff] transition-all duration-300 shadow-lg drop-shadow-[0_0_8px_#0ff0fc]"
            >
              {t("myTeam.signInWithGoogle")}
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
            <CardTitle className="text-3xl font-bold text-[#0ff0fc] drop-shadow-[0_0_8px_#0ff0fc]">{t("myTeam.welcomeCaptain")}</CardTitle>
            <CardDescription className="text-lg text-[#b86fc6] pt-2">
              {t("myTeam.readyToJoin")}<br />
              <span className="block mt-2 text-[#e0d7f7]">{t("myTeam.needTeamOrPlayers")} <a href="https://discord.gg/ZxgmF7Kr4t" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0ff0fc]">{t("myTeam.discord")}</a> {t("myTeam.findTeamChannel")}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-[#e0d7f7]">{t("myTeam.takeFirstStep")}</p>
            <button
              type="button"
              onClick={() => window.location.href = '/register'}
              className="w-full py-3 px-6 rounded-lg font-bold text-lg bg-[#b86fc6] text-[#fff] hover:bg-[#0ff0fc] hover:text-[#181c2f] transition-all duration-300 shadow-lg drop-shadow-[0_0_8px_#b86fc6]"
            >
              {t("myTeam.registerYourTeam")}
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
              <SchedulingCard 
                key={match.id} 
                match={match} 
                teamId={team.id} 
                captainId={user.uid}
                teams={teams}
                standins={standins}
              />
            ))
          ) : (
            <Card>
              <CardHeader><CardTitle>{t("myTeam.noUpcomingMatches")}</CardTitle></CardHeader>
              <CardContent><p>{t("myTeam.noMatchesScheduled")}</p></CardContent>
            </Card>
          )}
          <MatchHistoryTable 
            matches={pastMatches} 
            teamId={team.id}
            teams={teams}
            standins={standins}
          />
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
