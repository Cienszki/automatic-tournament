
"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { checkIfAdmin } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StageManagementTab } from './StageManagementTab';
import { StandingsTab } from './StandingsTab';
import { MatchManagementTab } from './MatchManagementTab';
import { MatchImportTab } from './MatchImportTab';
import { TeamVerificationTab } from './TeamVerificationTab';
import { AnnouncementsTab } from './AnnouncementsTab';
import { SystemTestTab } from './SystemTestTab';
import { StandinManagementTab } from './StandinManagementTab';
import { TournamentStatusTab } from './TournamentStatusTab';
import { PlayoffManagementTab } from './PlayoffManagementTab';
import { StatsManagementTab } from './StatsManagementTab';
import { MakeAdminButton } from '@/components/dev/MakeAdminButton';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
    const { user, signInWithGoogle } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function verifyAdmin() {
            if (user) {
                const adminStatus = await checkIfAdmin(user);
                setIsAdmin(adminStatus);
            }
            setIsLoading(false);
        }
        verifyAdmin();
    }, [user]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div></div>;
    }

    if (!user) {
        return (
            <Card className="text-center max-w-md mx-auto mt-20">
                <CardHeader>
                    <CardTitle>Admin Access Required</CardTitle>
                    <CardDescription>Please log in to access the admin panel.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={signInWithGoogle}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign in with Google
                    </Button>
                </CardContent>
            </Card>
        );
    }
    
    if (!isAdmin) {
        return (
            <div className="text-center py-20 max-w-2xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold text-red-500">Access Denied</h1>
                <p className="mt-4 text-muted-foreground">You do not have permission to view this page.</p>
                <MakeAdminButton />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <Card className="shadow-xl">
                <CardHeader className="text-center">
                    <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
                    <CardTitle className="text-4xl font-bold text-primary">Admin Panel</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">
                        Manage the tournament, update standings, and verify teams.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Tabs defaultValue="status">
                <TabsList className="grid w-full grid-cols-11">
                    <TabsTrigger value="status">Status</TabsTrigger>
                    <TabsTrigger value="stage">Stage</TabsTrigger>
                    <TabsTrigger value="standings">Standings</TabsTrigger>
                    <TabsTrigger value="matches">Matches</TabsTrigger>
                    <TabsTrigger value="import">Import</TabsTrigger>
                    <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                    <TabsTrigger value="standins">Standins</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                    <TabsTrigger value="announcements">Announcements</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                <TabsContent value="status">
                    <TournamentStatusTab />
                </TabsContent>
                <TabsContent value="stage">
                    <StageManagementTab />
                </TabsContent>
                <TabsContent value="standings">
                    <StandingsTab />
                </TabsContent>
                <TabsContent value="matches">
                    <MatchManagementTab />
                </TabsContent>
                <TabsContent value="import">
                    <MatchImportTab />
                </TabsContent>
                <TabsContent value="playoffs">
                    <PlayoffManagementTab />
                </TabsContent>
                <TabsContent value="teams">
                    <TeamVerificationTab />
                </TabsContent>
                <TabsContent value="standins">
                    <StandinManagementTab />
                </TabsContent>
                <TabsContent value="stats">
                    <StatsManagementTab />
                </TabsContent>
                <TabsContent value="announcements">
                    <AnnouncementsTab />
                </TabsContent>
                <TabsContent value="advanced">
                    <SystemTestTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
