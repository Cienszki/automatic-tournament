
import type { Team, TeamStatus } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Users, Info, CheckCircle, AlertTriangle, Ban, Clock } from "lucide-react";
import { StandinRequestModal } from "@/components/app/StandinRequestModal";
import { useTranslation } from "@/hooks/useTranslation";

interface TeamStatusCardProps {
  team?: Team | null;
}

const statusConfig: Record<TeamStatus, { icon: React.ElementType; className: string }> = {
  pending: { icon: Clock, className: "bg-yellow-500 hover:bg-yellow-600" },
  verified: { icon: CheckCircle, className: "bg-green-500 hover:bg-green-600" },
  warning: { icon: AlertTriangle, className: "bg-orange-500 hover:bg-orange-600" },
  banned: { icon: Ban, className: "bg-red-500 hover:bg-red-600" },
  rejected: { icon: Ban, className: "bg-red-500 hover:bg-red-600" },
  eliminated: { icon: Ban, className: "bg-gray-500 hover:bg-gray-600" },
};

function getStatusInfo(status: TeamStatus) {
  return statusConfig[status] || statusConfig.pending;
}

export function TeamStatusCard({ team }: TeamStatusCardProps) {
  const { t } = useTranslation();
  
  if (!team) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <Info className="mr-2" />
            {t("teams.teamStatus")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t("teams.loadingStatus")}</p>
        </CardContent>
      </Card>
    );
  }

  const { icon: StatusIcon, className } = getStatusInfo(team.status);
  const StatusIconComponent = StatusIcon as React.ComponentType<{ className?: string }>;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <Info className="mr-2" />
          {t("teams.teamStatus")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge className={cn("px-3 py-1.5 text-sm w-full justify-center text-white", className)}>
          <StatusIconComponent className="mr-2 h-4 w-4" />
          {team.status}
        </Badge>
        
        <StandinRequestModal 
          team={team}
          trigger={
            <Button variant="outline" className="w-full">
              <Users className="mr-2 h-4 w-4" /> 
              {t("teams.needStandin")}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
