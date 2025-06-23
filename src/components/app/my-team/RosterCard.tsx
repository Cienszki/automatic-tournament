
'use client';

import * as React from "react";
import type { Player, PlayerRole, Team, Match, StandIn } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Shield, Swords, Sparkles, HandHelping, Eye, ListChecks, Edit, UserPlus, FileUp } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TEAM_MMR_CAP } from "@/lib/mock-data";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface RosterCardProps {
  team: Team;
  upcomingMatches: Match[];
}

const roleIcons: Record<PlayerRole, React.ElementType> = {
  Carry: Swords,
  Mid: Sparkles,
  Offlane: Shield,
  "Soft Support": HandHelping,
  "Hard Support": Eye,
};

export function RosterCard({ team, upcomingMatches }: RosterCardProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [selectedMatchId, setSelectedMatchId] = React.useState<string>("");
  const [actionType, setActionType] = React.useState<'existing' | 'new'>('existing');
  const [playerToReplaceId, setPlayerToReplaceId] = React.useState<string>("");
  const [selectedStandInId, setSelectedStandInId] = React.useState<string>("");
  const [newStandInMMR, setNewStandInMMR] = React.useState<string>("");
  const [newTotalMMR, setNewTotalMMR] = React.useState<number | null>(null);
  const [isOverBudget, setIsOverBudget] = React.useState(false);

  const approvedStandIns = team.standIns?.filter(s => s.status === 'approved') || [];

  React.useEffect(() => {
    if (!open) {
      setSelectedMatchId("");
      setActionType("existing");
      setPlayerToReplaceId("");
      setSelectedStandInId("");
      setNewStandInMMR("");
      setNewTotalMMR(null);
      setIsOverBudget(false);
    }
  }, [open]);

  React.useEffect(() => {
    const playerToReplace = team.players.find(p => p.id === playerToReplaceId);
    if (!playerToReplace) {
      setNewTotalMMR(null);
      setIsOverBudget(false);
      return;
    }

    const currentRosterWithoutPlayer = team.players.filter(p => p.id !== playerToReplaceId);
    const baseMMR = currentRosterWithoutPlayer.reduce((sum, p) => sum + p.mmr, 0);

    let standInMMR = 0;
    if (actionType === 'existing') {
      const standIn = approvedStandIns.find(s => s.id === selectedStandInId);
      standInMMR = standIn?.mmr || 0;
    } else {
      standInMMR = parseInt(newStandInMMR, 10) || 0;
    }

    if (standInMMR > 0) {
      const total = baseMMR + standInMMR;
      setNewTotalMMR(total);
      setIsOverBudget(total > TEAM_MMR_CAP);
    } else {
      setNewTotalMMR(null);
      setIsOverBudget(false);
    }
  }, [playerToReplaceId, selectedStandInId, newStandInMMR, actionType, team.players, approvedStandIns]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMatchId || !playerToReplaceId) {
      toast({ title: "Missing Information", description: "Please select a match and the player to replace.", variant: "destructive" });
      return;
    }
    if (actionType === 'existing' && !selectedStandInId) {
      toast({ title: "Missing Information", description: "Please select an existing stand-in.", variant: "destructive" });
      return;
    }
    if (isOverBudget) {
      toast({ title: "MMR Cap Exceeded", description: `The new team MMR would be ${newTotalMMR}, which is over the ${TEAM_MMR_CAP} limit.`, variant: "destructive" });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const standInNickname = actionType === 'existing' ? approvedStandIns.find(s => s.id === selectedStandInId)?.nickname : formData.get('standin-nickname');
    
    toast({
      title: "Stand-in Request Submitted",
      description: `${standInNickname} has been submitted for approval for your upcoming match.`,
    });
    setOpen(false);
  };
  
  const selectedMatchDetails = upcomingMatches.find(m => {
     const opponent = m.teamA.id === team.id ? m.teamB : m.teamA;
     return m.id === selectedMatchId;
  });

  return (
    <Card className="shadow-lg flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <User className="mr-2" />
          Player Roster
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-3">
          {team.players.map((player) => {
            const RoleIcon = roleIcons[player.role] || ListChecks;
            const basePlayerId = player.id.split('-t')[0];
            return (
              <li key={player.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${player.nickname.substring(0, 2)}`} alt={player.nickname} />
                    <AvatarFallback>{player.nickname.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                     <Link href={`/teams/${team.id}/players/${basePlayerId}`} className="font-semibold hover:text-primary">
                      {player.nickname}
                    </Link>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {player.role} - {player.mmr} MMR
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
       <CardFooter className="border-t pt-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                Manage Stand-ins
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Register a Stand-in</DialogTitle>
                <DialogDescription>
                  Submit a stand-in for admin approval. Remember to check the team MMR limit and tournament rules.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="match-select">1. Select Match</Label>
                   <Select onValueChange={setSelectedMatchId} value={selectedMatchId} name="match-id" required>
                      <SelectTrigger id="match-select">
                        <SelectValue placeholder="Select an upcoming match..." />
                      </SelectTrigger>
                      <SelectContent>
                        {upcomingMatches.map(match => {
                           const opponent = match.teamA.id === team.id ? match.teamB : match.teamA;
                           return <SelectItem key={match.id} value={match.id}>vs {opponent.name} ({match.round})</SelectItem>
                        })}
                      </SelectContent>
                  </Select>
                </div>
                
                {selectedMatchId && (
                  <>
                    <div className="space-y-2">
                      <Label>2. Stand-in Type</Label>
                      <RadioGroup defaultValue="existing" value={actionType} onValueChange={(val) => setActionType(val as 'existing' | 'new')} className="flex space-x-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="r-existing" />
                          <Label htmlFor="r-existing">Use Existing</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="r-new" />
                          <Label htmlFor="r-new">Register New</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="player-to-replace">3. Player to Replace</Label>
                       <Select onValueChange={setPlayerToReplaceId} value={playerToReplaceId} name="player-to-replace-id" required>
                          <SelectTrigger id="player-to-replace">
                            <SelectValue placeholder="Select roster player..." />
                          </SelectTrigger>
                          <SelectContent>
                            {team.players.map(player => <SelectItem key={player.id} value={player.id}>{player.nickname} ({player.role})</SelectItem>)}
                          </SelectContent>
                      </Select>
                    </div>

                    {actionType === 'existing' && (
                       <div className="space-y-2">
                          <Label htmlFor="existing-standin-select">4. Select Approved Stand-in</Label>
                           <Select onValueChange={setSelectedStandInId} value={selectedStandInId} name="existing-standin-id" required>
                              <SelectTrigger id="existing-standin-select">
                                <SelectValue placeholder="Select a stand-in..." />
                              </SelectTrigger>
                              <SelectContent>
                                {approvedStandIns.length > 0 ? (
                                  approvedStandIns.map(standIn => <SelectItem key={standIn.id} value={standIn.id}>{standIn.nickname} ({standIn.mmr} MMR)</SelectItem>)
                                ) : (
                                  <SelectItem value="none" disabled>No approved stand-ins.</SelectItem>
                                )}
                              </SelectContent>
                          </Select>
                       </div>
                    )}

                    {actionType === 'new' && (
                      <div className="space-y-4 pt-2 border-t mt-4">
                         <p className="text-sm font-medium">4. New Stand-in Details</p>
                         <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="standin-nickname" className="text-right">Nickname</Label>
                           <Input id="standin-nickname" name="standin-nickname" placeholder="Stand-in's name" className="col-span-3" required/>
                         </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="standin-mmr" className="text-right">MMR</Label>
                           <Input id="standin-mmr" name="standin-mmr" type="number" placeholder="e.g., 4500" className="col-span-3" value={newStandInMMR} onChange={e => setNewStandInMMR(e.target.value)} required/>
                         </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="standin-steam" className="text-right">Steam URL</Label>
                           <Input id="standin-steam" name="standin-steam-url" type="url" placeholder="https://steamcommunity.com/..." className="col-span-3" required/>
                         </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="standin-screenshot" className="text-right">Screenshot</Label>
                           <Input id="standin-screenshot" name="standin-screenshot" type="file" className="col-span-3" required/>
                         </div>
                      </div>
                    )}
                    
                    {newTotalMMR && (
                      <div className={cn(
                        "p-2 rounded-md text-center text-sm",
                        isOverBudget ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400"
                      )}>
                        New Team MMR: <span className="font-bold">{newTotalMMR.toLocaleString()}</span> / {TEAM_MMR_CAP.toLocaleString()}
                        {isOverBudget && <p className="text-xs font-bold">Warning: Exceeds MMR cap!</p>}
                      </div>
                    )}
                  </>
                )}

                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={!selectedMatchId || !playerToReplaceId || isOverBudget}>Submit for Approval</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => alert("Edit team details UI (simulated)")}>
            <Edit className="h-4 w-4" />
          </Button>
      </CardFooter>
    </Card>
  );
}
