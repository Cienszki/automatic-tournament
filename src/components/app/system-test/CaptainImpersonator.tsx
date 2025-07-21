"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, LogOut, UserCircle } from "lucide-react";
import { User } from "firebase/auth";

// This is a simplified mock. In a real scenario, you might fetch these from a test config.
const testCaptains = [
  { uid: "test_captain_1", name: "Captain of Test Team 1" },
  { uid: "test_captain_2", name: "Captain of Test Team 2" },
  { uid: "test_captain_3", name: "Captain of Test Team 3" },
];

interface CaptainImpersonatorProps {
    currentUser: User | null;
    signIn: (provider: any) => Promise<void>;
    signOut: () => void;
}

export function CaptainImpersonator({ currentUser, signIn, signOut }: CaptainImpersonatorProps) {
  
  const handleImpersonate = (uid: string) => {
    // In a real testing environment, this would involve a custom auth flow.
    // For this sandbox, we'll simulate it by logging a message.
    // The actual user switching will be handled by the test user logging in.
    alert(`To impersonate this user, please sign out and sign in with the test account associated with UID: ${uid}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Captain Impersonator</CardTitle>
        <CardDescription>Simulate being a specific team captain to test their view of the dashboard.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-md bg-muted/50">
            {currentUser ? (
                <div className="flex items-center justify-between">
                    <p>Signed in as <strong>{currentUser.displayName}</strong> ({currentUser.uid})</p>
                    <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4"/>Sign Out</Button>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                   <p className="text-destructive font-semibold">You are not signed in.</p>
                    <Button onClick={signIn}><LogIn className="mr-2 h-4 w-4"/>Sign In with Google</Button>
                </div>
            )}
        </div>
        <div className="flex items-center gap-4">
            <UserCircle className="h-5 w-5" />
            <Select onValueChange={handleImpersonate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a captain to impersonate..." />
              </SelectTrigger>
              <SelectContent>
                {testCaptains.map(captain => (
                  <SelectItem key={captain.uid} value={captain.uid}>{captain.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>
      </CardContent>
    </Card>
  );
}
