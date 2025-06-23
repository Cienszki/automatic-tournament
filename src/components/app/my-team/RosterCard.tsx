'use client';

import * as React from "react";
import type { Player, PlayerRole } from "@/lib/definitions";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface RosterCardProps {
  players: Player[];
  teamId: string;
}

const roleIcons: Record<PlayerRole, React.ElementType> = {
  Carry: Swords,
  Mid: Sparkles,
  Offlane: Shield,
  "Soft Support": HandHelping,
  "Hard Support": Eye,
};

export function RosterCard({ players, teamId }: RosterCardProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const handleSubmitStandIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // In a real app, this would call a server action to save the request
    toast({
      title: "Stand-in Submitted",
      description: "Your request for a stand-in has been sent to the admins for approval.",
    });
    setOpen(false); // Close the dialog on submit
  };

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
          {players.map((player) => {
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
                     <Link href={`/teams/${teamId}/players/${basePlayerId}`} className="font-semibold hover:text-primary">
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
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Register a Stand-in</DialogTitle>
                <DialogDescription>
                  Submit a stand-in for admin approval. Remember to check the team MMR limit and tournament rules.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitStandIn}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="player-to-replace" className="text-right">
                      Replacing
                    </Label>
                    <Select required>
                      <SelectTrigger id="player-to-replace" className="col-span-3">
                        <SelectValue placeholder="Select a player..." />
                      </SelectTrigger>
                      <SelectContent>
                        {players.map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.nickname} ({player.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="standin-nickname" className="text-right">
                      Nickname
                    </Label>
                    <Input id="standin-nickname" placeholder="Stand-in's name" className="col-span-3" required/>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="standin-mmr" className="text-right">
                      MMR
                    </Label>
                    <Input id="standin-mmr" type="number" placeholder="e.g., 4500" className="col-span-3" required/>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="standin-steam" className="text-right">
                      Steam URL
                    </Label>
                    <Input id="standin-steam" type="url" placeholder="https://steamcommunity.com/..." className="col-span-3" required/>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Submit for Approval</Button>
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
