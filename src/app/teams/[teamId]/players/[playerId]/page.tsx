
import * as React from "react";
import { getPlayerFromTeam, getAllMatches, getAllTeams } from "@/lib/firestore";
import { heroIconMap, heroColorMap, FALLBACK_HERO_COLOR } from "@/lib/hero-data";
import type { Player, Team, PlayerPerformanceInMatch } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, BarChartHorizontalBig, Star, TrendingUp, Shield, BarChart3, 
  Coins, Zap, Axe as AxeIconLucide, Target, Wallet, ListChecks, Puzzle, 
  Handshake as HandshakeIcon, Home
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PlayerPageParams {
  params: {
    teamId: string;
    playerId: string;
  };
}

interface PlayerData {
  player: Player;
  team: Team;
  matchHistory: PlayerMatchHistoryItem[];
  averageStats: {
    kda: string;
    gpm: number;
    xpm: number;
    fantasyPoints: number;
    winRate: string;
  };
}

interface PlayerMatchHistoryItem {
  matchId: string;
  opponentTeam: { id: string; name: string; logoUrl?: string };
  playerPerformance: PlayerPerformanceInMatch;
  result: 'Win' | 'Loss' | 'Ongoing';
  matchDate: Date;
  openDotaMatchUrl?: string;
}

async function getPlayerData(teamId: string, playerId: string): Promise<PlayerData | null> {
  const data = await getPlayerFromTeam(teamId, playerId);
  if (!data) return null;
  
  const { team, player } = data;

  const allMatches = await getAllMatches();
  const matchHistory: PlayerMatchHistoryItem[] = [];
  
  let totalKills = 0, totalDeaths = 0, totalAssists = 0;
  let totalGpm = 0, totalXpm = 0, totalFantasyPoints = 0;
  let matchesPlayed = 0, wins = 0;

  for (const match of allMatches) {
    if (match.status !== 'completed' || !match.teams.includes(team.id) || !match.playerPerformances) continue;

    const performance = match.playerPerformances.find(p => p.playerId === player.id);
    if (performance) {
      matchesPlayed++;
      totalKills += performance.kills;
      totalDeaths += performance.deaths;
      totalAssists += performance.assists;
      totalGpm += performance.gpm;
      totalXpm += performance.xpm;
      totalFantasyPoints += performance.fantasyPoints;

      const opponentTeamData = match.teamA.id === team.id ? match.teamB : match.teamA;
      const playerTeamWon = (match.teamA.id === team.id && match.teamA.score > match.teamB.score) || 
                            (match.teamB.id === team.id && match.teamB.score > match.teamA.score);
      if (playerTeamWon) wins++;
      
      matchHistory.push({
        matchId: match.id,
        opponentTeam: { id: opponentTeamData.id, name: opponentTeamData.name, logoUrl: opponentTeamData.logoUrl },
        playerPerformance: performance,
        result: playerTeamWon ? 'Win' : 'Loss',
        matchDate: new Date(match.dateTime),
        openDotaMatchUrl: match.openDotaMatchUrl
      });
    }
  }

  const averageStats = {
    kda: matchesPlayed > 0 ? ((totalKills + totalAssists) / Math.max(1, totalDeaths)).toFixed(2) : "0.00",
    gpm: matchesPlayed > 0 ? Math.round(totalGpm / matchesPlayed) : 0,
    xpm: matchesPlayed > 0 ? Math.round(totalXpm / matchesPlayed) : 0,
    fantasyPoints: matchesPlayed > 0 ? parseFloat((totalFantasyPoints / matchesPlayed).toFixed(1)) : 0,
    winRate: matchesPlayed > 0 ? `${((wins / matchesPlayed) * 100).toFixed(1)}%` : "0.0%",
  };
  
  matchHistory.sort((a, b) => b.matchDate.getTime() - a.matchDate.getTime());

  return { player, team, matchHistory: matchHistory.slice(0, 5), averageStats };
}


