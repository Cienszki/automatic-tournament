
import type { Group, GroupStanding } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface GroupTableProps {
  group: Group;
}

const sortStandings = (standings: GroupStanding[]): GroupStanding[] => {
  return standings.sort((a, b) => {
    // 1. Primary sort by points
    if (a.points !== b.points) {
      return b.points - a.points;
    }

    // 2. Secondary sort by head-to-head results among tied teams
    const tiedTeamIds = standings.filter(s => s.points === a.points).map(s => s.teamId);
    if (tiedTeamIds.length > 1) {
        const aDirectWins = tiedTeamIds.reduce((sum, teamId) => {
            if (a.headToHead && a.headToHead[teamId] === 'win') return sum + 1;
            return sum;
        }, 0);
        const bDirectWins = tiedTeamIds.reduce((sum, teamId) => {
            if (b.headToHead && b.headToHead[teamId] === 'win') return sum + 1;
            return sum;
        }, 0);

        if (aDirectWins !== bDirectWins) {
            return bDirectWins - aDirectWins;
        }
    }

    // 3. Tertiary sort by Neustadtl score
    if (a.neustadtlScore !== b.neustadtlScore) {
      return b.neustadtlScore - a.neustadtlScore;
    }

    // 4. Quaternary sort by total MMR (lower is better)
    if (a.totalMMR !== b.totalMMR) {
        return a.totalMMR - b.totalMMR;
    }

    // 5. Final sort by team name if still tied
    return a.teamName.localeCompare(b.teamName);
  });
};


export function GroupTable({ group }: GroupTableProps) {
  const standingsArray = Object.values(group.standings);
  const sortedStandings = sortStandings(standingsArray);
  const teamCount = standingsArray.length;

  // Define advancement rules based on group size
  const getAdvancementInfo = (position: number) => {
    if (teamCount === 4) {
      // 4-team groups: 1st -> Upper, 2nd -> Lower, 3rd -> Wildcards
      switch (position) {
        case 1: return { type: 'upper', label: 'Upper Bracket', color: 'bg-green-500' };
        case 2: return { type: 'lower', label: 'Lower Bracket', color: 'bg-yellow-500' };
        case 3: return { type: 'wildcard', label: 'Wildcards', color: 'bg-orange-500' };
        default: return { type: 'eliminated', label: 'Eliminated', color: 'bg-red-500' };
      }
    } else if (teamCount === 5) {
      // 5-team groups: 1st & 2nd -> Upper, 3rd -> Lower
      switch (position) {
        case 1:
        case 2: return { type: 'upper', label: 'Upper Bracket', color: 'bg-green-500' };
        case 3: return { type: 'lower', label: 'Lower Bracket', color: 'bg-yellow-500' };
        default: return { type: 'eliminated', label: 'Eliminated', color: 'bg-red-500' };
      }
    }
    return null;
  };

  return (
    <Card className="shadow-none border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
      <CardHeader>
        <CardTitle className="text-2xl text-primary flex items-center justify-between">
          {group.name}
          <Badge variant="outline" className="text-sm">
            {teamCount} teams
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-center">Played</TableHead>
                <TableHead className="text-center">Won</TableHead>
                <TableHead className="text-center">Drawn</TableHead>
                <TableHead className="text-center">Lost</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-center">Advancement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStandings.map((standing, index) => {
                const position = index + 1;
                const advancement = getAdvancementInfo(position);
                
                return (
                  <TableRow key={standing.teamId} className={cn(
                    advancement?.type === 'upper' && 'bg-green-500/10 hover:bg-green-500/20',
                    advancement?.type === 'lower' && 'bg-yellow-500/10 hover:bg-yellow-500/20',
                    advancement?.type === 'wildcard' && 'bg-orange-500/10 hover:bg-orange-500/20',
                    advancement?.type === 'eliminated' && 'bg-red-500/10 hover:bg-red-500/20'
                  )}>
                    <TableCell>{position}</TableCell>
                    <TableCell>
                      <Link href={`/teams/${standing.teamId}`} className="flex items-center space-x-3 hover:text-primary transition-colors">
                        <Image 
                          src={standing.teamLogoUrl || `https://placehold.co/40x40.png?text=${standing.teamName?.charAt(0)}`} 
                          alt={standing.teamName ? `${standing.teamName} logo` : 'Team logo'} 
                          width={32} 
                          height={32} 
                          className="rounded-md object-cover"
                          unoptimized={standing.teamLogoUrl?.endsWith('.gif')}
                        />
                        <span className="font-medium">{standing.teamName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">{standing.matchesPlayed}</TableCell>
                    <TableCell className="text-center">{standing.wins}</TableCell>
                    <TableCell className="text-center">{standing.draws || 0}</TableCell>
                    <TableCell className="text-center">{standing.losses}</TableCell>
                    <TableCell className="text-right font-semibold">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{standing.points}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Neustadtl Score: {standing.neustadtlScore.toFixed(2)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      {advancement && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs font-medium border-current",
                            advancement.color.replace('bg-', 'text-').replace('-500', '-400'),
                            advancement.color.replace('bg-', 'border-').replace('-500', '-400/50')
                          )}
                        >
                          {advancement.label}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
        {standingsArray.length === 0 && <p className="text-muted-foreground text-center py-4">No teams in this group yet.</p>}
      </CardContent>
    </Card>
  );
}
