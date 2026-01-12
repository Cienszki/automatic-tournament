"use client";

import * as React from "react";
import { useTournament } from '@/context/TournamentContext';
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
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import { getUserTeam, getMatchesForTeam, getAllTeams, getAllStandins } from "@/lib/firestore";
import type { Team, Match, Standin } from "@/lib/definitions";
import NoTeamFound from '@/components/app/my-team/NoTeamFound';

/**
 * My Team page - team registration and management
 */
export default function MyTeamPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
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
      if (!isLegacyTournament) {
        setLoading(false);
        return;
      }

      if (user && typeof window !== 'undefined') {
        setLoading(true);
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const { hasTeam, team } = await getUserTeam(user.uid);
          setHasTeam(hasTeam);
          setTeam(team || null);

          if (team) {
            const teamMatches = await getMatchesForTeam(team.id);
            setMatches(teamMatches);
          }
          
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
  }, [user, authLoading, isLegacyTournament]);

  if (!tournament) return null;

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Moja drużyna</h1>
        </div>
        <div className="flex justify-center items-center h-[calc(100vh-200px)]">
          <Loader2 className="h-16 w-16 animate-spin" style={{ color: theme.primaryColor }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Moja drużyna</h1>
        </div>
        <div className="flex justify-center items-center p-4">
          <Card className="w-full max-w-lg text-center shadow-lg" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="text-3xl font-bold" style={{ color: theme.accentColor }}>
                {t("myTeam.welcomeCaptain")}
              </CardTitle>
              <CardDescription className="text-lg pt-2">
                {t("myTeam.welcomeDesc")}<br />
                <span className="block mt-2">
                  {t("myTeam.needTeamOrPlayers")}{" "}
                  <a href="https://discord.gg/ZxgmF7Kr4t" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: theme.primaryColor }}>
                    {t("myTeam.discord")}
                  </a>{" "}
                  {t("myTeam.findTeamChannel")}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p>{t("myTeam.signInToStart")}</p>
              <Button
                onClick={signInWithGoogle}
                className="w-full py-3 px-6 font-bold text-lg"
                style={{ backgroundColor: theme.primaryColor }}
              >
                {t("myTeam.signInWithGoogle")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // For new tournaments (not legacy)
  if (!isLegacyTournament) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Moja drużyna</h1>
        </div>
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle>Rejestracja drużyny</CardTitle>
            <CardDescription>
              {tournament.status === 'registration' 
                ? 'Rejestracja jest otwarta. Wypełnij formularz poniżej aby zgłosić drużynę.'
                : 'Rejestracja nie jest obecnie otwarta.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Formularz rejestracji drużyny będzie dostępny wkrótce.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Legacy tournament - no team found
  if (!hasTeam) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Moja drużyna</h1>
        </div>
        <NoTeamFound />
      </div>
    );
  }

  // Legacy tournament - team found
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Moja drużyna</h1>
      </div>

      {team && (
        <>
          <MyTeamHeader team={team} />
          
          <div className="grid gap-6 md:grid-cols-2">
            <RosterCard team={team} standins={standins} />
            <TeamStatusCard team={team} />
          </div>

          <SchedulingCard team={team} teams={teams} matches={matches} />

          {matches.length > 0 && (
            <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
              <CardHeader>
                <CardTitle>Historia meczów</CardTitle>
              </CardHeader>
              <CardContent>
                <MatchHistoryTable team={team} matches={matches} teams={teams} />
              </CardContent>
            </Card>
          )}

          <TeamStatsGrid team={team} />
          <PlayerAnalyticsTable team={team} />
        </>
      )}
    </div>
  );
}
