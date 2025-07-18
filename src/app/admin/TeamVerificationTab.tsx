
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';
import { getAllTeams } from '@/lib/firestore';
import { updateTeamStatus } from '@/lib/team-actions';
import { Team } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function TeamVerificationTab() {
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

    const handleStatusUpdate = async (teamId: string, status: 'verified' | 'warning' | 'banned') => {
        startTransition(async () => {
            const result = await updateTeamStatus(teamId, status);
            if (result.success) {
                setTeams(prevTeams => 
                    prevTeams.map(t => t.id === teamId ? { ...t, status } : t)
                );
                toast({
                    title: 'Success!',
                    description: `Team status has been updated to ${status}.`,
                });
            } else {
                console.error("Failed to update team status:", result.error);
                toast({
                    title: 'Error',
                    description: 'Could not update the team status.',
                    variant: 'destructive',
                });
            }
        });
    };

    const getStatusBadgeVariant = (status?: 'verified' | 'warning' | 'banned' | 'pending') => {
        switch (status) {
            case 'verified': return 'secondary';
            case 'warning': return 'default';
            case 'banned': return 'destructive';
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
                            <AccordionContent>
                                <div className="p-4 bg-muted/50 rounded-lg">
                                    <h4 className="font-semibold mb-2">Roster:</h4>
                                    <ul className="space-y-1 list-disc list-inside">
                                        {team.players?.map(p => (
                                            <li key={p.id}>{p.nickname} - <span className="font-mono">{p.mmr} MMR</span></li>
                                        ))}
                                    </ul>
                                    <div className="flex justify-end space-x-2 mt-4">
                                        <Button size="sm" variant="secondary" onClick={() => handleStatusUpdate(team.id, 'verified')} disabled={isUpdating}>
                                            <ShieldCheck className="h-4 w-4 mr-2" /> Verify
                                        </Button>
                                        <Button size="sm" variant="default" onClick={() => handleStatusUpdate(team.id, 'warning')} disabled={isUpdating}>
                                            <ShieldAlert className="h-4 w-4 mr-2" /> Issue Warning
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate(team.id, 'banned')} disabled={isUpdating}>
                                            <ShieldX className="h-4 w-4 mr-2" /> Ban
                                        </Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}
