
"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { checkIfAdmin } from '@/lib/admin';
import { useEffect, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StageManagementTab } from './StageManagementTab';
import { StandingsTab } from './StandingsTab';
import { TeamVerificationTab } from './TeamVerificationTab';
import { AnnouncementsTab } from './AnnouncementsTab';


export default function AdminPage() {
    const { user } = useAuth();
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
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    if (!isAdmin) {
        return (
            <div className="text-center py-20">
                <h1 className="text-3xl font-bold text-red-500">Access Denied</h1>
                <p className="mt-4 text-muted-foreground">You do not have permission to view this page.</p>
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

            <StageManagementTab />
            <StandingsTab />
            <TeamVerificationTab />
            <AnnouncementsTab />

        </div>
    );
}
