
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";
import Link from "next/link";

export default function RulesPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/rules.png)` }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="relative z-10">
           <ScrollText className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Tournament Rules
          </h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
            Please read the rules carefully to ensure fair play and a smooth tournament experience for all participants.
          </p>
        </div>
      </Card>

      <Card>
        <CardContent className="p-6 md:p-8 space-y-6 prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl 2xl:prose-2xl mx-auto dark:prose-invert">
          <section id="scheduling-matches">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">1. Scheduling Matches</h2>
            <p>Captains are responsible for scheduling their matches with their opponents for each round. Communication should primarily take place on the official tournament Discord server.</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Official Scheduling Tool:</strong> Captains must use the scheduling tool on their "My Team" page on this website. This tool allows one captain to propose a time and the opposing captain to accept or reject it.
              </li>
              <li>
                <strong>Round Deadlines:</strong> Each round will have an official deadline set by the administrators. All matches in a round must be completed before this deadline.
              </li>
              <li>
                <strong>Default Match Time:</strong> To prevent delays, every match is automatically assigned a unique, non-conflicting **Default Match Time**. This time is visible on your "My Team" page.
              </li>
              <li>
                <strong>Mutual Agreement:</strong> Captains are strongly encouraged to communicate and agree on a match time that works for both teams. Any mutually agreed-upon time will override the default time. The agreement must be finalized through the "Propose" and "Accept" functions on the website.
              </li>
              <li>
                <strong>Failure to Schedule:</strong> If the captains do not agree on a custom time before the round's deadline, the match is **automatically and irrevocably scheduled for its Default Match Time.**
              </li>
              <li>
                <strong>Punctuality and Forfeits:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>A 15-minute grace period is allowed for being late to a scheduled match (either custom or default).</li>
                  <li>If a team does not show up within 15 minutes, they will receive a forfeit loss for the match.</li>
                  <li>If **both** teams fail to show up for their scheduled match (either custom or default), both teams will receive a forfeit loss.</li>
                </ul>
              </li>
            </ol>
            <p className="font-bold text-accent">It is the captains' responsibility to be proactive. Inaction will lead to a match being played at the default time or a forfeit.</p>
          </section>

          {/* ... Other sections from your original ruleset would go here ... */}

        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Rules | Tournament Tracker",
  description: "Official tournament rules for scheduling, conduct, and gameplay.",
};
