
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
                (match.teamA.id === teamId && (match.teamAScore ?? 0) > (match.teamBScore ?? 0)) ||
                (match.teamB.id === teamId && (match.teamBScore ?? 0) > (match.teamAScore ?? 0));
              const resultText = match.status === "completed" ? (isWin ? "Win" : "Loss") : "N/A";
              const scoreText =
                match.status === "completed"
                  ? `${match.teamAScore ?? '-'} - ${match.teamBScore ?? '-'}`
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
                  <TableCell>{new Date(match.dateTime).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {match.openDotaMatchUrl ? (
                      <a
                        href={match.openDotaMatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
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
