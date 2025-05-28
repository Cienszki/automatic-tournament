
import type { Group } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface GroupTableProps {
  group: Group;
}

export function GroupTable({ group }: GroupTableProps) {
  // Sort teams by points (descending), then by name (ascending) as a tie-breaker
  const sortedTeams = [...group.teams].sort((a, b) => {
    if (b.points !== a.points) {
      return (b.points ?? 0) - (a.points ?? 0);
    }
    return a.name.localeCompare(b.name);
  });

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
            {sortedTeams.map((team, index) => (
              <TableRow key={team.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Link href={`/teams/${team.id}`} className="flex items-center space-x-3 hover:text-primary transition-colors">
                    <Image 
                      src={team.logoUrl || `https://placehold.co/40x40.png?text=${team.name.charAt(0)}`} 
                      alt={`${team.name} logo`} 
                      width={32} 
                      height={32} 
                      className="rounded-md object-cover"
                      data-ai-hint="team logo"
                    />
                    <span className="font-medium">{team.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-center">{team.matchesPlayed ?? 0}</TableCell>
                <TableCell className="text-center">{team.matchesWon ?? 0}</TableCell>
                <TableCell className="text-center">{team.matchesLost ?? 0}</TableCell>
                <TableCell className="text-right font-semibold">{team.points ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {group.teams.length === 0 && <p className="text-muted-foreground text-center py-4">No teams in this group yet.</p>}
      </CardContent>
    </Card>
  );
}
