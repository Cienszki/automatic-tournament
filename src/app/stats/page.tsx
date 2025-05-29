
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateMockSingleMatchRecords, generateMockPlayerAverageLeaders, generateMockTournamentHighlights } from "@/lib/mock-data";
import type { StatItem, TournamentHighlightRecord } from "@/lib/definitions";
import { BarChartHorizontalBig, Trophy, Zap } from "lucide-react";
import Link from "next/link";

async function getStatsData(): Promise<{
  singleMatchRecords: StatItem[];
  playerAverageLeaders: StatItem[];
  tournamentHighlights: TournamentHighlightRecord[];
}> {
  // In a real app, this data would come from an API or database.
  return {
    singleMatchRecords: generateMockSingleMatchRecords(),
    playerAverageLeaders: generateMockPlayerAverageLeaders(),
    tournamentHighlights: generateMockTournamentHighlights(),
  };
}

export default async function StatsPage() {
  const { singleMatchRecords, playerAverageLeaders, tournamentHighlights } = await getStatsData();

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <BarChartHorizontalBig className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Tournament Statistics</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Deep dive into player performances and tournament records.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center">
            <Trophy className="h-6 w-6 mr-2" /> Single Match Standouts
          </CardTitle>
          <CardDescription>Top individual performances in a single match.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Hero</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {singleMatchRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium flex items-center">
                      <record.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      {record.category}
                    </TableCell>
                    <TableCell>
                      {record.playerId && record.teamId ? (
                        <Link href={`/teams/${record.teamId}/players/${record.playerId}`} className="hover:text-primary">{record.playerName}</Link>
                      ) : (
                        record.playerName || 'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {record.teamId ? (
                        <Link href={`/teams/${record.teamId}`} className="hover:text-primary">{record.teamName}</Link>
                      ) : (
                        record.teamName || 'N/A'
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">{record.value}</TableCell>
                    <TableCell>{record.heroName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.openDotaMatchUrl ? (
                        <Link href={record.openDotaMatchUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                          {record.matchContext}
                        </Link>
                      ) : (
                        record.matchContext || 'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center">
            <Zap className="h-6 w-6 mr-2" /> Tournament Average Leaders
          </CardTitle>
          <CardDescription>Players leading in average performance across the tournament.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Average Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerAverageLeaders.map((leader) => (
                  <TableRow key={leader.id}>
                    <TableCell className="font-medium flex items-center">
                      <leader.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      {leader.category}
                    </TableCell>
                    <TableCell>
                      {leader.playerId && leader.teamId ? (
                         <Link href={`/teams/${leader.teamId}/players/${leader.playerId}`} className="hover:text-primary">{leader.playerName}</Link>
                      ) : (
                        leader.playerName || 'N/A'
                      )}
                    </TableCell>
                     <TableCell>
                      {leader.teamId ? (
                        <Link href={`/teams/${leader.teamId}`} className="hover:text-primary">{leader.teamName}</Link>
                      ) : (
                        leader.teamName || 'N/A'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">{leader.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Overall Tournament Records</CardTitle>
          <CardDescription>Memorable moments and records from the tournament.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          {tournamentHighlights.map((highlight) => (
            <Card key={highlight.id} className="bg-muted/30">
              <CardHeader className="flex flex-row items-center space-x-3 pb-2">
                <highlight.icon className="h-6 w-6 text-accent" />
                <CardTitle className="text-lg">{highlight.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{highlight.value}</p>
                {highlight.details && <p className="text-xs text-muted-foreground pt-1">{highlight.details}</p>}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center mt-8">
        Note: All statistics are simulated for demonstration purposes and would typically be sourced from game APIs like OpenDota.
      </p>
    </div>
  );
}

export const metadata = {
  title: "Statistics | Tournament Tracker",
  description: "Detailed player and tournament statistics.",
};
