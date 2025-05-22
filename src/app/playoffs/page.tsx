
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PlayoffsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-4 w-fit mb-4">
            <Construction className="h-12 w-12" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Play-off Bracket</CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-2">
            The excitement is building!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold text-foreground mb-2">Coming Soon!</p>
          <p className="text-muted-foreground">
            The play-off bracket will be available here once the group stages are complete.
            Stay tuned for the thrilling final matches of the tournament!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Playoffs | Tournament Tracker",
  description: "Play-off bracket for the tournament - coming soon."
}
