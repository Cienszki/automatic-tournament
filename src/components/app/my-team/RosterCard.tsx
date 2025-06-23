
'use client';

import type { Player, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Shield, Swords, Sparkles, HandHelping, Eye, ListChecks, Edit } from "lucide-react";
import Link from "next/link";

interface RosterCardProps {
  players: Player[];
  teamId: string;
}

const roleIcons: Record<PlayerRole, React.ElementType> = {
  Carry: Swords,
  Mid: Sparkles,
  Offlane: Shield,
  "Soft Support": HandHelping,
  "Hard Support": Eye,
};

export function RosterCard({ players, teamId }: RosterCardProps) {
  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <User className="mr-2" />
          Player Roster
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-3">
          {players.map((player) => {
            const RoleIcon = roleIcons[player.role] || ListChecks;
            const basePlayerId = player.id.split('-t')[0];
            return (
              <li key={player.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${player.nickname.substring(0, 2)}`} alt={player.nickname} />
                    <AvatarFallback>{player.nickname.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                     <Link href={`/teams/${teamId}/players/${basePlayerId}`} className="font-semibold hover:text-primary">
                      {player.nickname}
                    </Link>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {player.role} - {player.mmr} MMR
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
       <CardFooter className="border-t pt-4">
          <Button variant="outline" className="w-full" onClick={() => alert("Stand-in management UI (simulated)")}>
            Manage Stand-ins
          </Button>
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => alert("Edit team details UI (simulated)")}>
            <Edit className="h-4 w-4" />
          </Button>
      </CardFooter>
    </Card>
  );
}
