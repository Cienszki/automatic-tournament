"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, X, Send, AlertTriangle, Loader2, Clock } from "lucide-react";
import { useTime } from "@/context/TimeContext";
import { proposeMatchTime, acceptMatchTime, rejectMatchTime, cancelProposal } from "@/lib/team-actions";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CopyToClipboard } from "@/components/app/CopyToClipboard";

interface SchedulingCardProps {
  match: Match;
  teamId: string;
  captainId: string;
}

export function SchedulingCard({ match, teamId, captainId }: SchedulingCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { simulatedTime } = useTime();
  const router = useRouter();

  const [optimisticMatch, setOptimisticMatch] = React.useState(match);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    setOptimisticMatch(match);
  }, [match]);

  const opponent = optimisticMatch.teamA.id === teamId ? optimisticMatch.teamB : optimisticMatch.teamA;
  const isProposer = optimisticMatch.proposingCaptainId === captainId;

  const officialTime = optimisticMatch.dateTime ? new Date(optimisticMatch.dateTime) : null;
  const defaultTime = new Date(optimisticMatch.defaultMatchTime || 0);
  const proposedTime = optimisticMatch.proposedTime ? new Date(optimisticMatch.proposedTime) : null;

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(proposedTime || defaultTime || new Date());
  const [hour, setHour] = React.useState<string>(proposedTime ? format(proposedTime, "HH") : "18");
  const [minute, setMinute] = React.useState<string>(proposedTime ? format(proposedTime, "mm") : "00");

  const composedDate = React.useMemo(() => {
    if (!selectedDate) return undefined;
    const newDate = new Date(selectedDate);
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (!isNaN(h) && !isNaN(m)) {
        newDate.setHours(h, m, 0, 0);
    }
    return newDate;
  }, [selectedDate, hour, minute]);

  const handleAction = async (
    action: (token: string, matchId: string, ...args: any[]) => Promise<any>,
    optimisticUpdate: Partial<Match>,
    ...args: any[]
  ) => {
    if (!user) {
        toast({ title: "Not Authenticated", description: "You must be signed in.", variant: "destructive"});
        return;
    }
    
    const previousMatch = optimisticMatch;
    setIsSubmitting(true);
    setOptimisticMatch(prev => ({ ...prev, ...optimisticUpdate }));

    try {
        const token = await user.getIdToken();
        const result = await action(token, optimisticMatch.id, ...args);
        if (result.success) {
            toast({ title: "Success!", description: result.message });
            router.refresh(); 
        } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
            setOptimisticMatch(previousMatch);
        }
    } catch (error) {
        toast({ title: "An Unexpected Error Occurred", description: (error as Error).message, variant: "destructive" });
        setOptimisticMatch(previousMatch);
    }
    setIsSubmitting(false);
  };
  
  const handlePropose = () => {
    if (composedDate) {
      const optimisticUpdate: Partial<Match> = {
        schedulingStatus: 'proposed',
        proposedTime: composedDate.toISOString(),
        proposingCaptainId: captainId,
      };
      handleAction(proposeMatchTime, optimisticUpdate, composedDate);
      setIsCalendarOpen(false);
    }
  };

  const handleAccept = () => {
    if (!optimisticMatch.proposedTime) return;
    const optimisticUpdate: Partial<Match> = {
      schedulingStatus: 'scheduled',
      dateTime: optimisticMatch.proposedTime,
      proposedTime: null,
      proposingCaptainId: null,
    };
    handleAction(acceptMatchTime, optimisticUpdate);
  };
  
  const handleReject = () => {
    const optimisticUpdate: Partial<Match> = {
      schedulingStatus: 'unscheduled',
      proposedTime: null,
      proposingCaptainId: null,
    };
    handleAction(rejectMatchTime, optimisticUpdate);
  };

  const handleCancel = () => {
    const optimisticUpdate: Partial<Match> = {
      schedulingStatus: 'unscheduled',
      proposedTime: null,
      proposingCaptainId: null,
    };
    handleAction(cancelProposal, optimisticUpdate);
  };
  
  const deadline = new Date(optimisticMatch.scheduled_for || 0);
  const now = simulatedTime || new Date();
  const isDeadlinePassed = now > deadline;
  const isUrgent = now.getTime() > deadline.getTime() - 48 * 60 * 60 * 1000 && !isDeadlinePassed;

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

        {isDeadlinePassed && !officialTime && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md flex items-center text-red-300">
                <Clock className="h-5 w-5 mr-3" />
                <p className="text-sm font-medium">Deadline has passed</p>
            </div>
        )}
        
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-sm font-semibold mb-1">Official Match Time</p>
          {officialTime ? (
            <p className="text-lg font-bold text-primary">{format(officialTime, "PPPP 'at' HH:mm")}</p>
          ) : (
            <p className="text-muted-foreground italic">Not yet scheduled. Defaults to {format(defaultTime, "PPP 'at' HH:mm")}</p>
          )}
        </div>

        {!officialTime && !isDeadlinePassed && (
          <div>
            {optimisticMatch.schedulingStatus === 'unscheduled' && (
              <div className="flex flex-col sm:flex-row gap-2">
                 <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-grow justify-start font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {composedDate ? format(composedDate, "PPP 'at' HH:mm") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus/>
                        <div className="p-4 border-t border-border">
                          <p className="text-sm font-medium mb-2">Set Time (24h format)</p>
                          <div className="flex items-center gap-2">
                            <Input type="number" value={hour} onChange={e => setHour(e.target.value)} min="0" max="23" className="w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                            <span>:</span>
                            <Input type="number" value={minute} onChange={e => setMinute(e.target.value)} min="0" max="59" step="1" className="w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                          </div>
                           <Button variant="outline" size="sm" onClick={() => setIsCalendarOpen(false)} className="w-full mt-4">Done</Button>
                        </div>
                    </PopoverContent>
                 </Popover>
                 <Button onClick={handlePropose} disabled={!composedDate || isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                    Propose Time
                </Button>
              </div>
            )}

            {optimisticMatch.schedulingStatus === 'proposed' && proposedTime && (
              <>
                {isProposer && (
                  <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-md text-center space-y-3">
                    <p className="font-semibold">You proposed a new time!</p>
                    <p className="text-lg font-bold text-blue-300">{format(proposedTime, "PPPP 'at' HH:mm")}</p>
                    <p className="text-sm text-muted-foreground">Waiting for {opponent.name} to respond.</p>
                    <div className="pt-2">
                      <p className="text-xs text-left mb-1">You can copy this message to send to them:</p>
                      <div className="p-2 bg-black/30 rounded-md text-left text-sm mb-2">
                          <p>I've proposed a new match time for our game: <span className="font-semibold">{format(proposedTime, "PPP 'at' HH:mm")}</span>. Please accept or reject it in the tournament app.</p>
                      </div>
                      <CopyToClipboard textToCopy={`I've proposed a new match time for our game: ${format(proposedTime, "PPP 'at' HH:mm")}. Please accept or reject it in the tournament app.`} />
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting} className="w-full mt-2">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : "Cancel Proposal"}
                    </Button>
                  </div>
                )}
                {!isProposer && (
                  <div className="text-center p-4 border rounded-md">
                    <p className="font-semibold">{opponent.name} proposed a new time:</p>
                    <p className="text-lg font-bold text-primary my-2">{format(proposedTime, "PPPP 'at' HH:mm")}</p>
                    <div className="flex justify-center gap-2 mt-4">
                       <Button onClick={handleAccept} variant="secondary" className="bg-green-500 hover:bg-green-600" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                            Accept
                        </Button>
                       <Button onClick={handleReject} variant="destructive" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4"/>}
                            Reject
                        </Button>
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
