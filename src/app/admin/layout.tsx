
"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { checkIfAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = React.useState(true);

  React.useEffect(() => {
    async function checkAdminStatus() {
      if (isAuthLoading) return;
      
      if (!user) {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }
      
      const adminStatus = await checkIfAdmin(user);
      setIsAdmin(adminStatus);
      setIsCheckingAdmin(false);
    }
    checkAdminStatus();
  }, [user, isAuthLoading]);

  if (isAuthLoading || isCheckingAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="ml-4 text-xl mt-4">Checking permissions...</p>
        </div>
      </div>
    );
  }
  
  if (isAdmin) {
    return <>{children}</>;
  }

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
            You do not have the necessary permissions to view this page. Please
            contact a tournament administrator if you believe this is an error.
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
