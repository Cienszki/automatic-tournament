
'use client';

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, PlayCircle, ShieldQuestion, Trophy, UserX } from "lucide-react";
import type { Team } from "@/lib/definitions";
import { cn } from "@/lib/utils";

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

interface MyTeamHeaderProps {
  team: Team;
}

export function MyTeamHeader({ team }: MyTeamHeaderProps) {
  return (
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
  );
}
