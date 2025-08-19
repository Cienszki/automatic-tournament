
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { importMatchFromOpenDota, syncLeagueMatches } from '@/lib/actions';
import { deleteAllMatches, deleteSelectedMatches, clearProcessedGamesAdmin, updateAllTeamStatisticsAdmin } from '@/lib/admin-actions';
import { getAllMatches } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2, PlusCircle, RefreshCw, Trash2, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
// import { TimeMachine } from '@/components/app/system-test/TimeMachine';
// import { CaptainImpersonator, CaptainImpersonatorRef } from '@/components/app/system-test/CaptainImpersonator';
import { FakeTeamGenerator } from '@/components/app/admin/FakeTeamGenerator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Match } from '@/lib/definitions';

export function SystemTestTab() {
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);
    const [isManualImporting, setIsManualImporting] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isClearingProcessed, setIsClearingProcessed] = React.useState(false);
    const [isUpdatingStats, setIsUpdatingStats] = React.useState(false);
    const [matchId, setMatchId] = React.useState('');
    const [manualMatchIds, setManualMatchIds] = React.useState('');
    const [matches, setMatches] = React.useState<Match[]>([]);
    const [selectedMatches, setSelectedMatches] = React.useState<string[]>([]);
    const { toast } = useToast();
    const { t } = useTranslation();
    const { user } = useAuth();
    // const captainImpersonatorRef = React.useRef<CaptainImpersonatorRef>(null);

    const fetchMatches = React.useCallback(async () => {
        const allMatches = await getAllMatches();
        setMatches(allMatches);
    }, []);

    React.useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const handleTeamCreated = () => {
        // if (captainImpersonatorRef.current) {
        //     captainImpersonatorRef.current.refreshTeams();
        // }
        // Potentially refresh other data as well
    };

    // New: Call API route for sync (for SSR safety)
    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/admin-sync-matches', { method: 'POST' });
            const result = await res.json();
            toast({ 
              title: result.success ? t('toasts.success.title') : t('toasts.errors.admin.syncFailed'), 
              description: result.message, 
              variant: result.success ? "default" : "destructive" 
            });
        } catch (err) {
            toast({ 
              title: t('toasts.errors.admin.syncFailed'), 
              description: t('toasts.errors.networkError'), 
              variant: "destructive" 
            });
        }
        setIsSyncing(false);
        fetchMatches();
    };

    const handleClearProcessed = async () => {
        setIsClearingProcessed(true);
        try {
            const res = await fetch('/api/debug/clear-processed', { method: 'POST' });
            const result = await res.json();
            toast({ 
                title: result.success ? t('toasts.success.title') : t('toasts.errors.admin.clearFailed'), 
                description: result.success ? result.message : result.error, 
                variant: result.success ? "default" : "destructive" 
            });
        } catch (err) {
            toast({ 
              title: t('toasts.errors.admin.clearFailed'), 
              description: t('toasts.errors.networkError'), 
              variant: "destructive" 
            });
        }
        setIsClearingProcessed(false);
    };

    const handleUpdateTeamStats = async () => {
        setIsUpdatingStats(true);
        try {
            const res = await fetch('/api/admin/update-team-stats', { method: 'POST' });
            const result = await res.json();
            toast({ 
                title: result.success ? t('toasts.success.title') : t('toasts.errors.admin.updateFailed'), 
                description: result.success ? result.message : result.error, 
                variant: result.success ? "default" : "destructive" 
            });
        } catch (err) {
            toast({ 
              title: t('toasts.errors.admin.updateFailed'), 
              description: t('toasts.errors.networkError'), 
              variant: "destructive" 
            });
        }
        setIsUpdatingStats(false);
    };

    const handleImport = async () => {
        if (!matchId || isNaN(Number(matchId))) {
            toast({ 
              title: t('toasts.errors.validation.invalidMatchId'), 
              description: t('toasts.errors.validation.numericMatchId'), 
              variant: "destructive" 
            });
            return;
        }
        setIsImporting(true);
        // ourMatchId should be the ID of the match in your system to map to OpenDota matchId
        // Here, we use matchId as both for demonstration, but you may want to select a match from your system
        const result = await importMatchFromOpenDota(Number(matchId), matchId);
        toast({ 
          title: result.success ? t('toasts.success.title') : t('toasts.errors.admin.importFailed'), 
          description: result.message, 
          variant: result.success ? "default" : "destructive" 
        });
        setIsImporting(false);
        fetchMatches();
    };

    const handleManualImport = async () => {
        if (!manualMatchIds.trim()) {
            toast({
                title: "Error",
                description: "Please enter match IDs",
                variant: "destructive"
            });
            return;
        }

        if (!user) {
            toast({
                title: "Authentication Error",
                description: "You must be logged in to perform this action.",
                variant: "destructive",
            });
            return;
        }

        setIsManualImporting(true);
        try {
            // Parse match IDs from input (support comma, space, or newline separated)
            const matchIds = manualMatchIds
                .split(/[,\s\n]+/)
                .map(id => id.trim())
                .filter(id => id.length > 0);

            if (matchIds.length === 0) {
                throw new Error("No valid match IDs found");
            }

            // Validate that all are numbers
            const invalidIds = matchIds.filter(id => isNaN(Number(id)) || Number(id) <= 0);
            if (invalidIds.length > 0) {
                throw new Error(`Invalid match IDs: ${invalidIds.join(', ')}`);
            }

            const token = await user.getIdToken();
            const response = await fetch('/api/admin-import-manual-matches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ matchIds }),
            });

            const result = await response.json();
            
            if (result.success) {
                toast({
                    title: "Success!",
                    description: result.message,
                });
                setManualMatchIds('');
                fetchMatches();
            } else {
                throw new Error(result.error || result.message || 'Failed to import matches');
            }
        } catch (err: any) {
            toast({
                title: "Manual Import Failed",
                description: err.message || 'An error occurred during import',
                variant: "destructive"
            });
        }
        setIsManualImporting(false);
    };
    
    const handleDeleteSelected = async () => {
        if (!user) {
            toast({ 
              title: t('toasts.errors.auth.title'), 
              description: t('toasts.errors.auth.loginRequired'), 
              variant: "destructive" 
            });
            return;
        }
        const token = await user.getIdToken();
        setIsDeleting(true);
        const result = await deleteSelectedMatches(token, selectedMatches);
        toast({ 
          title: result.success ? t('toasts.success.title') : t('toasts.errors.admin.deletionFailed'), 
          description: result.message, 
          variant: result.success ? "default" : "destructive" 
        });
        setSelectedMatches([]);
        setIsDeleting(false);
        fetchMatches();
    };

    const handleDeleteAll = async () => {
        if (!user) {
            toast({ 
              title: t('toasts.errors.auth.title'), 
              description: t('toasts.errors.auth.loginRequired'), 
              variant: "destructive" 
            });
            return;
        }
        const token = await user.getIdToken();
        setIsDeleting(true);
        const result = await deleteAllMatches(token);
        toast({ 
          title: result.success ? t('toasts.success.title') : t('toasts.errors.admin.deletionFailed'), 
          description: result.message, 
          variant: result.success ? "default" : "destructive" 
        });
        setIsDeleting(false);
        fetchMatches();
    };

    const handleSelectMatch = (matchId: string) => {
        setSelectedMatches(prev => 
            prev.includes(matchId) ? prev.filter(id => id !== matchId) : [...prev, matchId]
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Advanced Tools</CardTitle>
                <CardDescription>
                    Use these tools for testing, data management, and test account administration.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FakeTeamGenerator onTeamCreated={handleTeamCreated} />
                
                {/* Groups Builder */}
                <Card>
                    <CardHeader>
                        <CardTitle>🎲 Groups Builder</CardTitle>
                        <CardDescription>
                            Interactive tool for live group draws. Drag teams from the pool into groups during broadcast.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <a href="/groups-draw" target="_blank" rel="noopener noreferrer">
                                <Users className="mr-2 h-4 w-4" />
                                Open Groups Draw Builder
                            </a>
                        </Button>
                    </CardContent>
                </Card>

                {/* <CaptainImpersonator ref={captainImpersonatorRef} /> */}
                {/* <TimeMachine /> */}
                <Card>
                    <CardHeader>
                        <CardTitle>OpenDota Integration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="flex items-center gap-4">
                            <input
                                type="text"
                                value={matchId}
                                onChange={(e) => setMatchId(e.target.value)}
                                placeholder="Enter OpenDota Match ID"
                                className="p-2 border rounded-md w-full"
                            />
                            <Button onClick={handleImport} disabled={isImporting}>
                                {isImporting ? <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div> : <PlusCircle className="mr-2 h-4 w-4" />}
                                {isImporting ? "Importing..." : "Import Match"}
                            </Button>
                        </div>
                        
                        {/* Manual Import Section */}
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-2">Manual Bulk Import</h4>
                            <p className="text-xs text-muted-foreground mb-3">
                                Import multiple matches by providing a list of match IDs (comma, space, or newline separated). 
                                Use this when STRATZ API is unavailable.
                            </p>
                            <div className="space-y-2">
                                <textarea
                                    value={manualMatchIds}
                                    onChange={(e) => setManualMatchIds(e.target.value)}
                                    placeholder="Enter match IDs separated by commas, spaces, or new lines&#10;Example: 7123456789, 7123456790&#10;7123456791"
                                    className="w-full p-2 border rounded-md min-h-[100px] text-sm"
                                    disabled={isManualImporting}
                                />
                                <Button 
                                    onClick={handleManualImport} 
                                    disabled={isManualImporting || !manualMatchIds.trim()}
                                    className="w-full"
                                >
                                    {isManualImporting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Import Match List
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                        
                         <Button onClick={handleSync} disabled={isSyncing}>
                            {isSyncing ? <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {isSyncing ? "Syncing..." : "Sync All New Matches"}
                        </Button>
                        <Button onClick={handleClearProcessed} disabled={isClearingProcessed} variant="destructive">
                            {isClearingProcessed ? <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div> : <Trash2 className="mr-2 h-4 w-4" />}
                            {isClearingProcessed ? "Clearing..." : "Clear Processed Games"}
                        </Button>
                        <Button onClick={handleUpdateTeamStats} disabled={isUpdatingStats} variant="outline">
                            {isUpdatingStats ? <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {isUpdatingStats ? "Updating..." : "Update Team Statistics"}
                        </Button>
                    </CardContent>
                </Card>
                
                <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
                    <h4 className="text-lg font-semibold text-destructive mb-2 flex items-center">
                        <ShieldAlert className="mr-2 h-5 w-5" />
                        Match Deletion Zone
                    </h4>
                    <ScrollArea className="h-72 w-full rounded-md border p-4 mb-4">
                        <div className="space-y-2">
                            {matches.map(match => (
                                <div key={match.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`match-${match.id}`}
                                        onCheckedChange={() => handleSelectMatch(match.id)}
                                        checked={selectedMatches.includes(match.id)}
                                    />
                                    <label htmlFor={`match-${match.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {match.teamA?.name || 'N/A'} vs {match.teamB?.name || 'N/A'} <span className="text-muted-foreground">(ID: {match.id}, Group: {match.group_id || 'N/A'})</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <div className="flex justify-between items-center">
                        <Button variant="destructive" onClick={handleDeleteSelected} disabled={isDeleting || selectedMatches.length === 0}>
                             {isDeleting ? <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Selected ({selectedMatches.length})
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeleting}>
                                    Delete All Matches
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will delete all {matches.length} matches. This is irreversible.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAll}>Yes, delete all</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
