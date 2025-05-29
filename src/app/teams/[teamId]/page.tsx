
import { mockTeams, mockMatches } from "@/lib/mock-data";
import type { Team, Player, Match, TournamentStatus, HeroPlayStats } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import Link from "next/link";
import { Users, ListChecks, ExternalLink, BarChart3, Medal, Swords, UserCheck, UserX, ShieldQuestion, PlayCircle, Sigma, Trophy, Sparkles, Anchor, Sword as SwordIconLucide, Zap as ZapIcon, Ghost, Ban, MountainSnow, Flame, Snowflake, Axe as AxeIcon, Target, Moon, Copy as CopyIcon, ShieldOff, Waves, ShieldAlert, Trees, Bone, CloudLightning, UserCircle2, Clock, Percent, Skull, Ratio, Handshake, Award } from "lucide-react";
import type { Icon as LucideIconType } from "lucide-react";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";

interface TeamPageParams {
  params: { teamId: string };
}

async function getTeamData(teamId: string): Promise<{ team: Team | undefined, teamMatches: Match[] }> {
  const team = mockTeams.find(t => t.id === teamId);
  if (!team) return { team: undefined, teamMatches: [] };

  const teamMatches = mockMatches.filter(m => m.teamA.id === teamId || m.teamB.id === teamId);
  return { team, teamMatches };
}

const getStatusBadgeClasses = (status: TournamentStatus) => {
  switch (status) {
    case "Not Verified":
      return "bg-gray-500/20 text-gray-300 border-gray-500/40 hover:bg-gray-500/30";
    case "Active":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "Eliminated":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/80";
    case "Champions":
      return "bg-yellow-400/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-400/30";
    default:
      return "border-transparent bg-gray-500 text-gray-100";
  }
};

const getStatusIcon = (status: TournamentStatus) => {
  switch (status) {
    case "Not Verified":
      return <ShieldQuestion className="h-4 w-4 mr-1.5" />;
    case "Active":
      return <PlayCircle className="h-4 w-4 mr-1.5" />;
    case "Eliminated":
      return <UserX className="h-4 w-4 mr-1.5" />;
    case "Champions":
      return <Trophy className="h-4 w-4 mr-1.5" />;
    default:
      return null;
  }
}

const heroIconMap: Record<string, LucideIconType> = {
  'Invoker': Sparkles,
  'Pudge': Anchor,
  'Juggernaut': SwordIconLucide,
  'Lion': ZapIcon,
  'Shadow Fiend': Ghost,
  'Anti-Mage': Ban,
  'Phantom Assassin': Swords,
  'Earthshaker': MountainSnow,
  'Lina': Flame,
  'Crystal Maiden': Snowflake,
  'Axe': AxeIcon,
  'Drow Ranger': Target,
  'Mirana': Moon,
  'Rubick': CopyIcon,
  'Templar Assassin': ShieldOff,
  'Slark': Waves,
  'Sven': ShieldAlert,
  'Tiny': Trees,
  'Witch Doctor': Bone,
  'Zeus': CloudLightning,
};

const podiumColors = [
  { border: 'border-chart-1', text: 'text-chart-1', bg: 'bg-chart-1/10' }, // 1st place (e.g., pink)
  { border: 'border-chart-2', text: 'text-chart-2', bg: 'bg-chart-2/10' }, // 2nd place (e.g., cyan)
  { border: 'border-chart-3', text: 'text-chart-3', bg: 'bg-chart-3/10' }, // 3rd place (e.g., gold/yellow)
];


