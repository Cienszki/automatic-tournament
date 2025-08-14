"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Match, Team, Standin } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { format, isAfter } from "date-fns";
import { Calendar as CalendarIcon, Check, X, Send, AlertTriangle, Clock } from "lucide-react";
import { useTime } from "@/context/TimeContext";
import { proposeMatchTime, acceptMatchTime, rejectMatchTime, cancelProposal, cancelStandinRequest } from "@/lib/team-actions";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CopyToClipboard } from "@/components/app/CopyToClipboard";
import { StandinInfoDisplay } from "../StandinInfoDisplay";

interface SchedulingCardProps {
  match: Match;
  teamId: string;
  captainId: string;
  teams?: Team[];
  standins?: Standin[];
}

export function SchedulingCard({ match, teamId, captainId, teams = [], standins = [] }: SchedulingCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { simulatedTime } = useTime();
  const router = useRouter();

  const [optimisticMatch, setOptimisticMatch] = React.useState(match);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    setOptimisticMatch(match);
  }, [match]);

  const opponent = optimisticMatch.teamA.id === teamId ? optimisticMatch.teamB : optimisticMatch.teamA;
  const isProposer = optimisticMatch.proposedById === teamId;
  
  const deadline = new Date(optimisticMatch.scheduled_for || 0);
  const now = simulatedTime || new Date();
  const isDeadlinePassed = now > deadline;

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
  
  const isComposedDateInvalid = composedDate ? isAfter(composedDate, deadline) : false;

  const handleAction = async (
    action: (token: string, matchId: string, ...args: any[]) => Promise<any>,
    optimisticUpdate: Partial<Match>,
    ...args: any[]
  ) => {
    if (!user) {
        toast({ title: t("teams.notAuthenticated"), description: t("teams.mustSignIn"), variant: "destructive"});
        return;
    }
    
    const previousMatch = optimisticMatch;
    setIsSubmitting(true);
    setOptimisticMatch(prev => ({ ...prev, ...optimisticUpdate }));

    try {
        const token = await user.getIdToken();
        const result = await action(token, optimisticMatch.id, ...args);
        if (result.success) {
            toast({ title: t("teams.success"), description: result.message });
            router.refresh(); 
        } else {
            toast({ title: t("teams.actionFailed"), description: result.message, variant: "destructive" });
            setOptimisticMatch(previousMatch);
        }
    } catch (error) {
        toast({ title: t("teams.unexpectedError"), description: (error as Error).message, variant: "destructive" });
        setOptimisticMatch(previousMatch);
    }
    setIsSubmitting(false);
  };
  
  const handlePropose = () => {
    if (composedDate && !isComposedDateInvalid) {
      const optimisticUpdate: Partial<Match> = {
        schedulingStatus: 'proposed',
        proposedTime: composedDate.toISOString(),
        proposingCaptainId: captainId,
        proposedById: teamId,
      };
      handleAction(proposeMatchTime, optimisticUpdate, composedDate);
      setIsCalendarOpen(false);
    } else {
        toast({ title: t("teams.invalidTime"), description: t("teams.cannotProposeAfterDeadline"), variant: "destructive"});
    }
  };

  const handleAccept = () => {
    if (!optimisticMatch.proposedTime) return;
     if (isAfter(new Date(optimisticMatch.proposedTime), deadline)) {
        toast({ title: t("teams.invalidTime"), description: t("teams.cannotAcceptPastDeadline"), variant: "destructive"});
        return;
    }
    const optimisticUpdate: Partial<Match> = {
      schedulingStatus: 'confirmed',
      status: 'scheduled',
      dateTime: optimisticMatch.proposedTime,
      proposedTime: undefined,
      proposingCaptainId: undefined,
      proposedById: undefined,
    };
    handleAction(acceptMatchTime, optimisticUpdate);
  };
  
  const handleReject = () => {
    const optimisticUpdate: Partial<Match> = {
      schedulingStatus: 'unscheduled',
      status: 'scheduled',
      proposedTime: undefined,
      proposingCaptainId: undefined,
      proposedById: undefined,
    };
    handleAction(rejectMatchTime, optimisticUpdate);
  };

  const handleCancel = () => {
    const optimisticUpdate: Partial<Match> = {
      schedulingStatus: 'unscheduled',
      status: 'scheduled',
      proposedTime: undefined,
      proposingCaptainId: undefined,
      proposedById: undefined,
    };
    handleAction(cancelProposal, optimisticUpdate);
  };
  
  const isUrgent = now.getTime() > deadline.getTime() - 48 * 60 * 60 * 1000 && !isDeadlinePassed;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>{t("teams.scheduleVs")} {opponent.name}</CardTitle>
        <CardDescription>
          {t("teams.roundDeadline")}: {format(deadline, "PPP 'at' HH:mm")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {isUrgent && !officialTime && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md flex items-center text-yellow-300">
                <AlertTriangle className="h-5 w-5 mr-3" />
                <p className="text-sm font-medium">{t("teams.deadlineApproaching")}</p>
            </div>
        )}

        {isDeadlinePassed && !officialTime && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md flex items-center text-red-300">
                <Clock className="h-5 w-5 mr-3" />
                <p className="text-sm font-medium">{t("teams.deadlinePassed")}</p>
            </div>
        )}
        
        {optimisticMatch.standinInfo && Object.keys(optimisticMatch.standinInfo).length > 0 && (
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-orange-300" />
                <span className="text-sm font-medium text-orange-300">{t("teams.standinsAssigned")}</span>
              </div>
              {optimisticMatch.standinInfo[teamId] && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!user) {
                      toast({
                        title: t('standins.notAuthenticated'),
                        description: t('standins.mustSignIn'),
                        variant: "destructive",
                      });
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      const token = await user.getIdToken();
                      const result = await cancelStandinRequest(token, optimisticMatch.id, teamId);
                      
                      if (result.success) {
                        // Update optimistic state to remove standin info
                        const updatedMatch = { ...optimisticMatch };
                        if (updatedMatch.standinInfo && updatedMatch.standinInfo[teamId]) {
                          delete updatedMatch.standinInfo[teamId];
                          // If no teams have standin info, remove the entire standinInfo
                          if (Object.keys(updatedMatch.standinInfo).length === 0) {
                            delete updatedMatch.standinInfo;
                          }
                        }
                        setOptimisticMatch(updatedMatch);
                        
                        toast({
                          title: t('standins.success'),
                          description: result.message,
                        });
                        // Also refresh to get updated data from server
                        router.refresh();
                      } else {
                        toast({
                          title: t('standins.error'), 
                          description: result.message,
                          variant: "destructive",
                        });
                      }
                    } catch (error) {
                      console.error("Error cancelling standin:", error);
                      toast({
                        title: t('standins.error'), 
                        description: t('standins.cancelStandinFailed'),
                        variant: "destructive",
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}
                  {t('standins.cancelStandin')}
                </Button>
              )}
            </div>
            <StandinInfoDisplay 
              match={optimisticMatch}
              teams={teams}
              standins={standins}
              size="sm"
            />
          </div>
        )}
        
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-sm font-semibold mb-1">{t("teams.officialMatchTime")}</p>
          {officialTime ? (
            <p className="text-lg font-bold text-primary">{format(officialTime, "PPPP 'at' HH:mm")}</p>
          ) : (
            <p className="text-muted-foreground italic">{t("teams.notYetScheduled")} {format(defaultTime, "PPP 'at' HH:mm")}</p>
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
                        {composedDate ? format(composedDate, "PPP 'at' HH:mm") : <span>{t("teams.pickDate")}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar 
                            mode="single" 
                            selected={selectedDate} 
                            onSelect={setSelectedDate} 
                            disabled={(date) => isAfter(date, deadline)}
                            initialFocus
                        />
                        <div className="p-4 border-t border-border">
                          <p className="text-sm font-medium mb-2">{t("teams.setTime")}</p>
                          <div className="flex items-center gap-2">
                            <Input type="number" value={hour} onChange={e => setHour(e.target.value)} min="0" max="23" className="w-16"/>
                            <span>:</span>
                            <Input type="number" value={minute} onChange={e => setMinute(e.target.value)} min="0" max="59" step="1" className="w-16"/>
                          </div>
                           <Button variant="outline" size="sm" onClick={() => setIsCalendarOpen(false)} className="w-full mt-4">{t("teams.done")}</Button>
                        </div>
                    </PopoverContent>
                 </Popover>
                 <Button onClick={handlePropose} disabled={!composedDate || isSubmitting || isComposedDateInvalid}>
                    {isSubmitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Send className="mr-2 h-4 w-4"/>}
                    {t("teams.proposeTime")}
                </Button>
              </div>
            )}
            {isComposedDateInvalid && (
                 <p className="text-xs text-destructive mt-2 text-center">{t("teams.selectedTimeAfterDeadline")}</p>
            )}

            {optimisticMatch.schedulingStatus === 'proposed' && proposedTime && (
              <>
                {isProposer && (
                  <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-md text-center space-y-3">
                    <p className="font-semibold">{t("teams.youProposedTime")}</p>
                    <p className="text-lg font-bold text-blue-300">{format(proposedTime, "PPPP 'at' HH:mm")}</p>
                    <p className="text-sm text-muted-foreground">{t("teams.waitingForResponse")} {opponent.name}.</p>
                    <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting} className="w-full mt-2">
                        {isSubmitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : t("teams.cancelProposal")}
                    </Button>
                  </div>
                )}
                {!isProposer && (
                  <div className="text-center p-4 border rounded-md">
                    <p className="font-semibold">{opponent.name} {t("teams.proposedNewTime")}</p>
                    <p className="text-lg font-bold text-primary my-2">{format(proposedTime, "PPPP 'at' HH:mm")}</p>
                     {isAfter(proposedTime, deadline) && (
                         <p className="text-sm text-destructive my-2">{t("teams.proposalInvalid")}</p>
                     )}
                    <div className="flex justify-center gap-2 mt-4">
                       <Button onClick={handleAccept} variant="secondary" className="bg-green-500 hover:bg-green-600" disabled={isSubmitting || isAfter(proposedTime, deadline)}>
                            {isSubmitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Check className="mr-2 h-4 w-4"/>}
                            {t("teams.accept")}
                        </Button>
                       <Button onClick={handleReject} variant="destructive" disabled={isSubmitting}>
                            {isSubmitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <X className="mr-2 h-4 w-4"/>}
                            {t("teams.reject")}
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
