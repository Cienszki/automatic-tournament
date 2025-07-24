"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, LogOut, UserCircle, Loader2, Copy, RefreshCw } from "lucide-react";
import { getTeams } from "@/lib/admin-actions";
import type { Team } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Separator } from "@/components/ui/separator";

export interface CaptainImpersonatorRef {
  refreshTeams: () => void;
}

export const CaptainImpersonator = React.forwardRef<CaptainImpersonatorRef, {}>((props, ref) => {
  const { user, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [impersonationTarget, setImpersonationTarget] = React.useState<Team | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const { toast } = useToast();

  const fetchTeams = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const allTeams = await getTeams();
      setTeams(allTeams.filter(team => team.testCaptainEmail && team.testCaptainPassword));
    } catch (error) {
      toast({
        title: "Error fetching teams",
        description: "Could not load the list of test teams.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  React.useImperativeHandle(ref, () => ({
    refreshTeams: fetchTeams,
  }));

  const handleImpersonateSelect = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if(team) {
        setImpersonationTarget(team);
    }
  };
  
  const handleEmailSignIn = async () => {
      setIsSigningIn(true);
      await signInWithEmail(email, password);
      setIsSigningIn(false);
  }
  
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard.`,
      variant: "default",
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Captain Impersonator & Sign-In</CardTitle>
                <CardDescription>Sign in with Google, a test account, or select a captain to view their credentials.</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={fetchTeams} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
        </CardHeader>
        <CardContent className="space-y-6">
            {user ? (
                <div className="p-4 border rounded-md bg-muted/50">
                    <div className="flex items-center justify-between">
                        <p className="truncate pr-4">Signed in as <strong>{user.displayName || user.email}</strong></p>
                        <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4"/>Sign Out</Button>
                    </div>
                </div>
            ) : (
                <div className="p-4 border rounded-md">
                    <div className="space-y-2 mb-4">
                        <Label htmlFor="email-signin">Email</Label>
                        <Input id="email-signin" type="email" placeholder="test-captain@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2 mb-4">
                        <Label htmlFor="password-signin">Password</Label>
                        <Input id="password-signin" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handleEmailSignIn} disabled={isSigningIn || !email || !password} className="flex-1">
                            {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Sign In with Email
                        </Button>
                        <Button variant="outline" onClick={signInWithGoogle} className="flex-1">
                            <LogIn className="mr-2 h-4 w-4"/>Sign In with Google
                        </Button>
                    </div>
                </div>
            )}
            
            <Separator />

          <div className="space-y-2">
              <Label>Impersonate a Test Captain</Label>
              <Select onValueChange={handleImpersonateSelect} disabled={isLoading || teams.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={
                      isLoading ? "Loading test teams..." :
                      teams.length === 0 ? "No test teams found" :
                      "Select a captain to impersonate..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                      <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                  ) : (
                      teams.map(team => (
                          <SelectItem key={team.id} value={team.id}>
                              {team.name}
                          </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!impersonationTarget} onOpenChange={(isOpen) => !isOpen && setImpersonationTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate Captain of {impersonationTarget?.name}</DialogTitle>
            <DialogDescription>
              Copy these credentials and use the form to sign in as this captain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Captain's Email</Label>
              <div className="flex items-center space-x-2">
                <Input id="email" value={impersonationTarget?.testCaptainEmail || ''} readOnly />
                <Button onClick={() => copyToClipboard(impersonationTarget?.testCaptainEmail || '', 'Email')} size="icon" variant="outline"><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Captain's Password</Label>
               <div className="flex items-center space-x-2">
                <Input id="password" value={impersonationTarget?.testCaptainPassword || ''} readOnly />
                <Button onClick={() => copyToClipboard(impersonationTarget?.testCaptainPassword || '', 'Password')} size="icon" variant="outline"><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setImpersonationTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

CaptainImpersonator.displayName = "CaptainImpersonator";
