
"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { getTournamentStatus, updateTournamentStatus, initializeTournament } from '@/lib/admin-actions';
import type { TournamentStatus } from '@/lib/definitions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, ShieldPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const stageConfig: Record<string, { title: string; description: string; nextStage: string; buttonText: string }> = {
    'initial': {
        title: 'Tournament Initialized',
        description: 'The tournament is ready to begin. Start the pre-season to open registrations.',
        nextStage: 'pre_season',
        buttonText: 'Start Pre-Season',
    },
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

export function StageManagementTab() {
    const [status, setStatus] = useState<TournamentStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchStatus = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const currentStatus = await getTournamentStatus();
            setStatus(currentStatus);
        } catch (e) {
            setError("An unexpected error occurred while fetching the status.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleInitialize = async () => {
        startTransition(async () => {
            const result = await initializeTournament();
            if (result.success) {
                await fetchStatus();
                toast({
                    title: 'Success!',
                    description: 'Tournament has been initialized.',
                });
            } else {
                console.error("Failed to initialize tournament:", result.error);
                toast({
                    title: 'Error',
                    description: result.error || 'Could not initialize the tournament.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleAdvanceStage = async () => {
        if (!status || !stageConfig[status.roundId]?.nextStage) return;

        const nextStageId = stageConfig[status.roundId].nextStage;

        startTransition(async () => {
            const result = await updateTournamentStatus({ roundId: nextStageId });
            if (result.success) {
                setStatus({ roundId: nextStageId });
                toast({
                    title: 'Success!',
                    description: `Tournament has been advanced to: ${stageConfig[nextStageId].title}`,
                });
            } else {
                console.error("Failed to update tournament status:", result.error);
                toast({
                    title: 'Error',
                    description: result.error || 'Could not update the tournament status. Please try again.',
                    variant: 'destructive',
                });
            }
        });
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-center text-red-500">{error}</div>;
    }

    if (!status) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Initialize Tournament</CardTitle>
                    <CardDescription>The tournament status document does not exist in the database yet.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Click the button below to create the initial record and start the tournament management process.</p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleInitialize} disabled={isUpdating} size="lg">
                        {isUpdating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldPlus className="mr-2 h-5 w-5" />}
                        {isUpdating ? "Initializing..." : "Initialize Tournament"}
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    const currentStage = stageConfig[status.roundId] || { title: 'Unknown State', description: `The tournament is in an unrecognized state: '${status.roundId}'`, nextStage: '', buttonText: '' };

    return (
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
    );
}
