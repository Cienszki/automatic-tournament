
import type { Team } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";

interface PlayerAnalyticsTableProps {
  team?: Team | null;
}

export function PlayerAnalyticsTable({ team }: PlayerAnalyticsTableProps) {
  const { t } = useTranslation();
  const players = team?.players || [];
  
  const statColumns = [
    { key: "avgKda", label: t("teams.kda"), description: t("teams.kdaDesc") },
    { key: "avgKillParticipation", label: t("teams.killParticipation"), description: t("teams.killParticipationDesc") },
    { key: "avgGPM", label: t("teams.gpm"), description: t("teams.gpmDesc") },
    { key: "avgXPM", label: t("teams.xpm"), description: t("teams.xpmDesc") },
    { key: "avgLastHitsPerMinute", label: t("teams.lastHitsMin"), description: t("teams.lastHitsMinDesc") },
    { key: "avgHeroDamagePerMinute", label: t("teams.heroDamageMin"), description: t("teams.heroDamageMinDesc") },
    { key: "avgTowerDamagePerMinute", label: t("teams.towerDamageMin"), description: t("teams.towerDamageMinDesc") },
    { key: "avgWardsPlacedPerMinute", label: t("teams.wardsMin"), description: t("teams.wardsMinDesc") },
    { key: "avgStunsPerMinute", label: t("teams.stunsMin"), description: t("teams.stunsMinDesc") },
    { key: "avgHeroHealingPerMinute", label: t("teams.heroHealingMin"), description: t("teams.heroHealingMinDesc") },
    { key: "avgDeniesPerMinute", label: t("teams.deniesMin"), description: t("teams.deniesMinDesc") },
    { key: "avgObserverKills", label: t("teams.wardKills"), description: t("teams.wardKillsDesc") },
    { key: "avgCampsStacked", label: t("teams.stacks"), description: t("teams.stacksDesc") },
  ];
    
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <BarChart2 className="mr-2" />
          {t("teams.playerAnalytics")}
        </CardTitle>
        <CardDescription>
          {t("teams.playerAnalyticsDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TooltipProvider>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10">{t("player.player")}</TableHead>
                  {statColumns.map(col => (
                    <TableHead key={col.key} className="text-center">
                       <Tooltip>
                          <TooltipTrigger className="flex items-center justify-center w-full">
                            {col.label} <HelpCircle className="h-3.5 w-3.5 ml-1.5 opacity-50" />
                          </TooltipTrigger>
                          <TooltipContent>{col.description}</TooltipContent>
                        </Tooltip>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.length > 0 ? (
                    players.map((player, index) => {
                      const key = player.id || player.nickname || index;
                      return (
                        <TableRow key={key}>
                          <TableCell className="font-medium sticky left-0 bg-card z-10">{player.nickname}</TableCell>
                          {statColumns.map(col => (
                              <TableCell key={`${key}-${col.key}`} className="text-center">
                                  {(player as any)[col.key]?.toFixed(2) ?? 'N/A'}
                              </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                ) : (
                    <TableRow>
                        <TableCell colSpan={statColumns.length + 1} className="text-center h-24">
                            {t("teams.noPlayerData")}
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </TooltipProvider>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
