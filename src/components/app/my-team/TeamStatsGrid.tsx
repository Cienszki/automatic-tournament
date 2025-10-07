
import type { Team } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, BarChart, Clock, Percent, Ratio, Shield, Sigma, Trophy, Users, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface TeamStatsGridProps {
  team?: Team | null;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  description?: string;
}

function StatCard({ icon: Icon, label, value, description }: StatCardProps) {
  const IconComponent = Icon as React.ComponentType<{ className?: string }>;
  return (
    <Card className="shadow-md bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center text-accent">
          <IconComponent className="h-5 w-5 mr-2" />
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
  const { t } = useTranslation();

  if (!team) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
                 <Card key={i} className="shadow-md bg-muted/20 animate-pulse">
                    <CardHeader className="pb-2">
                        <div className="h-5 bg-muted rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-full"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  }

  const matchesPlayed = (team.wins ?? 0) + (team.losses ?? 0) + (team.draws ?? 0);
  const winRate =
    matchesPlayed > 0
      ? ((team.wins ?? 0) / matchesPlayed) * 100
      : 0;

  const kda = team.averageDeathsPerGame && team.averageDeathsPerGame > 0
      ? (((team.averageKillsPerGame ?? 0) + (team.averageAssistsPerGame ?? 0)) / team.averageDeathsPerGame).toFixed(2)
      : t("teams.perfect");


  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Trophy}
        label={t("teams.record")}
        value={`${team.wins ?? 0}W - ${team.losses ?? 0}L - ${team.draws ?? 0}D`}
        description={t("teams.winsLosses")}
      />
      <StatCard
        icon={Percent}
        label={t("teams.winRate")}
        value={`${winRate.toFixed(1)}%`}
        description={`${matchesPlayed} ${t("teams.gamesPlayed")}`}
      />
      <StatCard
        icon={Clock}
        label={t("teams.avgDuration")}
        value={`${team.averageMatchDurationMinutes ?? 0} ${t("teams.min")}`}
        description={t("teams.averageMatchLength")}
      />
      <StatCard
        icon={TrendingUp}
        label={t("teams.avgKDA")}
        value={kda}
        description={t("teams.teamKDARatio")}
      />
      <StatCard
        icon={TrendingUp}
        label={t("teams.avgKills")}
        value={team.averageKillsPerGame?.toFixed(1) ?? 'N/A'}
        description={t("teams.killsPerGame")}
      />
      <StatCard
        icon={TrendingDown}
        label={t("teams.avgDeaths")}
        value={team.averageDeathsPerGame?.toFixed(1) ?? 'N/A'}
        description={t("teams.deathsPerGame")}
      />
      <StatCard
        icon={BarChart3}
        label={t("teams.avgAssists")}
        value={team.averageAssistsPerGame?.toFixed(1) ?? 'N/A'}
        description={t("teams.assistsPerGame")}
      />
      <StatCard
        icon={Award}
        label={t("teams.avgFantasyPts")}
        value={team.averageFantasyPoints?.toFixed(1) ?? 'N/A'}
        description={t("teams.teamFantasyTotal")}
      />
    </div>
  );
}
