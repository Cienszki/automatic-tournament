
import type { Player } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlayerAnalyticsTableProps {
  players: Player[];
}

const statColumns = [
    { key: "avgKda", label: "KDA", description: "Kills, Deaths, Assists Ratio ((K+A)/D)" },
    { key: "avgKillParticipation", label: "KP%", description: "Kill Participation Percentage" },
    { key: "avgGPM", label: "GPM", description: "Gold Per Minute" },
    { key: "avgXPM", label: "XPM", description: "Experience Per Minute" },
    { key: "avgLastHitsPerMinute", label: "LH/min", description: "Last Hits Per Minute" },
    { key: "avgHeroDamagePerMinute", label: "HD/min", description: "Hero Damage Per Minute" },
    { key: "avgTowerDamagePerMinute", label: "TD/min", description: "Tower Damage Per Minute" },
    { key: "avgWardsPlacedPerMinute", label: "Wards/min", description: "Wards Placed Per Minute" },
    { key: "avgStunsPerMinute", label: "Stuns/min", description: "Stun Duration Per Minute" },
    { key: "avgSaves", label: "Saves", description: "Saves on Teammates" },
    { key: "avgCampsStacked", label: "Stacks", description: "Camps Stacked" },
];

export function PlayerAnalyticsTable({ players }: PlayerAnalyticsTableProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <BarChart2 className="mr-2" />
          Player Analytics
        </CardTitle>
        <CardDescription>
          Hover over column headers for stat descriptions. All stats are averaged per game.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TooltipProvider>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10">Player</TableHead>
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
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium sticky left-0 bg-card z-10">{player.nickname}</TableCell>
                    {statColumns.map(col => (
                        <TableCell key={`${player.id}-${col.key}`} className="text-center">
                            {(player as any)[col.key]?.toFixed(2) ?? 'N/A'}
                        </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </TooltipProvider>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
