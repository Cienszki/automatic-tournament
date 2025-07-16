
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, BarChartHorizontal, Users, UserCheck, Trophy, Megaphone, ShieldEllipsis } from "lucide-react";
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="hover:bg-muted/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <ShieldEllipsis className="mr-2" />
                  Tournament State
                </CardTitle>
                <CardDescription>
                  Advance the tournament stage, from pre-season to the final winner.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href="/admin/management">Manage State</Link>
                </Button>
              </CardFooter>
            </Card>
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
                  <Users className="mr-2" />
                  Team Management
                </CardTitle>
                <CardDescription>
                  Verify, edit, or disqualify registered teams. Manually adjust player data.
                </CardDescription>
              </CardHeader>
               <CardFooter>
                  <Button asChild className="w-full" disabled>
                    <Link href="#">Coming Soon</Link>
                  </Button>
              </CardFooter>
            </Card>
             <Card className="hover:bg-muted/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <UserCheck className="mr-2" />
                  Stand-in Approvals
                </CardTitle>
                <CardDescription>
                  Review and approve or deny stand-in requests submitted by team captains.
                </CardDescription>
              </CardHeader>
               <CardFooter>
                  <Button asChild className="w-full" disabled>
                    <Link href="#">Coming Soon</Link>
                  </Button>
              </CardFooter>
            </Card>
             <Card className="hover:bg-muted/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <Trophy className="mr-2" />
                  Pick'em & Fantasy
                </CardTitle>
                <CardDescription>
                  Set deadlines, download Pick'em data, and manage fantasy league settings.
                </CardDescription>
              </CardHeader>
               <CardFooter>
                  <Button asChild className="w-full" disabled>
                    <Link href="#">Coming Soon</Link>
                  </Button>
              </CardFooter>
            </Card>
             <Card className="hover:bg-muted/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <Megaphone className="mr-2" />
                  Announcements
                </CardTitle>
                <CardDescription>
                  Create and display site-wide announcements or update banners.
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
