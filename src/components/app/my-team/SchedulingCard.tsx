
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
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";

interface SchedulingCardProps {
  upcomingMatches: Match[];
  team: Team;
}

export function SchedulingCard({ upcomingMatches, team }: SchedulingCardProps) {
  const { toast } = useToast();
  const [selectedOpponentId, setSelectedOpponentId] = React.useState<string>("");
  const [date, setDate] = React.useState<Date | undefined>();
  const [hour, setHour] = React.useState<string>("20");
  const [minute, setMinute] = React.useState<string>("00");

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
    proposedDateTime.setHours(parseInt(hour), parseInt(minute));

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
      <Card>
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

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  return (
    <Card>
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

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {date ? `${format(date, "PPP")} at ${hour}:${minute}` : <span>Pick a date and time</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <DayPickerCalendar
                mode="single"
                selected={date}
                onSelect={setDate}
              />
              <div className="p-2 border-t flex items-center justify-center space-x-2">
                <Select value={hour} onValueChange={setHour}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span>:</span>
                <Select value={minute} onValueChange={setMinute}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button type="submit" className="w-full bg-accent hover:bg-accent/90">
              <Send className="mr-2 h-4 w-4" />
              Propose Time
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
