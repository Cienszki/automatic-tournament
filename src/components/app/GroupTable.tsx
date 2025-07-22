
import type { Group, GroupStanding } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface GroupTableProps {
  group: Group;
}

const sortStandings = (standings: GroupStanding[]): GroupStanding[] => {
  return standings.sort((a, b) => {
    // Handle cases where team data might be missing
    if (!a.teamName) return 1;
    if (!b.teamName) return -1;

    // 1. Primary sort by points
    if (a.points !== b.points) {
      return b.points - a.points;
    }

    // 2. Secondary sort by head-to-head results among tied teams
    const tiedTeams = standings.filter(s => s.points === a.points).map(s => s.teamId);
    if (tiedTeams.length > 1) {
      const aHeadToHeadPoints = tiedTeams.reduce((sum, teamId) => {
        if (teamId === a.teamId) return sum;
        return sum + (a.headToHead?.[teamId] || 0);
      }, 0);
      const bHeadToHeadPoints = tiedTeams.reduce((sum, teamId) => {
        if (teamId === b.teamId) return sum;
        return sum + (b.headToHead?.[teamId] || 0);
      }, 0);

      if (aHeadToHeadPoints !== bHeadToHeadPoints) {
        return bHeadToHeadPoints - aHeadToHeadPoints;
      }
    }

    // 3. Tertiary sort by Neustadtl score
    if (a.neustadtlScore !== b.neustadtlScore) {
      return b.neustadtlScore - a.neustadtlScore;
    }

    // 4. Final sort by team name if still tied
    return a.teamName.localeCompare(b.teamName);
  });
};


export function GroupTable({ group }: GroupTableProps) {
  const standingsArray = Object.values(group.standings);
  const sortedStandings = sortStandings(standingsArray);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-primary">{group.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-center">Played</TableHead>
              <TableHead className="text-center">Won</TableHead>
              <TableHead className="text-center">Lost</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStandings.map((standing, index) => (
              <TableRow key={standing.teamId}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Link href={`/teams/${standing.teamId}`} className="flex items-center space-x-3 hover:text-primary transition-colors">
                    <Image 
                      src={standing.teamLogoUrl || `https://placehold.co/40x40.png?text=${standing.teamName.charAt(0)}`} 
                      alt={`${standing.teamName} logo`} 
                      width={32} 
                      height={32} 
                      className="rounded-md object-cover"
                    />
                    <span className="font-medium">{standing.teamName}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-center">{standing.matchesPlayed}</TableCell>
                <TableCell className="text-center">{standing.wins}</TableCell>
                <TableCell className="text-center">{standing.losses}</TableCell>
                <TableCell className="text-right font-semibold">{standing.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {standingsArray.length === 0 && <p className="text-muted-foreground text-center py-4">No teams in this group yet.</p>}
      </CardContent>
    </Card>
  );
}
