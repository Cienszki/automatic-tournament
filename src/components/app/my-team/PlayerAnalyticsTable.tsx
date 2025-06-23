
import type { Player } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";

interface PlayerAnalyticsTableProps {
  players: Player[];
}

export function PlayerAnalyticsTable({ players }: PlayerAnalyticsTableProps) {
  const getKDA = (player: Player) => {
    if (player.avgDeaths === 0) return "Perfect";
    return (((player.avgKills ?? 0) + (player.avgAssists ?? 0)) / (player.avgDeaths ?? 1)).toFixed(2);
  };

  return (
    <Card className="shadow-lg col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <BarChart2 className="mr-2" />
          Individual Player Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">KDA</TableHead>
                <TableHead className="text-center">Kills</TableHead>
                <TableHead className="text-center">Deaths</TableHead>
                <TableHead className="text-center">Assists</TableHead>
                <TableHead className="text-center">GPM</TableHead>
                <TableHead className="text-center">XPM</TableHead>
                <TableHead className="text-center">Fantasy Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">{player.nickname}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{player.role}</TableCell>
                  <TableCell className="text-center font-semibold text-primary">{getKDA(player)}</TableCell>
                  <TableCell className="text-center">{player.avgKills?.toFixed(1) ?? 'N/A'}</TableCell>
                  <TableCell className="text-center">{player.avgDeaths?.toFixed(1) ?? 'N/A'}</TableCell>
                  <TableCell className="text-center">{player.avgAssists?.toFixed(1) ?? 'N/A'}</TableCell>
                  <TableCell className="text-center">{player.avgGPM ?? 'N/A'}</TableCell>
                  <TableCell className="text-center">{player.avgXPM ?? 'N/A'}</TableCell>
                  <TableCell className="text-center">{player.fantasyPointsEarned ?? 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
