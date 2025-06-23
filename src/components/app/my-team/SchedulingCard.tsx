
"use client";

import * as React from "react";
import type { Match, Team } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarClock, ExternalLink, Send } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Input } from "@/components/ui/input";

interface SchedulingCardProps {
  nextMatch: Match | undefined;
  team: Team;
}

export function SchedulingCard({ nextMatch, team }: SchedulingCardProps) {
  const { toast } = useToast();
  const [date, setDate] = React.useState<Date | undefined>();
  const [time, setTime] = React.useState<string>("20:00");

  const opponent = nextMatch?.teamA.id === team.id ? nextMatch?.teamB : nextMatch?.teamA;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date for the match.",
        variant: "destructive",
      });
      return;
    }

    const proposedDateTime = new Date(date);
    const [hours, minutes] = time.split(":").map(Number);
    proposedDateTime.setHours(hours, minutes);

    toast({
      title: "Proposal Sent!",
      description: `You proposed to play against ${opponent?.name} on ${format(
        proposedDateTime,
        "PPP 'at' HH:mm"
      )}.`,
    });
  };

  if (!nextMatch || !opponent) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <CalendarClock className="mr-2" />
            Upcoming Match
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>No upcoming matches scheduled.</p>
          <p className="text-xs mt-2">Check back after the next round is drawn.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-primary">
          <div className="flex items-center">
            <CalendarClock className="mr-2" />
            Upcoming Match
          </div>
          <Link href={`/teams/${opponent.id}`} passHref>
             <Button variant="ghost" size="sm">Scout <ExternalLink className="h-4 w-4 ml-2" /></Button>
          </Link>
        </CardTitle>
        <CardDescription>
          Your next opponent is <strong className="text-accent">{opponent.name}</strong> for{" "}
          {nextMatch.round || "the next round"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Propose a time to play. If both captains agree on the same time, the match
            will be scheduled.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full sm:w-auto"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
             <Button type="submit" className="w-full sm:flex-1 bg-accent hover:bg-accent/90">
                <Send className="mr-2 h-4 w-4" />
                Propose Time
            </Button>
            <Button type="button" disabled className="w-full sm:flex-1">
              Confirm Match (Disabled)
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
