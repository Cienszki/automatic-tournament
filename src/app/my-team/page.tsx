
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { getUserTeam } from "@/lib/admin-actions";
import type { Team } from "@/lib/definitions";

export default function MyTeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [team, setTeam] = React.useState<Team | null>(null);
  const [hasTeam, setHasTeam] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTeamData = async () => {
      if (user) {
        setLoading(true);
        const { hasTeam, team } = await getUserTeam(user.uid);
        setHasTeam(hasTeam);
        setTeam(team || null);
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
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }
  
  if (!user) {
    return (
      <Card className="text-center">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent>
          <p>You must be signed in to view your team page.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!hasTeam) {
    return (
       <Card className="text-center">
        <CardHeader><CardTitle>No Team Found</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4">You have not registered a team yet.</p>
          <Button asChild><Link href="/register">Register Your Team</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (!team) {
     return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <MyTeamHeader team={team} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <SchedulingCard matches={[]} teamId={team.id} />
          <MatchHistoryTable matches={[]} />
        </div>
        <div className="space-y-8">
          <RosterCard players={team.players} />
          <TeamStatusCard status={team.status} />
        </div>
      </div>
      <TeamStatsGrid />
      <PlayerAnalyticsTable players={team.players} />
    </div>
  );
}
