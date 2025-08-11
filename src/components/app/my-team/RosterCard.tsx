
import type { Team, Match, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, Swords, Sparkles, Shield, HandHelping, Eye, Users } from "lucide-react";
import { PlayerAvatar } from "../PlayerAvatar";
import { sortPlayersByRole } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface RosterCardProps {
  team?: Team | null;
  upcomingMatches?: Match[];
}

const roleIcons: Record<PlayerRole, React.ElementType> = {
  "Carry": Swords,
  "Mid": Sparkles,
  "Offlane": Shield,
  "Soft Support": HandHelping,
  "Hard Support": Eye,
};

export function RosterCard({ team, upcomingMatches }: RosterCardProps) {
  const { t } = useTranslation();

  if (!team) {
    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center text-primary">
                    <Users className="mr-2" />
                    {t("teams.teamRoster")}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>{t("teams.noTeamData")}</p>
            </CardContent>
        </Card>
    );
  }

  const sortedPlayers = sortPlayersByRole(team.players || []);
  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <Users className="mr-2" />
          {t("teams.teamRoster")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {sortedPlayers.map((player, index) => {
            const RoleIcon = roleIcons[player.role] || ListChecks;
            // Fallback: use nickname and index if id is missing/duplicate
            const key = player.id || player.nickname || index;
            return (
              <li key={key} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <PlayerAvatar player={player} />
                  <div>
                    <p className="font-semibold text-foreground">{player.nickname}</p>
                    <p className="text-sm text-muted-foreground">{player.mmr.toLocaleString()} MMR</p>
                  </div>
                </div>
                <RoleIcon className="h-6 w-6 text-muted-foreground" />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
