
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <Settings className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Admin Panel</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Manage tournament settings, teams, and matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Admin tools and settings will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Admin | Tournament Tracker",
  description: "Tournament administration panel.",
};
