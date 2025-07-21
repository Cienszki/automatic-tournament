"use client";

import * as React from "react";
import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, Check, X, Send, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTime } from "@/context/TimeContext";
// Assume these actions will be created
// import { proposeMatchTime, acceptMatchTime, rejectMatchTime, cancelProposal } from "@/lib/team-actions";

interface SchedulingCardProps {
  match: Match;
  teamId: string;
  captainId: string;
}

export function SchedulingCard({ match, teamId, captainId }: SchedulingCardProps) {
  const { simulatedTime } = useTime();
  const [proposedDate, setProposedDate] = React.useState<Date | undefined>();
  const opponent = match.teamA.id === teamId ? match.teamB : match.teamA;
  const isProposer = match.proposingCaptainId === captainId;
  const isOpponent = !isProposer;

  const handlePropose = async () => {
    if (!proposedDate) return;
    // await proposeMatchTime(match.documentId, proposedDate);
  };
  const handleAccept = async () => { /* await acceptMatchTime(match.documentId); */ };
  const handleReject = async () => { /* await rejectMatchTime(match.documentId); */ };
  const handleCancel = async () => { /* await cancelProposal(match.documentId); */ };
  
  const deadline = new Date(match.roundDeadline);
  const timeDiff = deadline.getTime() - simulatedTime.getTime();
  const isUrgent = timeDiff < 48 * 60 * 60 * 1000; // Less than 48 hours

  const getOfficialTime = () => {
    if (match.schedulingStatus === 'scheduled' && match.dateTime) return new Date(match.dateTime);
    if (simulatedTime > deadline) return new Date(match.defaultMatchTime);
    return null;
  };
  const officialTime = getOfficialTime();

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Schedule vs. {opponent.name}</CardTitle>
        <CardDescription>
          Round Deadline: {format(deadline, "PPP 'at' HH:mm")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {isUrgent && !officialTime && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md flex items-center text-yellow-300">
                <AlertTriangle className="h-5 w-5 mr-3" />
                <p className="text-sm font-medium">Deadline approaching! Agree on a time to avoid the default.</p>
            </div>
        )}
        
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-sm font-semibold mb-1">Official Match Time</p>
          {officialTime ? (
            <p className="text-lg font-bold text-primary">{format(officialTime, "PPPP 'at' HH:mm")}</p>
          ) : (
            <p className="text-muted-foreground italic">Not yet scheduled. Defaults to {format(new Date(match.defaultMatchTime), "PPP 'at' HH:mm")}</p>
          )}
        </div>

        {!officialTime && (
          <div>
            {match.schedulingStatus === 'unscheduled' && (
              <div className="flex flex-col sm:flex-row gap-2">
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-grow">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {proposedDate ? format(proposedDate, "PPP") : "Select Date & Time"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent><Calendar mode="single" selected={proposedDate} onSelect={setProposedDate} /></PopoverContent>
                 </Popover>
                 <Button onClick={handlePropose} disabled={!proposedDate}><Send className="mr-2 h-4 w-4"/>Propose Time</Button>
              </div>
            )}

            {match.schedulingStatus === 'proposed' && (
              <>
                {isProposer && (
                  <div className="text-center p-3 border rounded-md">
                    <p>You proposed {format(new Date(match.proposedTime!), "PPP 'at' HH:mm")}. Waiting for response.</p>
                    <Button variant="link" onClick={handleCancel}>Cancel Proposal</Button>
                  </div>
                )}
                {isOpponent && (
                  <div className="text-center p-3 border rounded-md">
                    <p>{opponent.name} proposed {format(new Date(match.proposedTime!), "PPP 'at' HH:mm")}.</p>
                    <div className="flex justify-center gap-2 mt-2">
                       <Button onClick={handleAccept} variant="secondary"><Check className="mr-2 h-4 w-4"/>Accept</Button>
                       <Button onClick={handleReject} variant="destructive"><X className="mr-2 h-4 w-4"/>Reject</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
