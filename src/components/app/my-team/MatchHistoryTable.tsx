
import type { Match, Team, Standin } from "@/lib/definitions";
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
import { StandinInfoDisplay } from "../StandinInfoDisplay";
import { useTranslation } from "@/hooks/useTranslation";

interface MatchHistoryTableProps {
  matches: Match[];
  teamId: string;
  teams?: Team[];
  standins?: Standin[];
}

export function MatchHistoryTable({ matches, teamId, teams = [], standins = [] }: MatchHistoryTableProps) {
  const { t } = useTranslation();

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <History className="mr-2" />
          {t("teams.matchHistory")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("teams.opponent")}</TableHead>
              <TableHead>{t("teams.result")}</TableHead>
              <TableHead>{t("teams.score")}</TableHead>
              <TableHead>{t("teams.date")}</TableHead>
              <TableHead>{t("teams.standins")}</TableHead>
              <TableHead>{t("teams.link")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((match) => {
              const opponent = match.teamA.id === teamId ? match.teamB : match.teamA;
              const isWin =
                (match.teamA.id === teamId && (match.teamA.score ?? 0) > (match.teamB.score ?? 0)) ||
                (match.teamB.id === teamId && (match.teamB.score ?? 0) > (match.teamA.score ?? 0));
              const resultText = match.status === "completed" ? (isWin ? t("teams.win") : t("teams.loss")) : "N/A";
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
                      resultText === t("teams.win") ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {resultText}
                  </TableCell>
                  <TableCell>{scoreText}</TableCell>
                  <TableCell>{match.dateTime ? new Date(match.dateTime).toLocaleDateString() : t("teams.tbd")}</TableCell>
                  <TableCell>
                    <StandinInfoDisplay 
                      match={match}
                      teams={teams}
                      standins={standins}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {matches.length === 0 && (
          <p className="text-center text-muted-foreground py-4">{t("teams.noPastMatches")}</p>
        )}
      </CardContent>
    </Card>
  );
}
