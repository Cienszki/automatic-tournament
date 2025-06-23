
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, BarChartHorizontal } from "lucide-react";
import Link from "next/link";

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card className="hover:bg-muted/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <BarChartHorizontal className="mr-2" />
                  Manage Standings
                </CardTitle>
                <CardDescription>
                  Input or edit match results to update group standings and playoff brackets.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href="/admin/standings">Go to Standings</Link>
                </Button>
              </CardFooter>
            </Card>
             <Card className="hover:bg-muted/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <Settings className="mr-2" />
                  Other Settings
                </CardTitle>
                <CardDescription>
                  Placeholder for other tournament administration settings and tools.
                </CardDescription>
              </CardHeader>
               <CardFooter>
                  <Button asChild className="w-full" disabled>
                    <Link href="#">Coming Soon</Link>
                  </Button>
              </CardFooter>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Admin | Tournament Tracker",
  description: "Tournament administration panel.",
};
