// src/components/app/PlayoffProgress.tsx

"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Clock, CheckCircle, Play, Users } from "lucide-react";
import { usePlayoffs } from '@/context/PlayoffContext';

export function PlayoffProgress() {
    const { playoffStatus, isLoading } = usePlayoffs();

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </CardContent>
            </Card>
        );
    }

    const progressPercentage = playoffStatus.totalMatches > 0 
        ? (playoffStatus.completedMatches / playoffStatus.totalMatches) * 100 
        : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Playoff Progress
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Tournament Progress</span>
                        <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
                        <Users className="h-4 w-4 text-muted-foreground mb-1" />
                        <div className="text-lg font-semibold">{playoffStatus.totalMatches}</div>
                        <div className="text-xs text-muted-foreground">Total Matches</div>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-green-500/10 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500 mb-1" />
                        <div className="text-lg font-semibold text-green-500">{playoffStatus.completedMatches}</div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-blue-500/10 rounded-lg">
                        <Clock className="h-4 w-4 text-blue-500 mb-1" />
                        <div className="text-lg font-semibold text-blue-500">{playoffStatus.scheduledMatches}</div>
                        <div className="text-xs text-muted-foreground">Scheduled</div>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-orange-500/10 rounded-lg">
                        <Play className="h-4 w-4 text-orange-500 mb-1" />
                        <div className="text-lg font-semibold text-orange-500">{playoffStatus.readyMatches}</div>
                        <div className="text-xs text-muted-foreground">Ready</div>
                    </div>
                </div>

                {progressPercentage === 100 && (
                    <div className="flex items-center justify-center p-4 bg-primary/10 rounded-lg">
                        <Trophy className="h-5 w-5 text-primary mr-2" />
                        <span className="font-semibold text-primary">Tournament Complete!</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
