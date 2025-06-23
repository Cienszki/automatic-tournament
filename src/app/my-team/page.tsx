
import { mockTeams, mockMatches } from "@/lib/mock-data";
import type { Team, Match, CaptainsChecklistItem } from "@/lib/definitions";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, ShieldQuestion, PlayCircle, UserX, Trophy, Crown, Edit } from "lucide-react";
import { RosterCard } from "@/components/app/my-team/RosterCard";
import { SchedulingCard } from "@/components/app/my-team/SchedulingCard";
import { TeamStatsGrid } from "@/components/app/my-team/TeamStatsGrid";
import { PlayerAnalyticsTable } from "@/components/app/my-team/PlayerAnalyticsTable";
import { MatchHistoryTable } from "@/components/app/my-team/MatchHistoryTable";
import { CaptainsChecklist } from "@/components/app/my-team/CaptainChecklist";
import { cn } from "@/lib/utils";

// In a real app, this would come from user authentication
const CAPTAIN_TEAM_ID = 'team1';

async function getMyTeamData(teamId: string) {
  const team = mockTeams.find((t) => t.id === teamId);
  if (!team) {
    return { team: undefined, upcomingMatches: [], pastMatches: [] };
  }

  const teamMatches = mockMatches.filter(
    (m) => m.teamA.id === teamId || m.teamB.id === teamId
  );

  const upcomingMatches = teamMatches
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const pastMatches = teamMatches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  return { team, upcomingMatches, pastMatches };
}

const getStatusBadgeClasses = (status: Team['status']) => {
  switch (status) {
    case "Not Verified": return "bg-gray-500/20 text-gray-300 border-gray-500/40";
    case "Active": return "bg-green-500/20 text-green-300 border-green-500/40";
    case "Eliminated": return "bg-red-500/20 text-red-300 border-red-500/40";
    case "Champions": return "bg-yellow-400/20 text-yellow-300 border-yellow-500/40";
    default: return "bg-gray-500 text-gray-100";
  }
};

const getStatusIcon = (status: Team['status']) => {
  switch (status) {
    case "Not Verified": return <ShieldQuestion className="h-4 w-4 mr-2" />;
    case "Active": return <PlayCircle className="h-4 w-4 mr-2" />;
    case "Eliminated": return <UserX className="h-4 w-4 mr-2" />;
    case "Champions": return <Trophy className="h-4 w-4 mr-2" />;
    default: return null;
  }
}

export default async function MyTeamPage() {
  const { team, upcomingMatches, pastMatches } = await getMyTeamData(CAPTAIN_TEAM_ID);

  if (!team) {
    // This could redirect to a team selection page or show an error
    notFound();
  }

  const totalFantasyPoints = team.players.reduce(
    (sum, player) => sum + (player.fantasyPointsEarned ?? 0),
    0
  );

  const checklistItems: CaptainsChecklistItem[] = [
    { id: '1', label: 'Review tournament rules', isCompleted: true, link: '/rules', linkText: 'View Rules' },
    { id: '2', label: 'Confirm roster and MMR with admin', isCompleted: team.status !== 'Not Verified', link: '#', linkText: 'Contact Admin' },
    { id: '3', label: `Schedule match vs ${upcomingMatches[0]?.teamA.id === team.id ? upcomingMatches[0]?.teamB.name : upcomingMatches[0]?.teamA.name || 'next opponent'}`, isCompleted: false },
    { id: '4', label: 'Submit result for previous match', isCompleted: true },
  ];

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="p-6 bg-muted/30">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Image
              src={team.logoUrl || `https://placehold.co/128x128.png`}
              alt={`${team.name} Logo`}
              width={100}
              height={100}
              className="rounded-lg border-2 border-card shadow-md"
              data-ai-hint="team logo"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                 <CardTitle className="text-4xl text-secondary">{team.name}</CardTitle>
                 <Badge className={cn("px-3 py-1.5 text-sm", getStatusBadgeClasses(team.status))}>
                    {getStatusIcon(team.status)}
                    {team.status}
                </Badge>
              </div>
              <CardDescription className="mt-1 italic text-base">"{team.motto}"</CardDescription>
            </div>
             <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => alert('Contact Admin form (simulated)')}>
                    <Mail className="mr-2 h-4 w-4" /> Contact Admin
                </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <SchedulingCard nextMatch={upcomingMatches[0]} team={team} />
          <TeamStatsGrid team={team} />
          <PlayerAnalyticsTable players={team.players} />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
          <RosterCard players={team.players} teamId={team.id} />
          <CaptainsChecklist items={checklistItems} />
           <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center text-primary">
                        <Crown className="mr-2" />
                        Fantasy Performance
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-4xl font-bold text-foreground">{totalFantasyPoints.toFixed(1)}</p>
                    <p className="text-muted-foreground">Total fantasy points generated by your players.</p>
                </CardContent>
            </Card>
        </div>
      </div>
      
      {/* Match History (Full Width) */}
      <MatchHistoryTable matches={pastMatches} teamId={team.id} />

    </div>
  );
}

export const metadata = {
  title: "My Team | Tournament Tracker",
  description: "Manage your team, schedule matches, and track performance.",
};
