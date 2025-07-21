"use client";

import React, { useState, useTransition } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createTestTeam } from '@/lib/admin-actions';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';


// NOTE: This is a test page for demonstrating the database write flow.
// It is not part of the main application navigation.

export default function UploadTestPage() {
    const { user, signInWithGoogle, signOut } = useAuth();
    const { toast } = useToast();
    const [isDbSubmitting, startDbTransition] = useTransition();

    const [teamName, setTeamName] = useState("Test Team Alpha");
    const [teamTag, setTeamTag] = useState("TTA");

    const handleDbSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) {
            toast({ title: "Not logged in", description: "You must be logged in to test database writes.", variant: "destructive" });
            return;
        }

        startDbTransition(async () => {
            const result = await createTestTeam({ name: teamName, tag: teamTag });
            if (result.success) {
                toast({ title: "Success!", description: "Test team saved to the database." });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    return (
        <div className="container mx-auto p-4">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>System Test: Secure Database Write</CardTitle>
                    <CardDescription>
                        This page demonstrates how a client component can trigger a secure, server-only database write using a Next.js Server Action.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 border rounded-md">
                        <h3 className="font-semibold mb-2">Authentication</h3>
                        {user ? (
                            <div className="flex items-center justify-between">
                                <p>Signed in as <strong>{user.displayName}</strong></p>
                                <Button variant="outline" onClick={() => signOut()}><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <p>You are not signed in.</p>
                                <Button onClick={() => signInWithGoogle()}><LogIn className="mr-2 h-4 w-4" />Sign In with Google</Button>
                            </div>
                        )}
                         <p className="text-xs text-muted-foreground mt-2">
                            Note: To write to the database, you must be signed in with an account that is listed in the `admins` collection in Firestore.
                        </p>
                    </div>

                    <form onSubmit={handleDbSubmit} className="space-y-4">
                        <div className="p-4 border rounded-md">
                            <h3 className="font-semibold mb-2">Step 1: Input Data</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="teamName" className="text-sm font-medium">Team Name</label>
                                    <Input id="teamName" value={teamName} onChange={e => setTeamName(e.target.value)} />
                                </div>
                                <div>
                                    <label htmlFor="teamTag" className="text-sm font-medium">Team Tag</label>
                                    <Input id="teamTag" value={teamTag} onChange={e => setTeamTag(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border rounded-md">
                            <h3 className="font-semibold mb-2">Step 2: Trigger Server Action</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Clicking this button calls the `createTestTeam` server action. This action will first verify you are an admin and then write the data to the `teams` collection in Firestore.
                            </p>
                            <Button type="submit" className="w-full" disabled={isDbSubmitting || !user}>
                                {isDbSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                                {isDbSubmitting ? 'Saving...' : 'Save to Database'}
                            </Button>
                        </div>
                    </form>

                     <div className="p-4 border rounded-md bg-muted/50">
                        <h3 className="font-semibold mb-2">How It Works</h3>
                        <p className="text-sm text-muted-foreground">
                            For a detailed explanation of the secure flow from the client to the server and into the database, please see the documentation.
                        </p>
                         <Button asChild variant="link" className="px-0">
                            <Link href="/HOW_IT_WORKS.md" target="_blank">Read the Technical Deep Dive</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
