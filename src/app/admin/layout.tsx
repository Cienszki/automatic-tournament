// src/app/admin/layout.tsx
import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, checkIfAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // If no user is logged in, redirect them away.
  // In a real app, you might redirect to a login page.
  if (!user) {
    redirect("/");
  }

  const isAdmin = await checkIfAdmin(user.id);

  // If the user is not an admin, show an access denied message.
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md w-full text-center shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 mr-3" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have the necessary permissions to view this page. Please
              contact a tournament administrator if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If the user is an admin, render the admin page content.
  return <>{children}</>;
}
