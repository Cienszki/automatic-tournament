
import type { Team, Match, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, Swords, Sparkles, Shield, HandHelping, Eye, Users } from "lucide-react";
import { PlayerAvatar } from "../PlayerAvatar";

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
  if (!team) {
    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center text-primary">
                    <Users className="mr-2" />
                    Team Roster
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>No team data available.</p>
            </CardContent>
        </Card>
    );
  }
  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <Users className="mr-2" />
          Team Roster
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {(team.players || []).map((player) => {
            const RoleIcon = roleIcons[player.role] || ListChecks;
            return (
              <li key={player.id} className="flex items-center justify-between">
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
