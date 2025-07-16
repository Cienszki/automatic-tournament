"use client";

import React, { useState, useEffect } from 'react';
import { getTournamentStatus, updateTournamentStatus, TournamentStatus } from '@/lib/admin';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, ShieldEllipsis, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const stageConfig: Record<string, { title: string; description: string; nextStage: string; buttonText: string }> = {
    'pre_season': {
        title: 'Pre-Season / Registration Open',
        description: 'Teams can register, and fantasy lineups are being set for the pre-season.',
        nextStage: 'group_stage',
        buttonText: 'Start Group Stage',
    },
    'group_stage': {
        title: 'Group Stage',
        description: 'The group stage is currently active. Team registrations are closed.',
        nextStage: 'playoffs_r1',
        buttonText: 'Start Playoffs',
    },
    'playoffs_r1': {
        title: 'Playoffs - Round 1',
        description: 'The first round of playoffs is underway.',
        nextStage: 'playoffs_r2',
        buttonText: 'Advance to Round 2',
    },
    'playoffs_r2': {
        title: 'Playoffs - Round 2',
        description: 'The second round of playoffs is underway.',
        nextStage: 'playoffs_r3',
        buttonText: 'Advance to Round 3',
    },
    'playoffs_r3': {
        title: 'Playoffs - Round 3',
        description: 'The third round of playoffs is underway.',
        nextStage: 'tournament_end',
        buttonText: 'End Tournament',
    },
    'tournament_end': {
        title: 'Tournament Ended',
        description: 'The tournament has concluded. No further actions can be taken.',
        nextStage: '',
        buttonText: '',
    },
};

export default function ManageTournamentPage() {
    const [status, setStatus] = useState<TournamentStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        async function fetchStatus() {
            setIsLoading(true);
            const currentStatus = await getTournamentStatus();
            setStatus(currentStatus);
            setIsLoading(false);
        }
        fetchStatus();
    }, []);

    const handleAdvanceStage = async () => {
        if (!status || !stageConfig[status.roundId]?.nextStage) return;

        setIsUpdating(true);
        const nextStageId = stageConfig[status.roundId].nextStage;

        try {
            await updateTournamentStatus({ roundId: nextStageId });
            setStatus({ roundId: nextStageId });
            toast({
                title: 'Success!',
                description: `Tournament has been advanced to: ${stageConfig[nextStageId].title}`,
            });
        } catch (error) {
            console.error("Failed to update tournament status:", error);
            toast({
                title: 'Error',
                description: 'Could not update the tournament status. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    if (!status) {
        return <div className="text-center text-red-500">Could not load tournament status.</div>;
    }

    const currentStage = stageConfig[status.roundId] || { title: 'Unknown State', description: 'The tournament is in an unrecognized state.', nextStage: '', buttonText: '' };

    return (
        <div className="space-y-8">
            <Card className="shadow-xl">
                <CardHeader className="text-center">
                    <ShieldEllipsis className="h-16 w-16 mx-auto text-primary mb-4" />
                    <CardTitle className="text-4xl font-bold text-primary">Tournament State Management</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">
                        Control the flow of the tournament from one stage to the next.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Current Status</CardTitle>
                    <CardDescription>This is the current, live stage of the tournament.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold text-primary">{currentStage.title}</p>
                        <p className="text-muted-foreground mt-1">{currentStage.description}</p>
                    </div>
                </CardContent>
                {currentStage.nextStage && (
                    <CardFooter>
                        <Button onClick={handleAdvanceStage} disabled={isUpdating} size="lg">
                            {isUpdating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                            {isUpdating ? "Updating..." : currentStage.buttonText}
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
