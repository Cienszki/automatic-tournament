
'use client';

import * as React from "react";
import type { Player, PlayerRole, Team, Match } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Shield, Swords, Sparkles, HandHelping, Eye, ListChecks, Edit, UserPlus } from "lucide-react";
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
import { TEAM_MMR_CAP } from "@/lib/definitions";
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
      // Reset state when dialog closes
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

    const baseMMR = team.players.filter(p => p.id !== playerToReplaceId).reduce((sum, p) => sum + p.mmr, 0);
    let standInMMR = 0;

    if (actionType === 'existing') {
      const standIn = approvedStandIns.find(s => s.id === selectedStandInId);
      standInMMR = standIn?.mmr || 0;
    } else {
      standInMMR = parseInt(newStandInMMR, 10) || 0;
    }

    const total = baseMMR + standInMMR;
    setNewTotalMMR(total);
    setIsOverBudget(total > TEAM_MMR_CAP);
  }, [playerToReplaceId, selectedStandInId, newStandInMMR, actionType, team.players, approvedStandIns]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({ title: "Stand-in request submitted (Simulated)" });
    setOpen(false);
  };

  return (
    <Card className="shadow-lg flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-primary"><User className="mr-2" />Player Roster</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-3">
          {team.players.map((player) => {
            const RoleIcon = roleIcons[player.role] || ListChecks;
            return (
              <li key={player.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10"><AvatarImage src={`https://placehold.co/40x40.png?text=${player.nickname.substring(0, 2)}`} /><AvatarFallback>{player.nickname.substring(0, 2)}</AvatarFallback></Avatar>
                  <div>
                     <Link href={`/teams/${team.id}/players/${player.id}`} className="font-semibold hover:text-primary">{player.nickname}</Link>
                    <div className="flex items-center text-xs text-muted-foreground"><RoleIcon className="h-3 w-3 mr-1" />{player.role} - {player.mmr} MMR</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
       <CardFooter className="border-t pt-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline" className="w-full"><UserPlus className="mr-2 h-4 w-4" />Manage Stand-ins</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register a Stand-in</DialogTitle><DialogDescription>Submit a stand-in for admin approval.</DialogDescription></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>1. Select Match</Label><Select onValueChange={setSelectedMatchId} required><SelectTrigger><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{upcomingMatches.map(m => <SelectItem key={m.id} value={m.id}>vs {m.teamA.id === team.id ? m.teamB.name : m.teamA.name}</SelectItem>)}</SelectContent></Select></div>
                {selectedMatchId && (<>
                  <div className="space-y-2"><Label>2. Stand-in Type</Label><RadioGroup value={actionType} onValueChange={(v) => setActionType(v as any)}><div className="flex items-center space-x-2"><RadioGroupItem value="existing" id="r-ex"/><Label htmlFor="r-ex">Use Existing</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="new" id="r-new"/><Label htmlFor="r-new">Register New</Label></div></RadioGroup></div>
                  <div className="space-y-2"><Label>3. Player to Replace</Label><Select onValueChange={setPlayerToReplaceId} required><SelectTrigger><SelectValue placeholder="..."/></SelectTrigger><SelectContent>{team.players.map(p => <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>)}</SelectContent></Select></div>
                  {actionType === 'existing' && <div className="space-y-2"><Label>4. Select Stand-in</Label><Select onValueChange={setSelectedStandInId} required><SelectTrigger><SelectValue placeholder="..."/></SelectTrigger><SelectContent>{approvedStandIns.map(s => <SelectItem key={s.id} value={s.id}>{s.nickname} ({s.mmr} MMR)</SelectItem>)}</SelectContent></Select></div>}
                  {actionType === 'new' && <div className="space-y-2 border-t pt-4"><p>4. New Stand-in Details</p><Input placeholder="Nickname" required/><Input type="number" placeholder="MMR" value={newStandInMMR} onChange={(e) => setNewStandInMMR(e.target.value)} required/><Input placeholder="Steam URL" type="url" required/><Input type="file" required/></div>}
                  {newTotalMMR && <div className={cn("p-2 text-center", isOverBudget ? "bg-destructive/20 text-destructive" : "bg-green-500/20")}>New MMR: {newTotalMMR} / {TEAM_MMR_CAP}</div>}
                </>)}
                <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" disabled={isOverBudget}>Submit</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => alert("Edit team details UI (simulated)")}><Edit className="h-4 w-4" /></Button>
      </CardFooter>
    </Card>
  );
}
