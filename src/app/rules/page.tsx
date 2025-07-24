
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, ShieldCheck, ShieldAlert, ShieldX, Clock } from "lucide-react";
import Link from "next/link";
import { MMRCalculator } from "@/components/app/rules/MMRCalculator";

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
          <section id="registration">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">1. Team Registration</h2>
            <p>Team captains are responsible for accurately registering their team and players.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>MMR Cap:</strong> The total MMR of all five players on a team must not exceed **24,000 MMR** at the time of registration.
              </li>
              <li>
                <strong>Accurate Information:</strong> All information, including player nicknames, MMR, and Steam profile URLs, must be accurate. MMR will be verified via the provided screenshots.
              </li>
              <li>
                <strong>One Team Rule:</strong> Each player may only be on one team's roster at a time.
              </li>
            </ul>
            <MMRCalculator />
          </section>

          <section id="team-status">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">2. Team Status Explained</h2>
            <p>After registration, your team will be assigned a status. You can view your team's status on your "My Team" page. It is the captain's responsibility to monitor this status.</p>
            <div className="space-y-3">
              <div className="flex items-start">
                <Clock className="h-5 w-5 mr-3 mt-1 text-yellow-500" />
                <div>
                  <strong>Pending:</strong> Your team has been successfully registered and is awaiting review by the tournament administrators.
                </div>
              </div>
              <div className="flex items-start">
                <ShieldCheck className="h-5 w-5 mr-3 mt-1 text-green-500" />
                <div>
                  <strong>Verified:</strong> Your team has been approved and is eligible to participate in the tournament.
                </div>
              _</div>
              <div className="flex items-start">
                <ShieldAlert className="h-5 w-5 mr-3 mt-1 text-orange-500" />
                <div>
                  <strong>Warning:</strong> There is an issue with your team's registration (e.g., MMR discrepancy, invalid player info). Your team is at risk of being rejected. **You must contact an administrator on Discord immediately to resolve this issue.**
                </div>
              </div>
               <div className="flex items-start">
                <ShieldX className="h-5 w-5 mr-3 mt-1 text-red-500" />
                <div>
                  <strong>Rejected / Banned:</strong> Your team has been disqualified from the tournament due to a rule violation or failure to resolve a warning.
                </div>
              </div>
            </div>
          </section>

          <section id="scheduling-matches">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">3. Scheduling Matches</h2>
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
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Rules | Tournament Tracker",
  description: "Official tournament rules for scheduling, conduct, and gameplay.",
};
