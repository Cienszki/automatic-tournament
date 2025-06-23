
"use client";

import * as React from "react";
import type { Match, Team } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarClock, Send } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";

interface SchedulingCardProps {
  upcomingMatches: Match[];
  team: Team;
}

export function SchedulingCard({ upcomingMatches, team }: SchedulingCardProps) {
  const { toast } = useToast();
  const [selectedOpponentId, setSelectedOpponentId] = React.useState<string>("");
  const [date, setDate] = React.useState<Date | undefined>();
  const [time, setTime] = React.useState<string>("20:00");

  // Find the selected opponent's details from the full match object
  const selectedMatch = upcomingMatches.find(m => {
    const opponent = m.teamA.id === team.id ? m.teamB : m.teamA;
    return opponent.id === selectedOpponentId;
  });
  const opponent = selectedMatch ? (selectedMatch.teamA.id === team.id ? selectedMatch.teamB : selectedMatch.teamA) : undefined;
  
  const potentialOpponents = upcomingMatches.map(m => m.teamA.id === team.id ? m.teamB : m.teamA);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOpponentId) {
      toast({
        title: "Error",
        description: "Please select an opponent.",
        variant: "destructive",
      });
      return;
    }

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

  if (!upcomingMatches || upcomingMatches.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <CalendarClock className="mr-2" />
            Schedule Match
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>No upcoming matches to schedule.</p>
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
            Schedule Match
          </div>
        </CardTitle>
        <CardDescription>
          Propose a time to play your next match. A match is confirmed when both captains propose the same date and time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">

          <Select onValueChange={setSelectedOpponentId} value={selectedOpponentId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select opponent..." />
            </SelectTrigger>
            <SelectContent>
              {potentialOpponents.map(opp => (
                <SelectItem key={opp.id} value={opp.id}>
                  {opp.name} (Round: {upcomingMatches.find(m => m.teamA.id === opp.id || m.teamB.id === opp.id)?.round || 'N/A'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
                <DayPickerCalendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
