
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

export default function RulesPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
           <ScrollText className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Tournament Rules</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Please read all rules carefully to ensure fair play and a smooth tournament experience.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-6 md:p-8 space-y-6 prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl 2xl:prose-2xl mx-auto dark:prose-invert">
          <section id="general-rules">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">1. General Rules</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Eligibility:</strong> All participants must have a valid Discord account and Steam account. Players must meet any specified regional or skill level requirements.</li>
              <li><strong>Team Composition:</strong> Teams must consist of 5 core players. Roster changes after the registration deadline are not permitted without admin approval.</li>
              <li><strong>Fair Play:</strong> All players are expected to compete to the best of their ability. Cheating, exploiting bugs, or any form of unfair advantage is strictly prohibited.</li>
              <li><strong>Sportsmanship:</strong> Respect for opponents, teammates, and tournament staff is mandatory. Toxic behavior, harassment, or discrimination will not be tolerated.</li>
              <li><strong>Communication:</strong> Official communication will be done through the tournament Discord server. Team captains are responsible for staying informed.</li>
            </ol>
          </section>

          <section id="game-specific-rules">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">2. Game Specific Rules (Dota 2)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Game Mode:</strong> Captains Mode (CM) unless otherwise specified.</li>
              <li><strong>Server:</strong> To be determined by admins, typically based on the lowest average ping for both teams. Default servers are US East or EU West.</li>
              <li><strong>Side Choice/Draft Order:</strong> Determined by coin toss or mutual agreement. In series, the loser of the previous game typically chooses.</li>
              <li><strong>Pauses:</strong> Each team is allowed a limited amount of tactical pause time per game (e.g., 5 minutes). Disconnect pauses are handled by admins.</li>
              <li><strong>Bugs/Exploits:</strong> Known game-breaking bugs or exploits are not allowed. If unsure, contact an admin.</li>
            </ol>
          </section>

          <section id="player-conduct">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">3. Player Conduct</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Punctuality:</strong> Teams must be ready at the scheduled match time. Delays may result in penalties.</li>
              <li><strong>Account Sharing:</strong> Playing on another person's account is prohibited.</li>
              <li><strong>Streaming:</strong> Players may stream their POV with a delay (e.g., 5 minutes) unless specified otherwise by admins.</li>
              <li><strong>Admin Instructions:</strong> All players must follow the instructions of tournament administrators.</li>
            </ol>
          </section>

          <section id="match-procedures">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">4. Match Procedures</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Lobby Creation:</strong> The higher-seeded team (or as designated by admins) is typically responsible for creating the game lobby.</li>
              <li><strong>Match Reporting:</strong> After each match, the winning team's captain must report the score on the designated platform/channel.</li>
              <li><strong>Disputes:</strong> Any disputes or rule clarifications should be brought to an admin immediately. Admin decisions are final.</li>
              <li><strong>Forfeits:</strong> If a team fails to show up within the grace period (e.g., 15 minutes), they may forfeit the match.</li>
            </ol>
          </section>

          <section id="penalties">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">5. Penalties</h2>
            <p>Violation of rules may result in penalties including but not limited to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Verbal warnings</li>
              <li>Loss of draft priority</li>
              <li>Game forfeit</li>
              <li>Match forfeit</li>
              <li>Disqualification from the tournament</li>
              <li>Temporary or permanent bans from future events</li>
            </ul>
            <p className="mt-2">The severity of the penalty will be determined by tournament administrators based on the offense.</p>
          </section>

          <section id="tournament-format">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">6. Tournament Format</h2>
            <p>Details on the tournament format (e.g., group stage, playoffs, bracket type, match series format) will be announced on the main tournament page or Discord server.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Group Stage: Round Robin or GSL-style, with top teams advancing.</li>
              <li>Playoffs: Single or Double Elimination bracket.</li>
              <li>Match Format: Best of 1 (Bo1), Best of 3 (Bo3), or Best of 5 (Bo5) for finals.</li>
            </ul>
          </section>
          
          <p className="text-center text-muted-foreground pt-4">
            Tournament administrators reserve the right to modify rules as needed for the integrity of the competition. All decisions made by administrators are final.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Rules | Tournament Tracker",
  description: "Official rules and regulations for the tournament.",
};
