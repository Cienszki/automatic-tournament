
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, PlayCircle, ShieldQuestion, Trophy, UserX, Info } from "lucide-react";
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

interface TeamStatusCardProps {
  team: Team;
}

export function TeamStatusCard({ team }: TeamStatusCardProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <Info className="mr-2" />
          Team Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge className={cn("px-3 py-1.5 text-sm w-full justify-center", getStatusBadgeClasses(team.status))}>
          {getStatusIcon(team.status)}
          {team.status}
        </Badge>
        <Button variant="outline" className="w-full" onClick={() => alert('Contact Admin form (simulated)')}>
          <Mail className="mr-2 h-4 w-4" /> Contact Admin
        </Button>
      </CardContent>
    </Card>
  );
}
