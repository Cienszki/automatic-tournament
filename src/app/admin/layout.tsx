
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, checkIfAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTestingAsAdmin, setIsTestingAsAdmin] = React.useState(false);
  
  React.useEffect(() => {
    async function checkAdminStatus() {
      const user = await getCurrentUser();
      if (!user) {
        // User not logged in, redirect to home page.
        router.push("/");
        return;
      }
      
      const adminStatus = await checkIfAdmin(user.id);
      setIsAdmin(adminStatus);
      setIsLoading(false);
    }
    checkAdminStatus();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="ml-4 text-xl mt-4">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If user is a real admin or is testing as one, show the content.
  if (isAdmin || isTestingAsAdmin) {
    return <>{children}</>;
  }

  // If the user is not an admin, show an access denied message with the test button.
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
          <Button onClick={() => setIsTestingAsAdmin(true)}>
            Simulate Admin Access (For Testing)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
