
import { mockPlayers, mockTeams, mockMatches, defaultHeroNames as heroNamesList } from "@/lib/mock-data";
import type { Player, Team, Match, PlayerPerformanceInMatch } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, BarChartHorizontalBig, Star, TrendingUp, Shield, BarChart3, 
  UserCheck, UserX, ShieldQuestion, PlayCircle, Trophy, Swords, Skull, Coins, 
  Zap, Axe as AxeIconLucide, Target, Wallet, ListChecks, Puzzle, Handshake, Home,
  Anchor, Flame, Snowflake, MountainSnow, Ghost, Ban, Moon,
  Copy as CopyIconLucide, ShieldOff, Waves, ShieldAlert, Trees, Bone, CloudLightning, Sparkles
} from "lucide-react";
import type { Icon as LucideIconType } from "lucide-react";
import Image from "next/image";
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
  player: Player | undefined;
  team: Team | undefined;
  playerMatchHistory: PlayerMatchHistoryItem[];
}

interface PlayerMatchHistoryItem {
  matchId: string;
  opponentTeam: { id: string; name: string; logoUrl?: string };
  playerPerformance: PlayerPerformanceInMatch;
  result: 'Win' | 'Loss' | 'Ongoing';
  matchDate: Date;
  openDotaMatchUrl?: string;
}

// Replicated heroIconMap from team page for consistency
const heroIconMap: Record<string, LucideIconType> = {
  'Invoker': Sparkles,
  'Pudge': Anchor,
  'Juggernaut': Swords, // Assuming Swords is imported if SwordIconLucide was an alias
  'Lion': Zap, // Assuming Zap is imported if ZapIcon was an alias
  'Shadow Fiend': Ghost,
  'Anti-Mage': Ban,
  'Phantom Assassin': Swords,
  'Earthshaker': MountainSnow,
  'Lina': Flame,
  'Crystal Maiden': Snowflake,
  'Axe': AxeIconLucide,
  'Drow Ranger': Target,
  'Mirana': Moon,
  'Rubick': CopyIconLucide,
  'Templar Assassin': ShieldOff,
  'Slark': Waves,
  'Sven': ShieldAlert,
  'Tiny': Trees,
  'Witch Doctor': Bone,
  'Zeus': CloudLightning,
  'Windranger': Puzzle, // Added as example
  'Storm Spirit': Puzzle, // Added as example
  'Faceless Void': Puzzle, // Added as example
  'Spectre': Puzzle, // Added as example
  'Bristleback': Puzzle, // Added as example
  'Default': Puzzle,
};


async function getPlayerData(teamId: string, playerId: string): Promise<PlayerData> {
  const team = mockTeams.find(t => t.id === teamId);
  // Player IDs in mockTeams are like "p1-t1", "p2-t1". The playerId param is "p1".
  // We need to find the player whose base ID matches.
  const playerBaseId = playerId;
  const player = team?.players.find(p => p.id.startsWith(playerBaseId + '-'));


  if (!player || !team) {
    return { player: undefined, team: undefined, playerMatchHistory: [] };
  }

  const playerMatchHistory: PlayerMatchHistoryItem[] = [];
  mockMatches.forEach(match => {
    if (match.status === 'completed' && match.performances && (match.teamA.id === team.id || match.teamB.id === team.id)) {
      // Match performances use player IDs like "p1-t1", so we use player.id directly
      const performance = match.performances.find(p => p.playerId === player.id);
      if (performance) {
        const opponentTeam = match.teamA.id === team.id ? match.teamB : match.teamA;
        let result: PlayerMatchHistoryItem['result'] = 'Ongoing';
        if (typeof match.teamAScore === 'number' && typeof match.teamBScore === 'number') {
          let playerTeamWon = false;
          if (match.teamA.id === team.id) { 
            playerTeamWon = match.teamAScore > match.teamBScore;
          } else if (match.teamB.id === team.id) { 
             playerTeamWon = match.teamBScore > match.teamAScore;
          }
          result = playerTeamWon ? 'Win' : 'Loss';
        }
        
        playerMatchHistory.push({
          matchId: match.id,
          opponentTeam: { id: opponentTeam.id, name: opponentTeam.name, logoUrl: opponentTeam.logoUrl },
          playerPerformance: performance,
          result,
          matchDate: new Date(match.dateTime),
          openDotaMatchUrl: match.openDotaMatchUrl
        });
      }
    }
  });
  
  playerMatchHistory.sort((a, b) => b.matchDate.getTime() - a.matchDate.getTime());

  return { player, team, playerMatchHistory: playerMatchHistory.slice(0, 5) };
}


