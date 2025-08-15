// src/app/admin/PlayoffManagementTab.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trophy, Users, Settings, Play, CheckCircle } from 'lucide-react';
import { PlayoffMonitor } from '@/components/admin/PlayoffMonitor';
import { MakeAdminButton } from '@/components/dev/MakeAdminButton';
import { db } from '@/lib/firebase';
import {
    getPlayoffData,
    getAvailableTeams,
    assignTeamToSlot,
    setMatchFormat,
    completePlayoffSetup,
    initializePlayoffBracket
} from '@/lib/playoff-management';
import {
    PlayoffData,
    PlayoffBracket,
    PlayoffSlot,
    PlayoffMatch,
    PlayoffMatchFormat,
    Team
} from '@/lib/definitions';

export function PlayoffManagementTab() {
    const [playoffData, setPlayoffData] = useState<PlayoffData | null>(null);
    const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [activeTab, setActiveTab] = useState('setup');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPlayoffData();
        loadAvailableTeams();
    }, []);

    const loadPlayoffData = async () => {
        try {
            setError(null);
            const data = await getPlayoffData();
            setPlayoffData(data);
        } catch (error) {
            console.error('Error loading playoff data:', error);
            if (error instanceof Error) {
                if (error.message.includes('Missing or insufficient permissions')) {
                    setError('Firebase permission denied. You may need to be added as an admin. Check the development tools below if you\'re in development mode.');
                } else if (error.message.includes('permission') || error.message.includes('insufficient')) {
                    setError('You do not have permission to access playoff management. Please ensure you are logged in as an admin.');
                } else {
                    setError(`Failed to load playoff data: ${error.message}`);
                }
            } else {
                setError('An unknown error occurred while loading playoff data.');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableTeams = async () => {
        try {
            const teams = await getAvailableTeams();
            setAvailableTeams(teams);
        } catch (error) {
            console.error('Error loading teams:', error);
        }
    };

    const handleAssignTeam = async (slotId: string, teamId: string, bracketType: any) => {
        setUpdating(true);
        try {
            // Handle removal (empty teamId) and assignment
            const success = await assignTeamToSlot(teamId || null, slotId, bracketType);
            if (success) {
                await loadPlayoffData();
            }
        } catch (error) {
            console.error('Error assigning team:', error);
        } finally {
            setUpdating(false);
        }
    };

    const handleSetMatchFormat = async (matchId: string, format: PlayoffMatchFormat) => {
        setUpdating(true);
        try {
            const success = await setMatchFormat(matchId, format);
            if (success) {
                await loadPlayoffData();
            }
        } catch (error) {
            console.error('Error setting match format:', error);
        } finally {
            setUpdating(false);
        }
    };

    const handleCompleteSetup = async () => {
        setUpdating(true);
        try {
            const success = await completePlayoffSetup();
            if (success) {
                await loadPlayoffData();
            }
        } catch (error) {
            console.error('Error completing setup:', error);
        } finally {
            setUpdating(false);
        }
    };

    const initializeBrackets = async () => {
        setUpdating(true);
        try {
            await initializePlayoffBracket();
            await loadPlayoffData();
        } catch (error) {
            console.error('Error initializing brackets:', error);
        } finally {
            setUpdating(false);
        }
    };

    const resetAndReinitialize = async () => {
        if (!confirm('This will delete all current playoff data and create fresh brackets. Continue?')) {
            return;
        }
        
        setUpdating(true);
        try {
            // Delete existing playoff data first
            const { deleteDoc, doc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'playoffs', 'main-playoffs'));
            
            // Then create new one
            await initializePlayoffBracket();
            await loadPlayoffData();
        } catch (error) {
            console.error('Error resetting brackets:', error);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="pt-6 space-y-4">
                    <Alert variant="destructive">
                        <AlertDescription>
                            {error}
                        </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                        <Button 
                            onClick={loadPlayoffData} 
                            variant="outline"
                        >
                            Try Again
                        </Button>
                    </div>
                    <MakeAdminButton />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5" />
                                Playoff Management
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Setup and manage the double elimination playoff bracket
                            </p>
                        </div>
                        {playoffData && (
                            <div className="flex items-center gap-2">
                                <Badge variant={playoffData.isSetup ? "default" : "secondary"}>
                                    {playoffData.isSetup ? "Setup Complete" : "Setup Required"}
                                </Badge>
                                <Button 
                                    onClick={resetAndReinitialize} 
                                    disabled={updating}
                                    variant="outline"
                                    size="sm"
                                >
                                    {updating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                    Reset & Reinitialize
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {!playoffData && !error && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <Trophy className="h-16 w-16 mx-auto text-muted-foreground" />
                            <div>
                                <h3 className="text-lg font-semibold">No Playoff Bracket Found</h3>
                                <p className="text-muted-foreground">Initialize the playoff brackets to get started</p>
                            </div>
                            <Button onClick={initializeBrackets} disabled={updating}>
                                {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Initialize Playoff Brackets
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {playoffData && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="setup">Team Assignment</TabsTrigger>
                        <TabsTrigger value="matches">Match Format</TabsTrigger>
                        <TabsTrigger value="monitor">Monitor</TabsTrigger>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                    </TabsList>

                    <TabsContent value="setup" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Team Slot Assignment
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Assign teams to their playoff bracket positions
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {playoffData.brackets.map(bracket => (
                                        <div key={bracket.id} className="space-y-3">
                                            <div>
                                                <h4 className="font-semibold text-primary">{bracket.name}</h4>
                                                {bracket.type === 'lower' && (
                                                    <p className="text-xs text-muted-foreground">
                                                        6 direct slots + 2 auto-filled from wildcards
                                                    </p>
                                                )}
                                                {bracket.type === 'final' && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Teams advance automatically from brackets
                                                    </p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                {bracket.slots
                                                    .filter(slot => {
                                                        // Only show initial slots for manual assignment
                                                        if (slot.round !== 1) return false;
                                                        
                                                        // For lower bracket, exclude wildcard winner slots (they auto-fill)
                                                        if (bracket.type === 'lower' && (slot.id === 'lb-slot-wc1' || slot.id === 'lb-slot-wc2')) {
                                                            return false;
                                                        }
                                                        
                                                        // For grand final, don't show any slots (teams advance automatically)
                                                        if (bracket.type === 'final') return false;
                                                        
                                                        return true;
                                                    })
                                                    .map(slot => (
                                                    <SlotAssignmentCard
                                                        key={slot.id}
                                                        slot={slot}
                                                        availableTeams={availableTeams}
                                                        playoffData={playoffData}
                                                        onAssign={(teamId) => handleAssignTeam(slot.id, teamId, bracket.type)}
                                                        disabled={updating}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="matches" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    Match Format Settings
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Set whether matches are Best of 1, 3, or 5
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {playoffData.brackets.map(bracket => (
                                        <div key={bracket.id} className="space-y-3">
                                            <h4 className="font-semibold text-primary">{bracket.name}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {bracket.matches.map(match => (
                                                    <MatchFormatCard
                                                        key={match.id}
                                                        match={match}
                                                        onFormatChange={(format) => handleSetMatchFormat(match.id, format)}
                                                        disabled={updating}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="monitor">
                        <PlayoffMonitor />
                    </TabsContent>

                    <TabsContent value="overview" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Playoff Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                                        <span>Total Brackets: {playoffData.brackets.length}</span>
                                        <Badge variant="outline">
                                            {playoffData.brackets.reduce((acc, b) => acc + b.slots.length, 0)} Slots
                                        </Badge>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {playoffData.brackets.map(bracket => (
                                            <div key={bracket.id} className="flex items-center justify-between p-2 border rounded">
                                                <span className="font-medium">{bracket.name}</span>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline">
                                                        {bracket.slots.filter(s => s.teamId).length}/{bracket.slots.filter(s => s.round === 1).length} Teams
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        {bracket.matches.length} Matches
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {!playoffData.isSetup && (
                                        <Alert>
                                            <CheckCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                Complete team assignments and match formats, then mark setup as complete to enable the playoff bracket for players.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="flex gap-2">
                                        <Button 
                                            onClick={handleCompleteSetup} 
                                            disabled={updating || playoffData.isSetup}
                                            className="flex-1"
                                        >
                                            {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            {playoffData.isSetup ? "Setup Complete" : "Complete Setup"}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

// Component for individual slot assignment
function SlotAssignmentCard({ slot, availableTeams, playoffData, onAssign, disabled }: {
    slot: PlayoffSlot;
    availableTeams: Team[];
    playoffData: PlayoffData;
    onAssign: (teamId: string) => void;
    disabled: boolean;
}) {
    const assignedTeam = availableTeams.find(team => team.id === slot.teamId);
    
    // Get all currently assigned team IDs from all brackets
    const assignedTeamIds = new Set<string>();
    playoffData.brackets.forEach(bracket => {
        bracket.slots.forEach(s => {
            if (s.teamId && s.id !== slot.id) { // Exclude current slot
                assignedTeamIds.add(s.teamId);
            }
        });
    });
    
    // Filter available teams to only show unassigned ones
    const unassignedTeams = availableTeams.filter(team => 
        team.id && !assignedTeamIds.has(team.id)
    );

    return (
        <Card className="p-3">
            <div className="space-y-2">
                <div className="font-medium text-sm">
                    Position {slot.position}
                </div>
                
                {assignedTeam ? (
                    <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">
                            {assignedTeam.name}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAssign('')}
                            disabled={disabled}
                        >
                            Remove
                        </Button>
                    </div>
                ) : (
                    <Select onValueChange={onAssign} disabled={disabled}>
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                            {unassignedTeams.map(team => (
                                <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
        </Card>
    );
}

// Component for match format settings
function MatchFormatCard({ match, onFormatChange, disabled }: {
    match: PlayoffMatch;
    onFormatChange: (format: PlayoffMatchFormat) => void;
    disabled: boolean;
}) {
    return (
        <Card className="p-3">
            <div className="space-y-2">
                <div className="font-medium text-sm">
                    Round {match.round}, Match {match.position}
                </div>
                
                <div className="flex items-center gap-2">
                    <Select 
                        value={match.format} 
                        onValueChange={(value) => onFormatChange(value as PlayoffMatchFormat)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="bo1">Best of 1</SelectItem>
                            <SelectItem value="bo3">Best of 3</SelectItem>
                            <SelectItem value="bo5">Best of 5</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Badge 
                        variant={match.format === 'bo5' ? 'default' : 'secondary'}
                        className="text-xs"
                    >
                        {match.format.toUpperCase()}
                    </Badge>
                </div>
            </div>
        </Card>
    );
}
