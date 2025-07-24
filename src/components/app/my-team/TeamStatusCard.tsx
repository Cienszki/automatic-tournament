
import type { Team, TeamStatus } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mail, Info, CheckCircle, AlertTriangle, Ban, Clock } from "lucide-react";

interface TeamStatusCardProps {
  team?: Team | null;
}

const statusConfig: Record<TeamStatus, { icon: React.ElementType; className: string }> = {
  pending: { icon: Clock, className: "bg-yellow-500 hover:bg-yellow-600" },
  verified: { icon: CheckCircle, className: "bg-green-500 hover:bg-green-600" },
  warning: { icon: AlertTriangle, className: "bg-orange-500 hover:bg-orange-600" },
  banned: { icon: Ban, className: "bg-red-500 hover:bg-red-600" },
  rejected: { icon: Ban, className: "bg-red-500 hover:bg-red-600" },
};

function getStatusInfo(status: TeamStatus) {
  return statusConfig[status] || statusConfig.pending;
}

export function TeamStatusCard({ team }: TeamStatusCardProps) {
  if (!team) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <Info className="mr-2" />
            Team Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading status...</p>
        </CardContent>
      </Card>
    );
  }

  const { icon: StatusIcon, className } = getStatusInfo(team.status);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <Info className="mr-2" />
          Team Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge className={cn("px-3 py-1.5 text-sm w-full justify-center text-white", className)}>
          <StatusIcon className="mr-2 h-4 w-4" />
          {team.status}
        </Badge>
        <Button variant="outline" className="w-full" onClick={() => alert('Contact Admin form (simulated)')}>
          <Mail className="mr-2 h-4 w-4" /> Contact Admin
        </Button>
      </CardContent>
    </Card>
  );
}
