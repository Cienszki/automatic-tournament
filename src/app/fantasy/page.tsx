
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Crown, Info, UserCircle, BarChart2, Swords, Sparkles, Shield as ShieldIconLucide, HandHelping, Eye as EyeIconLucide, Lock, Unlock } from "lucide-react";
import type { Player, PlayerRole, FantasyLeagueParticipant, FantasyLineup, Team } from "@/lib/definitions";
import { PlayerRoles } from "@/lib/definitions"; // Corrected import
import { mockAllTournamentPlayersFlat, mockFantasyLeagueParticipants, FANTASY_BUDGET_MMR, mockTeams } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const roleIcons: Record<PlayerRole, React.ElementType> = {
  Carry: Swords,
  Mid: Sparkles,
  Offlane: ShieldIconLucide,
  "Soft Support": HandHelping,
  "Hard Support": EyeIconLucide,
};

const SIMULATED_CURRENT_USER_ID = mockFantasyLeagueParticipants[2]?.id || "user-fallback";

export default function FantasyLeaguePage() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [selectedLineup, setSelectedLineup] = React.useState<FantasyLineup>({});
  const [currentBudgetUsed, setCurrentBudgetUsed] = React.useState(0);
  const [availablePlayers, setAvailablePlayers] = React.useState<Player[]>([]);
  const [fantasyLeaderboard, setFantasyLeaderboard] = React.useState<FantasyLeagueParticipant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLineupLockDeadlinePassed, setIsLineupLockDeadlinePassed] = React.useState(false);

  React.useEffect(() => {
    setAvailablePlayers(mockAllTournamentPlayersFlat);
    setFantasyLeaderboard(mockFantasyLeagueParticipants.sort((a,b) => b.totalFantasyPoints - a.totalFantasyPoints).map((p,i) => ({...p, rank: i+1})));
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    const cost = Object.values(selectedLineup).reduce((sum, player) => sum + (player ? player.mmr : 0), 0);
    setCurrentBudgetUsed(cost);
  }, [selectedLineup]);

  const handlePlayerSelect = (role: PlayerRole, playerId: string) => {
    const playerToSelect = availablePlayers.find(p => p.id === playerId);
    if (!playerToSelect) return;

    const currentLineup = { ...selectedLineup };
    const existingPlayerInRole = currentLineup[role];
    let tempBudget = currentBudgetUsed;

    if (existingPlayerInRole) { 
      tempBudget -= existingPlayerInRole.mmr;
    }
    tempBudget += playerToSelect.mmr;

    if (tempBudget > FANTASY_BUDGET_MMR && playerToSelect.id !== existingPlayerInRole?.id) {
      alert(`Selecting this player exceeds the budget of ${FANTASY_BUDGET_MMR.toLocaleString()} MMR.`);
      return;
    }

    const isAlreadySelectedElsewhere = Object.entries(currentLineup).some(
      ([r, p]) => r !== role && p?.id === playerToSelect.id
    );

    if (isAlreadySelectedElsewhere) {
      alert("This player is already selected in another role. Please choose a different player.");
      return;
    }
    
    currentLineup[role] = playerToSelect;
    setSelectedLineup(currentLineup);
  };
  
  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedLineup({});
  };

  const handleConfirmLineup = () => {
    const rolesFilledCount = Object.values(selectedLineup).filter(p => p).length;
    if (rolesFilledCount !== PlayerRoles.length) {
      alert("Please select a player for every role.");
      return;
    }
    if (currentBudgetUsed > FANTASY_BUDGET_MMR) {
      alert("Your lineup exceeds the budget. Please make adjustments.");
      return;
    }
    alert("Lineup confirmed (simulated)! In a real app, this would be saved to a database.");
  };

  const budgetPercentage = Math.min(100, (currentBudgetUsed / FANTASY_BUDGET_MMR) * 100);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-xl mt-4">Loading Fantasy League...</p>
      </div>
    );
  }

  const getPlayerTeamName = (playerId: string): string => {
    const teamIdSuffix = playerId.split('-t')[1];
    if (!teamIdSuffix) return 'N/A';
    const teamId = `team${teamIdSuffix}`;
    const team = mockTeams.find(t => t.id === teamId);
    return team?.name || 'N/A';
  };

  const toggleDeadlineState = () => {
    setIsLineupLockDeadlinePassed(prevState => !prevState);
  };

  const deadlineButtonText = isLineupLockDeadlinePassed 
    ? "Simulate Before Deadline (Show Hidden Lineups)" 
    : "Simulate Deadline Passed (Reveal Current Lineups)";
  
  const leaderboardColumnHeaderText = isLineupLockDeadlinePassed
    ? "Current Round Lineup"
    : "Lineup (Hidden Until Deadline)";

  return (
    <div className="space-y-12">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/liga_fantasy.png)` }} 
          data-ai-hint="neon fantasy space"
        />
        
        <div className="relative z-10">
            <Crown className="h-16 w-16 mx-auto text-primary mb-4" />
            <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
              Fantasy League
            </h2>
            <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
              Assemble your dream team, manage your budget, and climb the ranks!
            </p>
        </div>
      </Card>

      {!isLoggedIn ? (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-accent">Join the Fantasy League!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4 text-muted-foreground">Login with Discord to create your team and compete.</p>
            <Button onClick={handleLogin} size="lg" className="bg-[#5865F2] text-white hover:bg-[#4752C4] hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M19.54 0c1.356 0 2.46 1.104 2.46 2.472v21.528l-2.58-2.28-1.452-1.344-1.536-1.428.636 2.22h-13.62c-1.356 0-2.46-1.104-2.46-2.472v-16.224c0-1.368 1.104-2.472 2.46-2.472h16.08zm-4.632 15.672c2.652-.084 3.672-1.824 3.672-1.824 0-3.864-1.728-6.996-1.728-6.996-1.728-1.296-3.372-1.26-3.372-1.26l-.168.192c2.04.624 2.988 1.524 2.988 1.524-2.256-.816-4.008-1.524-5.964-1.524-1.956 0-3.708.708-5.964 1.524 0 0 .948-.9 2.988-1.524l-.168-.192c0 0-1.644-.036-3.372 1.26 0 0-1.728 3.132-1.728 6.996 0 0 1.02 1.74 3.672 1.824 0 0 .864-.276 1.68-.924-1.608.972-3.12 1.956-3.12 1.956l1.224 1.056s1.38-.348 2.808-.936c.912.42 1.872.576 2.784.576.912 0 1.872-.156 2.784-.576 1.428.588 2.808.936 2.808.936l1.224-1.056s-1.512-.984-3.12-1.956c.816.648 1.68.924 1.68.924zm-6.552-5.616c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332.012-.732-.54-1.332-1.224-1.332zm4.38 0c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332s-.54-1.332-1.224-1.332z"/></svg>
              Login with Discord (Simulated)
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <Button onClick={toggleDeadlineState} variant="outline" className="mb-6">
              {isLineupLockDeadlinePassed ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
              {deadlineButtonText}
            </Button>
            <Button onClick={handleLogout} variant="outline" className="mb-6">Logout (Simulated)</Button>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-accent flex items-center">
                <Info className="h-6 w-6 mr-2" />How to Play
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full" defaultValue="rules-1">
                <AccordionItem value="rules-1">
                  <AccordionTrigger>1. Assemble Your Team</AccordionTrigger>
                  <AccordionContent>
                    Select one player for each of the 5 Dota 2 roles: Carry, Mid, Offlane, Soft Support, and Hard Support.
                    Choose your players from the pool of all registered tournament participants.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="rules-2">
                  <AccordionTrigger>2. Manage Your Budget</AccordionTrigger>
                  <AccordionContent>
                    You have a total budget of <strong>{FANTASY_BUDGET_MMR.toLocaleString()} MMR</strong> to spend on your 5 players.
                    Each player's "cost" is equal to their tournament-registered MMR. Your total team cost cannot exceed the budget.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="rules-3">
                  <AccordionTrigger>3. Player Lock-in Periods</AccordionTrigger>
                  <AccordionContent>
                    Your lineup must be set before the Group Stage begins.
                    You can change your lineup after the Group Stage is complete, and then again after each round of the Play-offs.
                    Lock-in deadlines will be announced by the administrators. 
                    Before a lock-in deadline, other participants' lineups are hidden. After the deadline, current lineups are visible.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="rules-4">
                  <AccordionTrigger>4. Scoring</AccordionTrigger>
                  <AccordionContent>
                    Your fantasy score is the sum of the fantasy points earned by your 5 selected players in their official tournament matches.
                    For Best-of-3 (BO3) matches during the Play-offs, only the fantasy points from the player's <strong>two best games</strong> in that series will count towards your total. (This is a rule, actual scoring calculation may be simplified in this demo).
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-accent flex items-center">
                <UserCircle className="h-6 w-6 mr-2" />Build Your Fantasy Team
              </CardTitle>
              <CardDescription>
                Select one player for each role. Total cost must not exceed {FANTASY_BUDGET_MMR.toLocaleString()} MMR.
                Your lineup can only be confirmed before the lineup lock deadline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="budget" className="text-lg font-semibold text-foreground">
                    Budget Used:
                  </Label>
                  <div className={cn("text-lg font-bold", currentBudgetUsed > FANTASY_BUDGET_MMR ? 'text-destructive' : 'text-primary')}>
                    {currentBudgetUsed.toLocaleString()} / {FANTASY_BUDGET_MMR.toLocaleString()} MMR
                  </div>
                </div>
                <Progress value={budgetPercentage} className="h-3" 
                    indicatorClassName={cn(currentBudgetUsed > FANTASY_BUDGET_MMR ? "bg-destructive" : "bg-primary")} />
                {currentBudgetUsed > FANTASY_BUDGET_MMR && (
                    <p className="text-destructive text-sm mt-1 text-right">Budget exceeded!</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PlayerRoles.map((role) => {
                  const RoleIcon = roleIcons[role];
                  const playersForThisRole = availablePlayers.filter(p => p.role === role);
                  const selectedPlayerForRole = selectedLineup[role];

                  return (
                    <Card key={role} className="shadow-md flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-xl text-primary">
                          <RoleIcon className="h-5 w-5 mr-2" /> {role}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-x-4 items-center flex-grow px-4 py-3">
                        <div>
                          {selectedPlayerForRole ? (
                            <div className="p-3 border rounded-md bg-card flex items-center space-x-3 min-h-[76px]">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={selectedPlayerForRole.profileScreenshotUrl || `https://placehold.co/40x40.png?text=${selectedPlayerForRole.nickname.charAt(0)}`} />
                                <AvatarFallback>{selectedPlayerForRole.nickname.substring(0,1)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-foreground truncate" title={selectedPlayerForRole.nickname}>{selectedPlayerForRole.nickname}</p>
                                <p className="text-xs text-muted-foreground">Cost: {selectedPlayerForRole.mmr.toLocaleString()} MMR</p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 border rounded-md bg-muted/20 text-center h-full flex items-center justify-center min-h-[76px]">
                              <p className="text-sm text-muted-foreground italic">No player selected</p>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <Select
                            value={selectedPlayerForRole?.id || ""}
                            onValueChange={(playerId) => { if(playerId && playerId !== "--select--") {handlePlayerSelect(role, playerId)}}}
                            disabled={isLineupLockDeadlinePassed}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select Player..." />
                            </SelectTrigger>
                            <SelectContent position="popper" className="max-h-[300px]">
                              <SelectItem value="--select--" disabled>-- Select a Player --</SelectItem>
                              {playersForThisRole.sort((a,b) => a.nickname.localeCompare(b.nickname)).map(player => {
                                const isCurrentlySelectedInThisRole = selectedPlayerForRole?.id === player.id;
                                const isSelectedElsewhere = Object.entries(selectedLineup).some(
                                  ([r, p]) => r !== role && p?.id === player.id
                                );
                                
                                let costIfSelected = currentBudgetUsed;
                                const currentPlayerInThisRole = selectedLineup[role]; 

                                if(currentPlayerInThisRole && player.id !== currentPlayerInThisRole.id){
                                  costIfSelected = (currentBudgetUsed - currentPlayerInThisRole.mmr) + player.mmr;
                                } else if (!currentPlayerInThisRole) {
                                  costIfSelected = currentBudgetUsed + player.mmr;
                                }
                                
                                const wouldExceedBudget = costIfSelected > FANTASY_BUDGET_MMR;
                                const isDisabled = isSelectedElsewhere || (!isCurrentlySelectedInThisRole && wouldExceedBudget);

                                return (
                                  <SelectItem key={player.id} value={player.id} disabled={isDisabled}>
                                    <div className="flex justify-between w-full items-center">
                                      <span>{player.nickname}</span>
                                      <span className={cn("text-xs ml-2", 
                                        isDisabled && !isCurrentlySelectedInThisRole && wouldExceedBudget ? "text-destructive" : "text-muted-foreground",
                                        isSelectedElsewhere ? "text-amber-500" : ""
                                      )}>
                                        {player.mmr.toLocaleString()} MMR
                                        {isSelectedElsewhere && " (Picked)"}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleConfirmLineup} 
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" 
                size="lg"
                disabled={isLineupLockDeadlinePassed || Object.values(selectedLineup).filter(p => p).length !== PlayerRoles.length || currentBudgetUsed > FANTASY_BUDGET_MMR}
              >
                {isLineupLockDeadlinePassed ? <Lock className="mr-2 h-5 w-5" /> : null}
                {isLineupLockDeadlinePassed ? "Lineup Locked" : "Confirm Lineup"}
              </Button>
            </CardFooter>
          </Card>
        </>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-accent flex items-center">
            <BarChart2 className="h-6 w-6 mr-2" />Fantasy League Standings
          </CardTitle>
          <CardDescription>Current standings in the Fantasy League. (Simulated data)</CardDescription>
        </CardHeader>
        <CardContent>
          {fantasyLeaderboard.length === 0 ? (
            <p className="text-muted-foreground text-center">No participants yet. Be the first!</p>
          ) : (
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-center">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="min-w-[250px]">{leaderboardColumnHeaderText}</TableHead>
                    <TableHead className="text-right">Fantasy Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fantasyLeaderboard.map((participant) => {
                    const lineupToDisplay = participant.selectedLineup; // Always refers to current lineup data from participant
                    const showLineupDetails = isLineupLockDeadlinePassed && lineupToDisplay && Object.keys(lineupToDisplay).length > 0;

                    return (
                    <TableRow key={participant.id} className={cn(participant.id === SIMULATED_CURRENT_USER_ID && "bg-primary/10 ring-1 ring-primary")}>
                      <TableCell className="font-medium text-center">{participant.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={participant.avatarUrl} alt={participant.discordUsername} />
                            <AvatarFallback>{participant.discordUsername.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{participant.discordUsername} {participant.id === SIMULATED_CURRENT_USER_ID && "(You)"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isLineupLockDeadlinePassed ? (
                          showLineupDetails ? (
                            <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
                              {PlayerRoles.map(role => {
                                const player = lineupToDisplay?.[role];
                                const RoleIcon = roleIcons[role];
                                const playerIdParts = player?.id?.split('-t');
                                const basePlayerId = playerIdParts?.[0];
                                const teamIdSuffix = playerIdParts?.[1];
                                const teamIdForLink = teamIdSuffix ? `team${teamIdSuffix}` : '';

                                return (
                                  <div key={role} className="flex items-center space-x-1.5 text-xs">
                                    <RoleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    {player ? (
                                      basePlayerId && teamIdForLink ? (
                                        <Link href={`/teams/${teamIdForLink}/players/${basePlayerId}`} className="text-primary hover:underline truncate" title={player.nickname}>
                                          {player.nickname}
                                        </Link>
                                      ) : (
                                        <span className="text-foreground truncate" title={player.nickname}>{player.nickname}</span>
                                      )
                                    ) : (
                                      <span className="text-muted-foreground italic">-</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <em className="text-xs text-muted-foreground">
                              No lineup set for current round.
                            </em>
                          )
                        ) : (
                          <em className="text-xs text-muted-foreground">
                            Lineup hidden until deadline.
                          </em>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">{participant.totalFantasyPoints.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                 })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="mt-12 space-y-8">
        <h2 className="text-3xl font-bold text-center text-primary mb-6">Top Tournament Player Fantasy Points by Role</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PlayerRoles.map((role) => {
            const RoleIcon = roleIcons[role];
            const topPlayersForRole = mockAllTournamentPlayersFlat
              .filter(p => p.role === role)
              .sort((a, b) => (b.fantasyPointsEarned || 0) - (a.fantasyPointsEarned || 0))
              .slice(0, 5);

            return (
              <Card key={role} className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl text-accent flex items-center">
                    <RoleIcon className="h-6 w-6 mr-2" /> Top {role} Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topPlayersForRole.length === 0 ? (
                     <p className="text-muted-foreground text-center">No player data for this role yet.</p>
                  ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">FP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPlayersForRole.map((player, index) => {
                        const playerIdParts = player.id.split('-t');
                        const basePlayerId = playerIdParts[0]; 
                        const teamIdSuffix = playerIdParts[1]; 
                        const teamIdForLink = teamIdSuffix ? `team${teamIdSuffix}` : ''; 
                        const teamName = getPlayerTeamName(player.id);

                        return (
                          <TableRow key={player.id}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={player.profileScreenshotUrl || `https://placehold.co/24x24.png?text=${player.nickname.charAt(0)}`} alt={player.nickname} />
                                  <AvatarFallback>{player.nickname.substring(0,1)}</AvatarFallback>
                                </Avatar>
                                {teamIdForLink && basePlayerId ? (
                                  <Link href={`/teams/${teamIdForLink}/players/${basePlayerId}`} className="text-sm font-medium text-primary hover:underline truncate" title={player.nickname}>
                                    {player.nickname}
                                  </Link>
                                ) : (
                                  <span className="text-sm font-medium text-foreground truncate" title={player.nickname}>{player.nickname}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate" title={teamName}>
                              {teamIdForLink ? (
                                <Link href={`/teams/${teamIdForLink}`} className="hover:text-accent hover:underline">
                                  {teamName}
                                </Link>
                              ) : (
                                teamName
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">{player.fantasyPointsEarned?.toLocaleString() || 0}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center mt-8">
        Note: Fantasy League data is simulated for demonstration purposes. Scoring and player availability will update based on tournament progression.
      </p>
    </div>
  );
}
