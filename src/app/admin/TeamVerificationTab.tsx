"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, Trash2 } from 'lucide-react';
import { getAllTeams } from '@/lib/firestore';
import { updateTeamStatus, deleteTeam } from '@/lib/admin-actions';
import { Team, TeamStatus } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/context/AuthContext';

function TeamDetails({ team, onStatusUpdate, onDelete, isUpdating }: { team: Team, onStatusUpdate: (teamId: string, status: TeamStatus) => void, onDelete: (teamId: string) => void, isUpdating: boolean }) {
    return (
        <AccordionContent>
            <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">Roster:</h4>
                <ul className="space-y-1 list-disc list-inside">
                    {team.players?.map(p => (
                        <li key={`${team.id}-${p.id}`}>{p.nickname} - <span className="font-mono">{p.mmr} MMR</span></li>
                    ))}
                </ul>
                <div className="flex justify-end space-x-2 mt-4">
                    <Button size="sm" variant="secondary" onClick={() => onStatusUpdate(team.id, 'verified')} disabled={isUpdating}>
                        <ShieldCheck className="h-4 w-4 mr-2" /> Verify
                    </Button>
                    <Button size="sm" variant="default" onClick={() => onStatusUpdate(team.id, 'warning')} disabled={isUpdating}>
                        <ShieldAlert className="h-4 w-4 mr-2" /> Issue Warning
                    </Button>
                     <Button size="sm" variant="destructive" onClick={() => onStatusUpdate(team.id, 'rejected')} disabled={isUpdating}>
                        <ShieldX className="h-4 w-4 mr-2" /> Reject
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onStatusUpdate(team.id, 'banned')} disabled={isUpdating}>
                        <ShieldX className="h-4 w-4 mr-2" /> Ban
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={isUpdating}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the team
                                    and all of its data from our servers.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(team.id)}>
                                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </AccordionContent>
    );
}

export function TeamVerificationTab() {
    const { user } = useAuth();
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, startTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        async function fetchTeams() {
            setIsLoading(true);
            const allTeams = await getAllTeams();
            setTeams(allTeams);
            setIsLoading(false);
        }
        fetchTeams();
    }, []);

    const handleStatusUpdate = (teamId: string, status: TeamStatus) => {
        startTransition(async () => {
            if (!user) {
                toast({ title: 'Authentication Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
                return;
            }
            try {
                const token = await user.getIdToken();
                const result = await updateTeamStatus(token, teamId, status);

                if (result?.success) {
                    setTeams(prevTeams =>
                        prevTeams.map(t => t.id === teamId ? { ...t, status } : t)
                    );
                    toast({
                        title: 'Success!',
                        description: `Team status has been updated to ${status}.`,
                    });
                } else {
                    toast({
                        title: 'Update Failed',
                        description: result?.error || 'An unknown error occurred.',
                        variant: 'destructive',
                    });
                }
            } catch (error) {
                toast({
                    title: 'An Unexpected Error Occurred',
                    description: (error as Error).message || 'Please try again later.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleDeleteTeam = (teamId: string) => {
        startTransition(async () => {
            if (!user) {
                toast({ title: 'Authentication Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
                return;
            }
            const token = await user.getIdToken();
            const result = await deleteTeam(token, teamId);
            if (result.success) {
                setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
                toast({
                    title: 'Success!',
                    description: 'Team has been deleted.',
                });
            } else {
                toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        });
    };

    const getStatusBadgeVariant = (status?: TeamStatus) => {
        switch (status) {
            case 'verified': return 'secondary';
            case 'warning': return 'default';
            case 'banned': return 'destructive';
            case 'rejected': return 'destructive';
            default: return 'outline';
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader><CardTitle>Team Verification</CardTitle></CardHeader>
                <CardContent className="flex justify-center items-center h-48">
                    <Loader2 className="h-16 w-16 animate-spin" />
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Team Verification</CardTitle>
                <CardDescription>
                    Review and verify team rosters and player eligibility.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {teams.map((team) => (
                        <AccordionItem key={team.id} value={team.id}>
                            <AccordionTrigger>
                                <div className="flex items-center space-x-4 w-full mr-4">
                                    <Image src={team.logoUrl || '/backgrounds/liga_fantasy.png'} alt={team.name} width={40} height={40} className="rounded-md" />
                                    <div className="flex-grow text-left">
                                        <p className="font-bold text-lg">{team.name} <span className="text-sm text-muted-foreground">({team.tag})</span></p>
                                        <p className="text-sm">Total MMR: {team.players?.reduce((acc, p) => acc + p.mmr, 0) || 'N/A'}</p>
                                    </div>
                                    <Badge variant={getStatusBadgeVariant(team.status)} className="ml-auto">
                                        {team.status || 'Pending'}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <TeamDetails
                                team={team}
                                onStatusUpdate={handleStatusUpdate}
                                onDelete={handleDeleteTeam}
                                isUpdating={isUpdating}
                            />
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}
