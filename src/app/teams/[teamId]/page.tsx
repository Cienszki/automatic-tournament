// Role icon utility (copied from TeamCard)
const getRoleIcon = (role: string) => {
  switch (role) {
    case "Carry":
      return <Swords className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Mid":
      return <Medal className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Offlane":
      return <Shield className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Soft Support":
      return <HandshakeIcon className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Hard Support":
      return <Users className="h-4 w-4 text-primary mr-2 shrink-0" />;
    default:
      return <ListChecks className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />;
  }
};

import {
  Users, ListChecks, ExternalLink, Medal, Swords, UserCheck, UserX, ShieldQuestion,
  PlayCircle, Sigma, Trophy, Users2, Clock, Percent, Skull, Ratio,
  Handshake as HandshakeIcon, Award, Shield, MessageSquare, Coins, 
  TrendingUp, Target, Zap, Heart, Pickaxe
} from "lucide-react";
import type { Icon as LucideIconType } from "lucide-react";
import { notFound } from "next/navigation";
import { cn, sortPlayersByRole, formatNumber } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { heroIconMap } from "@/lib/hero-data";
import { getTeamById, getAllMatches, getAllTeams } from "@/lib/firestore";
import type { Team, Player, Match, TeamStatus } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/app/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import Link from "next/link";
import { CopyToClipboard } from "@/components/app/CopyToClipboard";


interface PageProps {
  params: Promise<{ teamId: string }>;
}

async function getTeamData(teamId: string): Promise<{ team: Team | undefined, teamMatches: Match[] }> {
  const team = await getTeamById(teamId);
  if (!team) return { team: undefined, teamMatches: [] };

  const allMatches = await getAllMatches();
  const teamMatches = allMatches.filter(m => m.teams && m.teams.includes(teamId) && m.status === 'completed');
  return { team, teamMatches };
}

const getStatusBadgeClasses = (status?: TeamStatus) => {
  switch (status) {
    case "pending":
      return "bg-gray-500/20 text-gray-300 border-gray-500/40 hover:bg-gray-500/30";
    case "verified":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "warning":
      return "bg-yellow-400/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-400/30";
    case "banned":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/80";
    default:
      return "border-transparent bg-gray-500 text-gray-100";
  }
};

const getStatusIcon = (status?: TeamStatus) => {
  switch (status) {
    case "pending":
      return <ShieldQuestion className="h-4 w-4 mr-1.5" />;
    case "verified":
      return <PlayCircle className="h-4 w-4 mr-1.5" />;
    case "warning":
      return <UserX className="h-4 w-4 mr-1.5" />;
    case "banned":
      return <Trophy className="h-4 w-4 mr-1.5" />;
    default:
      return null;
  }
}

const podiumColors = [
  { border: 'border-chart-1', text: 'text-chart-1', bg: 'bg-chart-1/10' },
  { border: 'border-chart-2', text: 'text-chart-2', bg: 'bg-chart-2/10' },
  { border: 'border-chart-3', text: 'text-chart-3', bg: 'bg-chart-3/10' },
];

function getRankForStat(
  currentTeamValue: number | undefined,
  allTeams: Team[],
  statKey: keyof Pick<Team, 'averageKillsPerGame' | 'averageDeathsPerGame' | 'averageAssistsPerGame' | 'averageFantasyPoints'>,
  sortOrder: 'asc' | 'desc' = 'desc'
): string {
  if (currentTeamValue === undefined || currentTeamValue === null || isNaN(currentTeamValue)) return "N/A";

  const validTeams = allTeams.filter(t => {
    const val = t[statKey];
    return val !== undefined && val !== null && typeof val === 'number' && !isNaN(val);
  });
  if (validTeams.length === 0) return "N/A";

  const sortedTeams = [...validTeams].sort((a, b) => {
    const valA = a[statKey] as number;
    const valB = b[statKey] as number;
    return sortOrder === 'desc' ? valB - valA : valA - valB;
  });

  const rank = sortedTeams.findIndex(t => (t[statKey] as number) === currentTeamValue) + 1;
  return rank > 0 ? `${rank} / ${sortedTeams.length}` : "N/A";
}


