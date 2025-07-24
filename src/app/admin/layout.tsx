
"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { checkIfAdmin } from "@/lib/auth"; // Corrected import

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: isAuthLoading, signInWithGoogle } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // No user can be determined until the auth provider is done loading.
    if (isAuthLoading) {
      return;
    }

    // If there is no user after loading, we don't need to check for admin status.
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // User is present, now we can check their admin status.
    checkIfAdmin(user)
      .then(setIsAdmin)
      .catch(() => {
        setAuthError("Could not verify admin status. Please try again later.");
        setIsAdmin(false);
      });

  }, [user, isAuthLoading]);

  const handleLogin = async () => {
    try {
        await signInWithGoogle();
    } catch (error) {
        setAuthError("Failed to sign in with Google. Please try again.");
    }
  }

  // Use the AuthProvider's loading state as the single source of truth.
  // We also wait until the isAdmin check is complete (isAdmin is not null).
  if (isAuthLoading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="ml-4 text-xl mt-4">Checking permissions...</p>
        </div>
      </div>
    );
  }
  
  // After loading, if there's no user, show the login prompt.
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md w-full text-center shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center justify-center">
              <LogIn className="h-8 w-8 mr-3" />
              Admin Access Required
            </CardTitle>
             <CardDescription>
              Please log in with your authorized Google account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLogin} size="lg">
              Sign in with Google
            </Button>
            {authError && <p className="text-sm font-medium text-destructive">{authError}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // If a user is present and they are an admin, show the content.
  if (isAdmin) {
    return <>{children}</>;
  }

  // If a user is present but not an admin, deny access.
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="max-w-md w-full text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 mr-3" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You are logged in, but you do not have the necessary permissions to view this page.
          </p>
          <p className="text-sm text-muted-foreground">
            Your User ID is: <code className="font-mono bg-muted p-1 rounded-md">{user.uid}</code>
          </p>
          <Button asChild>
            <Link href="/">
              Go to Homepage
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
