
import type { Team, Match, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, Swords, Sparkles, Shield, HandHelping, Eye, Users } from "lucide-react";
import { PlayerAvatar } from "../PlayerAvatar";

interface RosterCardProps {
  team: Team;
  upcomingMatches: Match[];
}

const roleIcons: Record<PlayerRole, React.ElementType> = {
  "Carry": Swords,
  "Mid": Sparkles,
  "Offlane": Shield,
  "Soft Support": HandHelping,
  "Hard Support": Eye,
};

export function RosterCard({ team, upcomingMatches }: RosterCardProps) {
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
          {team.players.map((player) => {
            const RoleIcon = roleIcons[player.role] || ListChecks;
            return (
              <li key={player.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <PlayerAvatar src={player.avatarUrlMedium} nickname={player.nickname} />
                  <div>
                    <p className="font-semibold text-foreground">{player.nickname}</p>
                    <p className="text-sm text-muted-foreground">{player.mmr.toLocaleString()} MMR</p>
                  </div>
                </div>
                <RoleIcon className="h-5 w-5 text-accent" />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