export default async function PlayerPage({ params }: PlayerPageParams) {
  const { player, team, playerMatchHistory } = await getPlayerData(params.teamId, params.playerId);

  if (!player || !team) {
    notFound();
  }

  const playerOverallStats = {
    kda: (Math.random() * 5 + 2).toFixed(2), 
    gpm: Math.floor(Math.random() * 300 + 400), 
    xpm: Math.floor(Math.random() * 300 + 450), 
    winRate: (Math.random() * 30 + 45).toFixed(1) + "%", 
    mostPlayedHero: heroNamesList[Math.floor(Math.random() * heroNamesList.length)], 
  };

  const avatarPlaceholder = `https://placehold.co/128x128.png?text=${player.nickname.substring(0, 2).toUpperCase()}`;

  const statIcons = {
    kda: ListChecks,
    gpm: Coins,
    xpm: Zap,
    fantasyPoints: Star,
    lastHits: AxeIconLucide,
    denies: Handshake,
    netWorth: Wallet,
    heroDamage: Target,
    towerDamage: Home,
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
            <Avatar className="h-32 w-32 border-4 border-card shadow-md">
              <AvatarImage src={avatarPlaceholder} alt={`${player.nickname} Steam avatar`} data-ai-hint="gaming avatar" />
              <AvatarFallback className="text-4xl">{player.nickname.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <CardTitle className="text-4xl font-bold text-primary">{player.nickname}</CardTitle>
              </div>
              <CardDescription className="text-lg mt-1">
                Member of <Link href={`/teams/${team.id}`} className="text-accent hover:underline font-medium">{team.name}</Link>
              </CardDescription>
              <div className="mt-3 flex space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={player.steamProfileUrl} target="_blank" rel="noopener noreferrer">
                    Steam Profile <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                {player.openDotaProfileUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={player.openDotaProfileUrl} target="_blank" rel="noopener noreferrer">
                      OpenDota <BarChart3 className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <h3 className="text-2xl font-semibold mb-6 text-foreground flex items-center">
            <BarChartHorizontalBig className="h-7 w-7 mr-3 text-primary" /> Overall Player Statistics (Simulated)
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatDisplayCard icon={Star} label="MMR" value={player.mmr.toString()} />
            <StatDisplayCard icon={TrendingUp} label="Overall KDA Ratio" value={playerOverallStats.kda} />
            <StatDisplayCard icon={Coins} label="Overall GPM" value={playerOverallStats.gpm.toString()} />
            <StatDisplayCard icon={Zap} label="Overall XPM" value={playerOverallStats.xpm.toString()} />
            <StatDisplayCard icon={Shield} label="Overall Win Rate" value={playerOverallStats.winRate} />
            <StatDisplayCard icon={Puzzle} label="Overall Most Played Hero" value={playerOverallStats.mostPlayedHero} />
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {player.profileScreenshotUrl && ( 
             <div className="space-y-2">
                <h4 className="text-xl font-semibold text-foreground">Profile Screenshot</h4>
                <Image 
                    src={player.profileScreenshotUrl} 
                    alt={`${player.nickname} profile screenshot`}
                    width={600}
                    height={400}
                    className="rounded-md border object-contain aspect-[3/2]"
                    data-ai-hint="profile screenshot dota2"
                />
             </div>
           )}
            <div className="space-y-4">
              <h4 className="text-xl font-semibold text-foreground">Recent Match History</h4>
              {playerMatchHistory.length > 0 ? (
                playerMatchHistory.map(histItem => {
                  const HeroIconComponent = heroIconMap[histItem.playerPerformance.hero] || heroIconMap['Default'];
                  return (
                    <Card key={histItem.matchId} className="bg-muted/20 shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                           <CardTitle className="text-lg flex items-center flex-wrap">
                            {HeroIconComponent && <HeroIconComponent className="h-5 w-5 mr-1.5 text-primary shrink-0" />}
                            <span className="font-semibold text-foreground">{histItem.playerPerformance.hero}</span>
                            <span className="text-muted-foreground mx-1.5 font-normal">vs</span>
                            <Link href={`/teams/${histItem.opponentTeam.id}`} className="text-accent hover:underline">{histItem.opponentTeam.name}</Link>
                          </CardTitle>
                          <Badge variant={histItem.result === 'Win' ? 'secondary' : histItem.result === 'Loss' ? 'destructive' : 'outline'} className="ml-2 shrink-0">
                            {histItem.result}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-1">
                          {histItem.matchDate.toLocaleDateString()}
                          {histItem.openDotaMatchUrl && (
                            <Link href={histItem.openDotaMatchUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary/80 hover:text-primary text-xs">
                              (OpenDota)
                            </Link>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                         <Table className="text-xs">
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium p-1.5"><statIcons.kda className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />K/D/A</TableCell>
                              <TableCell className="text-right p-1.5">{histItem.playerPerformance.kills}/{histItem.playerPerformance.deaths}/{histItem.playerPerformance.assists}</TableCell>
                              <TableCell className="font-medium p-1.5"><statIcons.gpm className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />GPM</TableCell>
                              <TableCell className="text-right p-1.5">{histItem.playerPerformance.gpm}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium p-1.5"><statIcons.xpm className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />XPM</TableCell>
                              <TableCell className="text-right p-1.5">{histItem.playerPerformance.xpm}</TableCell>
                               <TableCell className="font-medium p-1.5"><statIcons.fantasyPoints className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />Fantasy Pts</TableCell>
                              <TableCell className="text-right p-1.5">{histItem.playerPerformance.fantasyPoints}</TableCell>
                            </TableRow>
                             <TableRow>
                              <TableCell className="font-medium p-1.5"><statIcons.lastHits className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />LH/DN</TableCell>
                              <TableCell className="text-right p-1.5">{histItem.playerPerformance.lastHits}/{histItem.playerPerformance.denies}</TableCell>
                               <TableCell className="font-medium p-1.5"><statIcons.netWorth className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />Net Worth</TableCell>
                              <TableCell className="text-right p-1.5">{(histItem.playerPerformance.netWorth / 1000).toFixed(1)}k</TableCell>
                            </TableRow>
                            <TableRow>
                               <TableCell className="font-medium p-1.5"><statIcons.heroDamage className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />Hero Dmg</TableCell>
                              <TableCell className="text-right p-1.5">{(histItem.playerPerformance.heroDamage / 1000).toFixed(1)}k</TableCell>
                              <TableCell className="font-medium p-1.5"><statIcons.towerDamage className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />Tower Dmg</TableCell>
                              <TableCell className="text-right p-1.5">{(histItem.playerPerformance.towerDamage / 1000).toFixed(1)}k</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <p className="text-muted-foreground text-center py-4">No recent match performance data available.</p>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center mt-8">
            Note: Overall player statistics and match performance data are simulated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatDisplayCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function StatDisplayCard({ icon: Icon, label, value }: StatDisplayCardProps) {
  return (
    <Card className="bg-muted/20 p-4 shadow-sm">
      <div className="flex items-center mb-1">
        <Icon className="h-5 w-5 mr-2 text-primary" />
        <CardDescription className="text-sm font-medium">{label}</CardDescription>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </Card>
  );
}

export async function generateMetadata({ params }: PlayerPageParams) {
  const { player, team } = await getPlayerData(params.teamId, params.playerId);
  if (!player) {
    return { title: "Player Not Found" };
  }
  return {
    title: `${player.nickname} | ${team?.name || 'Team'} | Tournament Tracker`,
    description: `Statistics and profile for player ${player.nickname}.`
  };
}

export async function generateStaticParams() {
  const params: { teamId: string; playerId: string }[] = [];
  mockTeams.forEach(team => {
    team.players.forEach(player => {
      // Construct player ID to match format "pX-tY"
      params.push({ teamId: team.id, playerId: player.id.split('-')[0] }); // Use base player ID for route
    });
  });
  // Deduplicate params in case a player base ID is associated with multiple teams in a complex scenario
  // (though not the case with current mock data generation)
  return Array.from(new Set(params.map(p => JSON.stringify(p)))).map(s => JSON.parse(s));
}

    