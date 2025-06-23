
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function MyTeamPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <Users className="h-16 w-16 mx-auto text-secondary mb-4" />
          <CardTitle className="text-4xl font-bold text-secondary">My Team</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            This is your team's dashboard. View your roster, stats, and upcoming matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Team information will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "My Team | Tournament Tracker",
  description: "Manage and view your team's details.",
};
