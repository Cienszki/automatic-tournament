
import type { Match, Team } from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExternalLink, History } from "lucide-react";

interface MatchHistoryTableProps {
  matches: Match[];
  teamId: string;
}

export function MatchHistoryTable({ matches, teamId }: MatchHistoryTableProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <History className="mr-2" />
          Match History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opponent</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((match) => {
              const opponent = match.teamA.id === teamId ? match.teamB : match.teamA;
              const isWin =
                (match.teamA.id === teamId && (match.teamA.score ?? 0) > (match.teamB.score ?? 0)) ||
                (match.teamB.id === teamId && (match.teamB.score ?? 0) > (match.teamA.score ?? 0));
              const resultText = match.status === "completed" ? (isWin ? "Win" : "Loss") : "N/A";
              const scoreText =
                match.status === "completed"
                  ? `${match.teamA.score ?? '-'} - ${match.teamB.score ?? '-'}`
                  : "-";

              return (
                <TableRow key={match.id}>
                  <TableCell>
                    <Link
                      href={`/teams/${opponent.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {opponent.name}
                    </Link>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-semibold",
                      resultText === "Win" ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {resultText}
                  </TableCell>
                  <TableCell>{scoreText}</TableCell>
                  <TableCell>{match.dateTime ? new Date(match.dateTime).toLocaleDateString() : 'TBD'}</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {matches.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No past matches found.</p>
        )}
      </CardContent>
    </Card>
  );
}
