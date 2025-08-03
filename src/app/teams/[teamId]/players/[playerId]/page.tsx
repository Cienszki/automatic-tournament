
import * as React from "react";
import { getPlayerFromTeam, getAllMatches, getAllTeams } from "@/lib/firestore";
import { heroIconMap, heroColorMap, FALLBACK_HERO_COLOR } from "@/lib/hero-data";
import type { Player, Team, PlayerPerformanceInMatch } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/app/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ExternalLink, BarChartHorizontalBig, Star, TrendingUp, Shield, BarChart3, 
  Coins, Zap, Axe as AxeIconLucide, Target, Wallet, ListChecks, Puzzle, 
  Handshake as HandshakeIcon, Home, ArrowLeft, Trophy, Swords, Skull
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PageProps {
  params: Promise<{
    teamId: string;
    playerId: string;
  }>;
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
        matchDate: new Date(match.dateTime || match.defaultMatchTime),
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


export default async function PlayerPage({ params }: PageProps) {
  const resolvedParams = await params;
  const data = await getPlayerData(resolvedParams.teamId, resolvedParams.playerId);
  if (!data) notFound();
  
  const { player, team, matchHistory, averageStats } = data;
  const allTeams = await getAllTeams();

  // Calculate league averages for comparison
  const allPlayers = allTeams.flatMap(t => t.players || []);
  const leagueAvgMMR = allPlayers.length ? Math.round(allPlayers.reduce((sum, p) => sum + p.mmr, 0) / allPlayers.length) : 0;

  return (
    <div className="space-y-8">
      {/* Back to team button */}
      <Button variant="outline" asChild>
        <Link href={`/teams/${team.id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {team.name}
        </Link>
      </Button>

      {/* Main profile card */}
      <Card className={cn(
        "flex flex-col h-full shadow-none border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]"
      )}>
        <CardHeader className="bg-muted/30 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
            <PlayerAvatar player={player} size="large" />
            <div className="text-center md:text-left">
              <CardTitle className="text-4xl font-bold text-primary">{player.nickname}</CardTitle>
              <CardDescription className="text-lg mt-1">
                <Badge variant="secondary" className="mr-2">{player.role}</Badge>
                Member of <Link href={`/teams/${team.id}`} className="text-accent hover:underline font-medium">{team.name}</Link>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Core stats */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Star className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">MMR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
            <p className="text-3xl font-bold text-foreground mb-2">{formatNumber(player.mmr)}</p>
            <Progress
              value={Math.min(100, Math.max(0, (player.mmr / Math.max(leagueAvgMMR * 1.5, 1)) * 100))}
              className="w-3/4 h-2.5"
              aria-label="MMR progress"
            />
            <p className="text-xs text-muted-foreground mt-1">
              League avg: {formatNumber(leagueAvgMMR)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <TrendingUp className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">KDA Ratio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
            <p className="text-3xl font-bold text-foreground">{averageStats.kda}</p>
          </CardContent>
        </Card>

        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Shield className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">Win Rate</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
            <p className="text-3xl font-bold text-foreground">{averageStats.winRate}</p>
          </CardContent>
        </Card>

        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Coins className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">Avg. GPM</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
            <p className="text-3xl font-bold text-foreground">{averageStats.gpm}</p>
          </CardContent>
        </Card>

        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Zap className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">Avg. XPM</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
            <p className="text-3xl font-bold text-foreground">{averageStats.xpm}</p>
          </CardContent>
        </Card>

        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Trophy className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">Fantasy Points</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
            <p className="text-3xl font-bold text-foreground">{averageStats.fantasyPoints}</p>
          </CardContent>
        </Card>
      </div>

      {/* Match history */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Recent Match History</CardTitle>
          <CardDescription>Performance in recent tournament matches.</CardDescription>
        </CardHeader>
        <CardContent>
          {matchHistory.length > 0 ? (
            <div className="space-y-4">
              {matchHistory.map(histItem => <MatchHistoryCard key={histItem.matchId} histItem={histItem} />)}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No match performance data available.</p>
          )}
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
    <Card className={cn(
      "shadow-md transition-colors duration-200 hover:bg-muted/30",
      result === 'Win' ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"
    )}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
           <CardTitle className="text-lg flex items-center flex-wrap">
            <HeroIconComponent color={heroColorHex} className="h-5 w-5 mr-1.5 shrink-0" />
            <span style={{ color: heroColorHex }} className="font-semibold">{perf.hero}</span>
            <span className="text-muted-foreground mx-1.5 font-normal">vs</span>
            <Link href={`/teams/${opponentTeam.id}`} className="text-accent hover:underline">{opponentTeam.name}</Link>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={result === 'Win' ? 'secondary' : 'destructive'} className="shrink-0">{result}</Badge>
            {openDotaMatchUrl && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={openDotaMatchUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-xs mt-1">
          {matchDate.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Swords className="h-4 w-4 mr-1 text-green-500" />
              <span className="font-medium">K/D/A</span>
            </div>
            <div className="font-bold text-foreground">{perf.kills}/{perf.deaths}/{perf.assists}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Coins className="h-4 w-4 mr-1 text-yellow-500" />
              <span className="font-medium">GPM</span>
            </div>
            <div className="font-bold text-foreground">{perf.gpm}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Zap className="h-4 w-4 mr-1 text-blue-500" />
              <span className="font-medium">XPM</span>
            </div>
            <div className="font-bold text-foreground">{perf.xpm}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Trophy className="h-4 w-4 mr-1 text-purple-500" />
              <span className="font-medium">Fantasy</span>
            </div>
            <div className="font-bold text-primary">{perf.fantasyPoints}</div>
          </div>
        </div>
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

export async function generateMetadata({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
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