export default async function TeamPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { team, teamMatches } = await getTeamData(resolvedParams.teamId);
  const allTeams = await getAllTeams(); // Fetch all teams for ranking

  if (!team) {
    notFound();
  }
  
  const sortedPlayers = sortPlayersByRole(team.players || []);
  const totalMMR = sortedPlayers.reduce((sum, player) => sum + player.mmr, 0);
  const sortedHeroes = team.mostPlayedHeroes ? [...team.mostPlayedHeroes].sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 3) : [];

  const avgMatchDurationMinutes = team.averageMatchDurationMinutes || 0;
  const displayMinutes = avgMatchDurationMinutes % 60;
  const minuteHandAngle = (displayMinutes / 60) * 360;

  const maxKills = Math.max(...allTeams.map(t => t.averageKillsPerGame ?? 0).filter(v => v !== undefined && !isNaN(v)), 1);
  const minDeaths = Math.min(...allTeams.map(t => t.averageDeathsPerGame ?? 999).filter(v => v !== undefined && !isNaN(v)), 999);
  const maxAssists = Math.max(...allTeams.map(t => t.averageAssistsPerGame ?? 0).filter(v => v !== undefined && !isNaN(v)), 1);
  const maxFantasyPoints = Math.max(...allTeams.map(t => t.averageFantasyPoints ?? 0).filter(v => v !== undefined && !isNaN(v)), 1);

  // Calculate league averages for each stat
  const leagueAvgKills = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageKillsPerGame || 0), 0) / allTeams.length).toFixed(1) : 'N/A';
  const leagueAvgDeaths = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageDeathsPerGame || 0), 0) / allTeams.length).toFixed(1) : 'N/A';
  const leagueAvgAssists = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageAssistsPerGame || 0), 0) / allTeams.length).toFixed(1) : 'N/A';
  const leagueAvgFantasy = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageFantasyPoints || 0), 0) / allTeams.length).toFixed(1) : 'N/A';

  const performanceStats = [
    {
      label: "Avg. Kills / Game",
      value: team.averageKillsPerGame?.toFixed(1) ?? 'N/A',
      icon: Swords,
      type: 'progress',
      rawValue: team.averageKillsPerGame,
      maxValue: maxKills,
      leagueAvg: leagueAvgKills,
      bestValue: maxKills,
      rank: getRankForStat(team.averageKillsPerGame, allTeams, 'averageKillsPerGame', 'desc'),
      statKey: 'averageKillsPerGame' as keyof Team,
      sortOrder: 'desc' as 'desc' | 'asc',
    },
    {
      label: "Avg. Deaths / Game",
      value: team.averageDeathsPerGame?.toFixed(1) ?? 'N/A',
      icon: Skull,
      type: 'progress',
      rawValue: team.averageDeathsPerGame,
      maxValue: minDeaths,
      leagueAvg: leagueAvgDeaths,
      bestValue: minDeaths,
      rank: getRankForStat(team.averageDeathsPerGame, allTeams, 'averageDeathsPerGame', 'asc'),
      statKey: 'averageDeathsPerGame' as keyof Team,
      sortOrder: 'asc' as 'desc' | 'asc',
    },
    {
      label: "Avg. Assists / Game",
      value: team.averageAssistsPerGame?.toFixed(1) ?? 'N/A',
      icon: HandshakeIcon,
      type: 'progress',
      rawValue: team.averageAssistsPerGame,
      maxValue: maxAssists,
      leagueAvg: leagueAvgAssists,
      bestValue: maxAssists,
      rank: getRankForStat(team.averageAssistsPerGame, allTeams, 'averageAssistsPerGame', 'desc'),
      statKey: 'averageAssistsPerGame' as keyof Team,
      sortOrder: 'desc' as 'desc' | 'asc',
    },
    {
      label: "Avg. Fantasy Points",
      value: team.averageFantasyPoints?.toFixed(1) ?? 'N/A',
      icon: Award,
      type: 'progress',
      rawValue: team.averageFantasyPoints,
      maxValue: maxFantasyPoints,
      leagueAvg: leagueAvgFantasy,
      bestValue: maxFantasyPoints,
      rank: getRankForStat(team.averageFantasyPoints, allTeams, 'averageFantasyPoints', 'desc'),
      statKey: 'averageFantasyPoints' as keyof Team,
      sortOrder: 'desc' as 'desc' | 'asc',
    }
  ];


  return (
    <div className="space-y-8">
      <Card className={cn(
        "flex flex-col h-full shadow-none border-0 bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]",
        team.status === 'banned' && "bg-destructive/10 border-destructive/30",
      )}>
        <CardHeader className="bg-muted/30 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
            <Image
              src={team.logoUrl || `https://placehold.co/128x128.png?text=${team.name.charAt(0)}`}
              alt={`${team.name} logo`}
              width={128}
              height={128}
              className="rounded-xl border-4 border-card object-cover shadow-md"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <CardTitle className="text-4xl font-bold text-primary">
                  {team.name}
                </CardTitle>
                <Badge className={cn("text-sm px-3 py-1", getStatusBadgeClasses(team.status))}>
                  {getStatusIcon(team.status)}
                  {team.status}
                </Badge>
              </div>
              <CardDescription className="text-lg mt-1">
                Detailed profile and performance statistics.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-6">
          <div className="md:col-span-1 space-y-4">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-foreground">
               <Shield className="h-6 w-6 mr-2 text-primary" /> Team Summary
            </h3>
             <InfoItem icon={ListChecks} label="Matches Played" value={team.matchesPlayed ?? 0} />
             <InfoItem icon={Swords} label="Wins / Draws / Losses" value={`${team.wins ?? 0}W / ${team.draws ?? 0}D / ${team.losses ?? 0}L`} />
             <InfoItem icon={Sigma} label="Total MMR" value={formatNumber(totalMMR)} />
             {team.captainDiscordUsername && (
                <div className="flex items-center text-md p-3 bg-muted/20 rounded-md">
                    <MessageSquare className="h-5 w-5 mr-3 text-primary" />
                    <span className="font-medium text-muted-foreground">Captain's Discord:</span>
                    <span className="ml-auto font-semibold text-foreground">{team.captainDiscordUsername}</span>
                    <CopyToClipboard text={team.captainDiscordUsername} />
                </div>
             )}
          </div>
          <div className="md:col-span-1 space-y-4">
             <h3 className="text-xl font-semibold mb-4 flex items-center text-foreground">
                <Users className="h-6 w-6 mr-2 text-primary" /> Player Roster
            </h3>
            <div className="space-y-3">
              {sortedPlayers.map((player) => (
                <Link 
                  key={player.id} 
                  href={`/teams/${team.id}/players/${player.id}`}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/10 hover:bg-muted/20 transition-colors group"
                >
                  {getRoleIcon(player.role)}
                  <PlayerAvatar player={player} size="small" />
                  <span className="font-medium text-foreground text-base group-hover:text-primary">{player.nickname}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{player.role}</span>
                  <span className="ml-auto text-xs text-muted-foreground">MMR: {player.mmr ? formatNumber(player.mmr) : 'N/A'}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary ml-1" />
                </Link>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Users2 className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">Top Heroes</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            {sortedHeroes.length > 0 ? (
              <div className="flex flex-col md:flex-row justify-around items-end gap-4 md:gap-2 py-4 min-h-[200px] md:min-h-[220px]">
                {[sortedHeroes[1], sortedHeroes[0], sortedHeroes[2]].map((heroStat, index) => {
                  if (!heroStat) return <div key={`placeholder-${index}`} className="w-full md:w-1/3 lg:w-1/4"></div>;

                  const podiumOrderIndex = index === 0 ? 1 : (index === 1 ? 0 : 2);
                  const podiumStyle = podiumColors[podiumOrderIndex];
                  const heightClasses = [
                    "h-[90%] md:h-[190px]",
                    "h-[75%] md:h-[160px]",
                    "h-[60%] md:h-[130px]",
                  ];
                  const currentHeight = heightClasses[podiumOrderIndex];
                  const HeroIcon = heroIconMap[heroStat.name] || heroIconMap['Default'];

                  return (
                    <div
                      key={heroStat.name}
                      className={cn(
                        "w-full md:w-1/3 lg:w-1/4 flex flex-col items-center justify-end p-3 md:p-4 rounded-t-lg border-2 border-b-0",
                        currentHeight,
                        podiumStyle.border,
                        podiumStyle.bg,
                        "transition-all duration-300 ease-out transform hover:scale-105"
                      )}
                    >
                      <HeroIcon className={cn("h-6 w-6 md:h-8 md:w-8 mb-1 md:mb-2", podiumStyle.text)} />
                      <p className={cn("font-bold text-sm md:text-base text-center", podiumStyle.text)}>{heroStat.name}</p>
                      <p className={cn("text-xs md:text-sm text-center", podiumStyle.text, "opacity-80")}>
                        {heroStat.gamesPlayed} Game{heroStat.gamesPlayed !== 1 ? 's' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">No hero play stats available for this team yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Clock className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl text-primary">Avg. Match Duration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
            <div className="relative w-40 h-40 md:w-48 md:h-48 mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="45" stroke="hsl(var(--border))" strokeWidth="3" fill="hsl(var(--card))" />
                {Array.from({ length: 12 }).map((_, i) => (
                  <line
                    key={`hour-marker-${i}`}
                    x1="50"
                    y1="10"
                    x2="50"
                    y2="15"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="2"
                    transform={`rotate(${i * 30} 50 50)`}
                  />
                ))}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="20"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{ transformOrigin: '50% 50%', transform: `rotate(${minuteHandAngle}deg)` }}
                />
                <circle cx="50" cy="50" r="3" fill="hsl(var(--primary))" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{avgMatchDurationMinutes} min</p>
          </CardContent>
        </Card>

        {performanceStats.map((stat) => (
          <Card key={stat.label} className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <stat.icon className="h-6 w-6 text-accent" />
              <CardTitle className="text-xl text-primary">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
              {stat.type === 'progress' && typeof stat.rawValue === 'number' && typeof stat.maxValue === 'number' && stat.maxValue > 0 ? (
                <>
                  <p className="text-3xl font-bold text-foreground mb-2">{stat.value}</p>
                  <Progress
                    value={
                      stat.label === "Avg. Deaths / Game"
                        ? Math.min(100, Math.max(0, (stat.maxValue / (stat.rawValue || 1)) * 100))
                        : Math.min(100, Math.max(0, (stat.rawValue / stat.maxValue) * 100))
                    }
                    className="w-3/4 h-2.5"
                    aria-label={`${stat.label} progress`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    League avg: {stat.leagueAvg} | Best: {stat.bestValue}
                  </p>
                  {stat.rank && <p className="text-xs text-muted-foreground mt-2">Rank: {stat.rank}</p>}
                </>
              ) : (
                <p className="text-4xl font-bold text-foreground pt-4">{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Performance Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* GPM Card */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Coins className="h-6 w-6 text-yellow-400" />
            <CardTitle className="text-lg text-primary">Avg. GPM</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
            <p className="text-3xl font-bold text-foreground">{team.averageGpm?.toFixed(0) ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">Gold Per Minute</p>
          </CardContent>
        </Card>

        {/* XPM Card */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            <CardTitle className="text-lg text-primary">Avg. XPM</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
            <p className="text-3xl font-bold text-foreground">{team.averageXpm?.toFixed(0) ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">Experience Per Minute</p>
          </CardContent>
        </Card>

        {/* Last Hits Card */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Pickaxe className="h-6 w-6 text-green-400" />
            <CardTitle className="text-lg text-primary">Avg. Last Hits</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
            <p className="text-3xl font-bold text-foreground">{team.averageLastHits?.toFixed(0) ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">Creep Kills</p>
          </CardContent>
        </Card>

        {/* Net Worth Card */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <CardTitle className="text-lg text-primary">Avg. Net Worth</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
            <p className="text-3xl font-bold text-foreground">{team.averageNetWorth ? formatNumber(team.averageNetWorth) : 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Gold Value</p>
          </CardContent>
        </Card>

        {/* Hero Damage Card */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Target className="h-6 w-6 text-red-400" />
            <CardTitle className="text-lg text-primary">Avg. Hero Damage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
            <p className="text-3xl font-bold text-foreground">{team.averageHeroDamage ? formatNumber(team.averageHeroDamage) : 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">Damage to Heroes</p>
          </CardContent>
        </Card>

        {/* Tower Damage Card */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Zap className="h-6 w-6 text-orange-400" />
            <CardTitle className="text-lg text-primary">Avg. Tower Damage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
            <p className="text-3xl font-bold text-foreground">{team.averageTowerDamage ? formatNumber(team.averageTowerDamage) : 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">Damage to Buildings</p>
          </CardContent>
        </Card>

        {/* Hero Healing Card */}
        <Card className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
            <Heart className="h-6 w-6 text-pink-400" />
            <CardTitle className="text-lg text-primary">Avg. Healing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
            <p className="text-3xl font-bold text-foreground">{team.averageHeroHealing ? formatNumber(team.averageHeroHealing) : 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">Hero Healing Done</p>
          </CardContent>
        </Card>
      </div>


      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Match History</CardTitle>
          <CardDescription>Results of all matches played by {team.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMatches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opponent</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMatches.map((match) => {
                  const opponent = match.teamA.id === team.id ? match.teamB : match.teamA;
                  const isWin = (match.teamA.id === team.id && (match.teamA.score ?? 0) > (match.teamB.score ?? 0)) ||
                                (match.teamB.id === team.id && (match.teamB.score ?? 0) > (match.teamA.score ?? 0));
                  const resultText = isWin ? "Win" : "Loss";
                  const scoreText = `${match.teamA.score} - ${match.teamB.score}`;
                  const date = match.dateTime ? new Date(match.dateTime) : new Date(match.defaultMatchTime);
                  return (
                    <TableRow key={match.id}>
                      <TableCell>
                        <Link href={`/teams/${opponent.id}`} className="hover:text-primary font-medium">{opponent.name}</Link>
                      </TableCell>
                      <TableCell className={cn(isWin ? "text-green-400" : "text-red-400", "font-semibold")}>
                        {resultText}
                      </TableCell>
                      <TableCell>{scoreText}</TableCell>
                      <TableCell>{date.toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No match history available for this team yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
}
function InfoItem({ icon: Icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-center text-md p-3 bg-muted/20 rounded-md">
      <Icon className="h-5 w-5 mr-3 text-primary" />
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="ml-auto font-semibold text-foreground">{value}</span>
    </div>
  )
}


interface PlayerCardProps {
  player: Player;
  teamId: string;
}

function PlayerCard({ player, teamId }: PlayerCardProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors">
      <div className="flex items-center space-x-3">
        <PlayerAvatar player={player} />
        <div>
          <Link href={`/teams/${teamId}/players/${player.id}`} className="font-semibold text-foreground hover:text-primary">{player.nickname}</Link>
          <p className="text-xs text-muted-foreground">MMR: {player.mmr}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/teams/${teamId}/players/${player.id}`}>
          View Stats <ExternalLink className="ml-2 h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}


export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const team = await getTeamById(resolvedParams.teamId);
  if (!team) {
    return { title: "Team Not Found" };
  }
  return {
    title: `${team.name} | Teams | Tournament Tracker`,
    description: `Profile and statistics for team ${team.name}.`
  };
}

export async function generateStaticParams() {
  const teams = await getAllTeams();
  return teams.map((team) => ({
    teamId: team.id,
  }));
}
