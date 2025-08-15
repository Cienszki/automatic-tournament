// src/components/admin/PlayoffMonitor.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
    Trophy, 
    Play, 
    Clock, 
    CheckCircle, 
    AlertTriangle,
    RefreshCw,
    Calendar
} from 'lucide-react';
import { 
    getReadyPlayoffMatches, 
    createMatchesForPlayoffRound, 
    schedulePlayoffMatch,
    getPlayoffStatus
} from '@/lib/playoff-automation';
import { PlayoffMatch } from '@/lib/definitions';

export function PlayoffMonitor() {
    const [readyMatches, setReadyMatches] = useState<PlayoffMatch[]>([]);
    const [status, setStatus] = useState({
        totalMatches: 0,
        completedMatches: 0,
        scheduledMatches: 0,
        readyMatches: 0
    });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const [matches, playoffStatus] = await Promise.all([
                getReadyPlayoffMatches(),
                getPlayoffStatus()
            ]);
            
            setReadyMatches(matches);
            setStatus(playoffStatus);
        } catch (error) {
            console.error('Error loading playoff monitor data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMatches = async (roundNumber: number, bracketType: string) => {
        const actionId = `${bracketType}-r${roundNumber}`;
        setActionLoading(actionId);
        
        try {
            await createMatchesForPlayoffRound(roundNumber, bracketType);
            await loadData();
        } catch (error) {
            console.error('Error creating matches:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const formatBracketType = (type: string) => {
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            Playoff Monitor
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold">{status.totalMatches}</div>
                            <div className="text-sm text-muted-foreground">Total</div>
                        </div>
                        <div className="text-center p-3 bg-green-500/10 rounded-lg">
                            <div className="text-2xl font-bold text-green-500">{status.completedMatches}</div>
                            <div className="text-sm text-muted-foreground">Completed</div>
                        </div>
                        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                            <div className="text-2xl font-bold text-blue-500">{status.scheduledMatches}</div>
                            <div className="text-sm text-muted-foreground">Scheduled</div>
                        </div>
                        <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                            <div className="text-2xl font-bold text-orange-500">{status.readyMatches}</div>
                            <div className="text-sm text-muted-foreground">Ready</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Ready Matches */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5" />
                        Ready Matches ({readyMatches.length})
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Matches with both teams assigned and ready for scheduling
                    </p>
                </CardHeader>
                <CardContent>
                    {readyMatches.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                            <p className="text-muted-foreground">No matches ready at this time</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {readyMatches.map((match) => (
                                <MatchCard
                                    key={match.id}
                                    match={match}
                                    onCreateMatch={() => handleCreateMatches(match.round, match.bracketType)}
                                    isLoading={actionLoading === `${match.bracketType}-r${match.round}`}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Quick Actions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button
                            variant="outline"
                            onClick={() => handleCreateMatches(1, 'upper')}
                            disabled={!!actionLoading}
                            className="flex flex-col h-auto p-4"
                        >
                            <Trophy className="h-6 w-6 mb-2" />
                            <span>Create Upper R1</span>
                            <span className="text-xs text-muted-foreground">Upper Bracket Round 1</span>
                        </Button>
                        
                        <Button
                            variant="outline"
                            onClick={() => handleCreateMatches(1, 'lower')}
                            disabled={!!actionLoading}
                            className="flex flex-col h-auto p-4"
                        >
                            <Play className="h-6 w-6 mb-2" />
                            <span>Create Lower R1</span>
                            <span className="text-xs text-muted-foreground">Lower Bracket Round 1</span>
                        </Button>
                        
                        <Button
                            variant="outline"
                            onClick={() => handleCreateMatches(1, 'wildcard')}
                            disabled={!!actionLoading}
                            className="flex flex-col h-auto p-4"
                        >
                            <Clock className="h-6 w-6 mb-2" />
                            <span>Create Wildcards</span>
                            <span className="text-xs text-muted-foreground">Wildcard Matches</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

const MatchCard = ({ 
    match, 
    onCreateMatch, 
    isLoading 
}: { 
    match: PlayoffMatch;
    onCreateMatch: () => void;
    isLoading: boolean;
}) => {
    return (
        <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
                <Badge variant="outline">
                    {formatBracketType(match.bracketType)} R{match.round}
                </Badge>
                <Badge variant={match.status === 'completed' ? 'default' : 'secondary'}>
                    {match.format.toUpperCase()}
                </Badge>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="font-medium">{match.teamA?.name || 'TBD'}</span>
                    {match.result && (
                        <span className="text-sm font-mono">{match.result.teamAScore}</span>
                    )}
                </div>
                <div className="text-center text-sm text-muted-foreground">vs</div>
                <div className="flex justify-between items-center">
                    <span className="font-medium">{match.teamB?.name || 'TBD'}</span>
                    {match.result && (
                        <span className="text-sm font-mono">{match.result.teamBScore}</span>
                    )}
                </div>
            </div>

            {!match.matchId && match.teamA && match.teamB && (
                <Button
                    onClick={onCreateMatch}
                    disabled={isLoading}
                    size="sm"
                    className="w-full"
                >
                    {isLoading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />}
                    Create Match
                </Button>
            )}

            {match.matchId && (
                <Badge variant="default" className="w-full justify-center">
                    Match Created
                </Badge>
            )}
        </div>
    );
};

function formatBracketType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
}
