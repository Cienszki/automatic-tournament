
import { mockTeams, mockMatches, mockPlayers } from "@/lib/mock-data";
import type { Team, Player, Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import Link from "next/link";
import { Shield, Users, ListChecks, ExternalLink, BarChart3, Medal, Swords } from "lucide-react";
import { notFound } from "next/navigation";

interface TeamPageParams {
  params: { teamId: string };
}

async function getTeamData(teamId: string): Promise<{ team: Team | undefined, teamMatches: Match[] }> {
  const team = mockTeams.find(t => t.id === teamId);
  if (!team) return { team: undefined, teamMatches: [] };

  // Assign full player details if not already present (mock data specific)
  const detailedPlayers = team.players.map(pStub => {
    const generalPlayerInfo = mockPlayers.find(mp => mp.id.startsWith(pStub.id.split('-')[0])); // basic match for general info
    return generalPlayerInfo ? { ...generalPlayerInfo, ...pStub } : pStub; // pStub has the unique ID and team-specific MMR if different
  });
  team.players = detailedPlayers;

  const teamMatches = mockMatches.filter(m => m.teamA.id === teamId || m.teamB.id === teamId);
  return { team, teamMatches };
}

export default async function TeamPage({ params }: TeamPageParams) {
  const { team, teamMatches } = await getTeamData(params.teamId);

  if (!team) {
    notFound();
  }

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
            <div>
              <CardTitle className="text-4xl font-bold text-primary flex items-center">
                <Shield className="h-10 w-10 mr-3 opacity-80" /> {team.name}
              </CardTitle>
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

      {team.mostPlayedHeroes && team.mostPlayedHeroes.length > 0 && (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center">
              <Swords className="h-6 w-6 mr-2" /> Team Signature Heroes
            </CardTitle>
            <CardDescription>The team's most frequently played heroes. (Simulated Data)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {team.mostPlayedHeroes.map((heroName, index) => (
                <Badge key={index} variant="secondary" className="text-base px-3 py-1">
                  {heroName}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                      <TableCell className={isWin && match.status === 'completed' ? "text-green-600 font-semibold" : match.status === 'completed' ? "text-red-600 font-semibold" : ""}>
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
          <AvatarImage src={`https://placehold.co/40x40.png?text=${player.nickname.charAt(0)}`} alt={player.nickname} data-ai-hint="gaming avatar" />
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
  // In a real app, fetch all team IDs
  return mockTeams.map(team => ({
    teamId: team.id,
  }));
}