export default async function TeamPage({ params }: TeamPageParams) {
  const { team, teamMatches } = await getTeamData(params.teamId);

  if (!team) {
    notFound();
  }

  const totalMMR = team.players.reduce((sum, player) => sum + player.mmr, 0);
  const sortedHeroes = team.mostPlayedHeroes ? [...team.mostPlayedHeroes].sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 3) : [];

  const performanceStats = [
    { label: "Avg. Match Duration", value: `${team.averageMatchDurationMinutes ?? 'N/A'} min`, icon: Clock },
    { label: "Avg. Kills / Game", value: team.averageKillsPerGame ?? 'N/A', icon: Swords },
    { label: "Avg. Deaths / Game", value: team.averageDeathsPerGame ?? 'N/A', icon: Skull },
    { label: "Avg. Assists / Game", value: team.averageAssistsPerGame ?? 'N/A', icon: Handshake },
    { label: "Avg. Fantasy Points", value: team.averageFantasyPoints?.toFixed(1) ?? 'N/A', icon: Award }
  ];

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
            <Image
              src={team.logoUrl || `https://placehold.co/128x128.png?text=${team.name.charAt(0)}`}
              alt={`${team.name} logo`}
              width={128}
              height={128}
              className="rounded-xl border-4 border-card object-cover shadow-md"
              data-ai-hint="team logo"
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
        <CardContent className="p-6 md:p-8 grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
             <InfoItem icon={Medal} label="Points" value={team.points ?? 0} />
             <InfoItem icon={ListChecks} label="Matches Played" value={team.matchesPlayed ?? 0} />
             <InfoItem icon={BarChart3} label="Wins / Losses" value={`${team.matchesWon ?? 0}W / ${team.matchesLost ?? 0}L`} />
             <InfoItem icon={Sigma} label="Total MMR" value={totalMMR.toLocaleString()} />
          </div>
          <div className="md:col-span-2">
            <h3 className="text-2xl font-semibold mb-4 flex items-center text-foreground">
              <Users className="h-6 w-6 mr-2 text-primary" /> Player Roster
            </h3>
            <div className="space-y-3">
              {team.players.map((player) => (
                <PlayerCard key={player.id} player={player} teamId={team.id} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {sortedHeroes && sortedHeroes.length > 0 && (
        <Card className="shadow-xl md:w-1/2 mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center justify-center">
              <Trophy className="h-6 w-6 mr-2" /> {team.name}'s Top Heroes
            </CardTitle>
            <CardDescription className="text-center">Top {Math.min(sortedHeroes.length, 3)} most played heroes by the team.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            {sortedHeroes.length > 0 ? (
              <div className="flex flex-col md:flex-row justify-around items-end gap-4 md:gap-2 py-4 min-h-[200px] md:min-h-[250px]">
                {[sortedHeroes[1], sortedHeroes[0], sortedHeroes[2]].map((heroStat, index) => {
                  if (!heroStat) return <div key={`placeholder-${index}`} className="w-full md:w-1/3 lg:w-1/4"></div>; 

                  const podiumOrderIndex = index === 0 ? 1 : (index === 1 ? 0 : 2); 
                  const podiumStyle = podiumColors[podiumOrderIndex];
                  const heightClasses = [ 
                    "h-[90%] md:h-[220px]", 
                    "h-[75%] md:h-[180px]", 
                    "h-[60%] md:h-[140px]", 
                  ];
                  const currentHeight = heightClasses[podiumOrderIndex];
                  const HeroIcon = heroIconMap[heroStat.name] || UserCircle2;

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
                      <HeroIcon className={cn("h-8 w-8 md:h-10 md:w-10 mb-1 md:mb-2", podiumStyle.text)} />
                      <p className={cn("font-bold text-base md:text-lg text-center", podiumStyle.text)}>{heroStat.name}</p>
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
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {performanceStats.map((stat) => (
          <Card key={stat.label} className="shadow-xl text-center hover:bg-muted/10 transition-colors duration-200">
            <CardHeader className="items-center pb-2">
              <stat.icon className="h-10 w-10 text-accent mb-2" />
              <CardTitle className="text-xl font-semibold text-primary">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>


      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Match History</CardTitle>
          <CardDescription>Results of all matches played by {team.name}. (Data from OpenDota API - simulated)</CardDescription>
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
                  const isWin = (match.teamA.id === team.id && (match.teamAScore ?? 0) > (match.teamBScore ?? 0)) ||
                                (match.teamB.id === team.id && (match.teamBScore ?? 0) > (match.teamAScore ?? 0));
                  const resultText = match.status === 'completed' ? (isWin ? "Win" : "Loss") : "Upcoming";
                  const scoreText = match.status === 'completed' ? `${match.teamAScore} - ${match.teamBScore}` : "-";
                  return (
                    <TableRow key={match.id}>
                      <TableCell>
                        <Link href={`/teams/${opponent.id}`} className="hover:text-primary font-medium">{opponent.name}</Link>
                      </TableCell>
                      <TableCell className={cn(match.status === 'completed' ? (isWin ? "text-green-400" : "text-red-400") : "", "font-semibold")}>
                        {resultText}
                      </TableCell>
                      <TableCell>{scoreText}</TableCell>
                      <TableCell>{new Date(match.dateTime).toLocaleDateString()}</TableCell>
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
        <Avatar>
          <AvatarImage src={player.profileScreenshotUrl || `https://placehold.co/40x40.png?text=${player.nickname.charAt(0)}`} alt={player.nickname} data-ai-hint="gaming avatar" />
          <AvatarFallback>{player.nickname.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
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


export async function generateMetadata({ params }: TeamPageParams) {
  const team = mockTeams.find(t => t.id === params.teamId);
  if (!team) {
    return { title: "Team Not Found" };
  }
  return {
    title: `${team.name} | Teams | Tournament Tracker`,
    description: `Profile and statistics for team ${team.name}.`
  };
}

export async function generateStaticParams() {
  return mockTeams.map(team => ({
    teamId: team.id,
  }));
}

