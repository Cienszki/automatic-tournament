"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { TimeMachine } from '@/components/app/system-test/TimeMachine';
import { CaptainImpersonator } from '@/components/app/system-test/CaptainImpersonator';
// import { ScenarioSimulator } from '@/components/app/system-test/ScenarioSimulator';
import { TimeProvider } from '@/context/TimeContext';

export default function SystemTestPage() {
    const { user, signInWithGoogle, signOut } = useAuth();

    return (
        <TimeProvider>
            <div className="container mx-auto p-8">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>System Test Page</CardTitle>
                        <CardDescription>
                            A sandbox for testing complex, time-sensitive, and user-specific functionality.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <CaptainImpersonator />
                        <TimeMachine />
                        {/* <ScenarioSimulator /> */}
                    </CardContent>
                </Card>
            </div>
        </TimeProvider>
    );
}
