
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";

export default function PickEmPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <ClipboardCheck className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Pick'em Challenge</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Make your predictions for the tournament and earn points!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            The Pick'em challenge will be available here soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Pick'em | Tournament Tracker",
  description: "Participate in the Pick'em challenge.",
};
