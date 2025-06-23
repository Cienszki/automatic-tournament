
import type { Team } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, BarChart, Clock, Percent, Ratio, Shield, Sigma, Trophy, Users, BarChart3, TrendingUp, TrendingDown } from "lucide-react";

interface TeamStatsGridProps {
  team: Team;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  description?: string;
}

function StatCard({ icon: Icon, label, value, description }: StatCardProps) {
  return (
    <Card className="shadow-md bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center text-accent">
          <Icon className="h-5 w-5 mr-2" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function TeamStatsGrid({ team }: TeamStatsGridProps) {
  const winRate =
    team.matchesPlayed && team.matchesPlayed > 0
      ? ((team.matchesWon ?? 0) / team.matchesPlayed) * 100
      : 0;

  const kda = team.averageDeathsPerGame && team.averageDeathsPerGame > 0
      ? (((team.averageKillsPerGame ?? 0) + (team.averageAssistsPerGame ?? 0)) / team.averageDeathsPerGame).toFixed(2)
      : 'Perfect';


  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Trophy}
        label="Record"
        value={`${team.matchesWon ?? 0}W - ${team.matchesLost ?? 0}L`}
        description="Wins / Losses"
      />
      <StatCard
        icon={Percent}
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        description={`${team.matchesPlayed ?? 0} games played`}
      />
      <StatCard
        icon={Clock}
        label="Avg. Duration"
        value={`${team.averageMatchDurationMinutes ?? 0} min`}
        description="Average match length"
      />
      <StatCard
        icon={TrendingUp}
        label="Avg. KDA"
        value={kda}
        description="Team KDA Ratio"
      />
      <StatCard
        icon={TrendingUp}
        label="Avg. Kills"
        value={team.averageKillsPerGame?.toFixed(1) ?? 'N/A'}
        description="Kills per game"
      />
      <StatCard
        icon={TrendingDown}
        label="Avg. Deaths"
        value={team.averageDeathsPerGame?.toFixed(1) ?? 'N/A'}
        description="Deaths per game"
      />
      <StatCard
        icon={BarChart3}
        label="Avg. Assists"
        value={team.averageAssistsPerGame?.toFixed(1) ?? 'N/A'}
        description="Assists per game"
      />
      <StatCard
        icon={Award}
        label="Avg. Fantasy Pts"
        value={team.averageFantasyPoints?.toFixed(1) ?? 'N/A'}
        description="Team fantasy total"
      />
    </div>
  );
}