export default async function PlayerPage({ params }: PlayerPageParams) {
  const data = await getPlayerData(params.teamId, params.playerId);
  if (!data) notFound();
  
  const { player, team, matchHistory, averageStats } = data;

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
                <Avatar className="h-32 w-32 border-4 border-card shadow-md">
                    <AvatarImage src={player.profileScreenshotUrl} alt={`${player.nickname} avatar`} />
                    <AvatarFallback className="text-4xl">{player.nickname.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-4xl font-bold text-primary">{player.nickname}</CardTitle>
                    <CardDescription className="text-lg mt-1">
                        Member of <Link href={`/teams/${team.id}`} className="text-accent hover:underline font-medium">{team.name}</Link>
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <h3 className="text-2xl font-semibold mb-6 text-foreground">Average Tournament Statistics</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatDisplayCard icon={Star} label="MMR" value={player.mmr.toString()} />
            <StatDisplayCard icon={TrendingUp} label="Average KDA Ratio" value={averageStats.kda} />
            <StatDisplayCard icon={Coins} label="Average GPM" value={averageStats.gpm.toString()} />
            <StatDisplayCard icon={Zap} label="Average XPM" value={averageStats.xpm.toString()} />
            <StatDisplayCard icon={Shield} label="Win Rate" value={averageStats.winRate} />
            <StatDisplayCard icon={Star} label="Avg. Fantasy Points" value={averageStats.fantasyPoints.toString()} />
          </div>
          
          <div className="space-y-4">
            <h4 className="text-xl font-semibold text-foreground">Recent Match History</h4>
            {matchHistory.length > 0 ? (
              matchHistory.map(histItem => <MatchHistoryCard key={histItem.matchId} histItem={histItem} />)
            ) : (
              <p className="text-muted-foreground text-center py-4">No match performance data available.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const MatchHistoryCard = ({ histItem }: { histItem: PlayerMatchHistoryItem }) => {
  const { playerPerformance: perf, opponentTeam, result, matchDate, openDotaMatchUrl } = histItem;
  const HeroIconComponent = heroIconMap[perf.hero] || heroIconMap['Default'];
  const heroColorHex = heroColorMap[perf.hero] || FALLBACK_HERO_COLOR;
  
  return (
    <Card className="bg-muted/20 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
           <CardTitle className="text-lg flex items-center flex-wrap">
            <HeroIconComponent color={heroColorHex} className="h-5 w-5 mr-1.5 shrink-0" />
            <span style={{ color: heroColorHex }} className="font-semibold">{perf.hero}</span>
            <span className="text-muted-foreground mx-1.5 font-normal">vs</span>
            <Link href={`/teams/${opponentTeam.id}`} className="text-accent hover:underline">{opponentTeam.name}</Link>
          </CardTitle>
          <Badge variant={result === 'Win' ? 'secondary' : 'destructive'} className="ml-2 shrink-0">{result}</Badge>
        </div>
        <CardDescription className="text-xs mt-1">
          {matchDate.toLocaleDateString()}
          {openDotaMatchUrl && <Link href={openDotaMatchUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary/80 hover:text-primary">(OpenDota)</Link>}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
         <Table className="text-xs">
          <TableBody>
            <TableRow>
              <TableCell className="font-medium p-1.5"><ListChecks className="inline h-3.5 w-3.5 mr-1.5" />K/D/A</TableCell>
              <TableCell className="text-right p-1.5">{perf.kills}/{perf.deaths}/{perf.assists}</TableCell>
              <TableCell className="font-medium p-1.5"><Coins className="inline h-3.5 w-3.5 mr-1.5" />GPM</TableCell>
              <TableCell className="text-right p-1.5">{perf.gpm}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium p-1.5"><Zap className="inline h-3.5 w-3.5 mr-1.5" />XPM</TableCell>
              <TableCell className="text-right p-1.5">{perf.xpm}</TableCell>
               <TableCell className="font-medium p-1.5"><Star className="inline h-3.5 w-3.5 mr-1.5" />Fantasy Pts</TableCell>
              <TableCell className="text-right p-1.5 font-bold text-primary">{perf.fantasyPoints}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const StatDisplayCard = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string }) => (
  <Card className="bg-muted/20 p-4 shadow-sm">
    <div className="flex items-center mb-1"><Icon className="h-5 w-5 mr-2 text-primary" /><CardDescription className="text-sm font-medium">{label}</CardDescription></div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </Card>
);

export async function generateMetadata({ params }: { params: PlayerPageParams['params'] }) {
  const data = await getPlayerData(params.teamId, params.playerId);
  if (!data) return { title: "Player Not Found" };
  return { title: `${data.player.nickname} | ${data.team.name}`, description: `Stats for ${data.player.nickname}.` };
}

export async function generateStaticParams() {
    const teams = await getAllTeams();
    const params = teams.flatMap(team => 
        (team.players || []).map(player => ({
            teamId: team.id,
            playerId: player.id,
        }))
    );
    return params;
}
