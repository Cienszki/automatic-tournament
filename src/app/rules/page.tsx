
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

export default function RulesPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
           <ScrollText className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Tournament Rules & Regulations</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Please read all rules carefully to ensure fair play and a smooth tournament experience for all participants.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-6 md:p-8 space-y-6 prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl 2xl:prose-2xl mx-auto dark:prose-invert">
          <section id="introduction">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">1. Introduction & Acceptance</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>1.1. Acceptance of Rules:</strong> By participating in this tournament, all players and teams agree to abide by these official rules and regulations, as well as any decisions made by tournament administrators.</li>
              <li><strong>1.2. Rule Changes:</strong> Tournament administrators reserve the right to amend, modify, or supplement these rules at any time to ensure fair play and the integrity of the competition. All changes will be communicated through official channels.</li>
              <li><strong>1.3. Spirit of the Game:</strong> All participants are expected to compete in the spirit of fair play, honesty, and respect towards opponents, teammates, and tournament staff.</li>
            </ol>
          </section>

          <section id="eligibility-registration">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">2. Eligibility & Registration</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>2.1. Player Eligibility:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Participants must have a valid Discord account and Steam account with Dota 2.</li>
                  <li>Players must meet any specified regional, age, or skill level requirements announced for the tournament.</li>
                  <li>Accounts used must be the player's main gaming account and not be subject to any current game bans (e.g., VAC bans relevant to Dota 2).</li>
                </ul>
              </li>
              <li><strong>2.2. Team Composition:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Teams must consist of five (5) core players. Substitutes may be allowed if specified in tournament announcements, and their registration must follow official procedures.</li>
                  <li>Each player may only compete for one team in the tournament.</li>
                </ul>
              </li>
              <li><strong>2.3. Registration Process:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>All teams must register through the official registration page/form before the specified deadline.</li>
                  <li>Team captains are responsible for ensuring all player information (nicknames, Steam IDs, MMR proof, etc.) is accurate and complete.</li>
                  <li>Incomplete or inaccurate registrations may be rejected.</li>
                </ul>
              </li>
              <li><strong>2.4. Roster Changes:</strong> Roster changes after the registration deadline are generally not permitted. In exceptional circumstances (e.g., medical emergencies), team captains must contact tournament administrators for approval. Unauthorized roster changes may lead to disqualification.</li>
            </ol>
          </section>

          <section id="game-specific-rules">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">3. Game Specific Rules (Dota 2)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>3.1. Game Version:</strong> All matches will be played on the latest official live patch of Dota 2, unless otherwise specified by administrators.</li>
              <li><strong>3.2. Game Mode:</strong> The default game mode is Captains Mode (CM), unless stated otherwise for specific stages of the tournament.</li>
              <li><strong>3.3. Server Selection:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>The server will be determined by mutual agreement between team captains.</li>
                  <li>If no agreement can be reached, a server will be chosen to provide the most balanced ping for both teams (e.g., US East, EU West). Administrators will have the final say in server disputes.</li>
                </ul>
              </li>
              <li><strong>3.4. Side Choice & Draft Order:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>For the first game of a series, side choice (Radiant/Dire) and draft order (1st/2nd pick) will be determined by a coin toss or by the higher-seeded team, as specified in tournament announcements.</li>
                  <li>In subsequent games of a series, the loser of the previous game typically gets to choose side or draft order.</li>
                </ul>
              </li>
              <li><strong>3.5. Pauses:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Each team is allowed a limited amount of tactical pause time per game (e.g., 5 minutes total). This must be announced in all-chat (e.g., "pp" or "tactical pause").</li>
                  <li>Disconnect pauses ("dc pause") can be initiated if a player disconnects. The game should remain paused for a reasonable duration (e.g., up to 10 minutes) to allow the player to reconnect. Opponents must be notified.</li>
                  <li>Abuse of the pause function may result in penalties.</li>
                </ul>
              </li>
              <li><strong>3.6. Bugs & Exploits:</strong> The intentional use of any known game-breaking bugs or exploits is strictly prohibited. If a bug occurs, players should pause the game immediately and inform an administrator. Unintentional occurrences will be reviewed by admins.</li>
              <li><strong>3.7. Third-Party Software:</strong> The use of any third-party software, scripts, or applications that provide an unfair competitive advantage (e.g., map hacks, auto-aim, etc.) is strictly forbidden and will result in immediate disqualification and potential future bans.</li>
            </ol>
          </section>

          <section id="player-conduct">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">4. Player & Team Conduct</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>4.1. Professionalism & Sportsmanship:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>All players and teams must exhibit good sportsmanship and maintain a professional attitude throughout the tournament.</li>
                  <li>Respect for opponents, teammates, casters, and tournament staff is mandatory.</li>
                  <li>Toxic behavior, including but not limited to flaming, excessive taunting, offensive language, harassment, or discrimination (based on race, gender, religion, sexual orientation, etc.) will not be tolerated.</li>
                </ul>
              </li>
              <li><strong>4.2. Punctuality:</strong> Teams are expected to be ready in the game lobby at least 10 minutes before the scheduled match time. Delays may result in penalties, including game or match forfeits, at the discretion of administrators. A grace period (e.g., 10-15 minutes) may be allowed if communicated to admins.</li>
              <li><strong>4.3. Communication:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Official tournament communication will primarily occur through the designated Discord server. Team captains are responsible for staying informed of all announcements and schedules.</li>
                  <li>In-game communication should be respectful. All-chat should be limited to essential game-related communication (e.g., "gg", "pp", server issues).</li>
                </ul>
              </li>
              <li><strong>4.4. Account Sharing & Smurfing:</strong> Playing on another person's account or using an account that does not accurately reflect the player's skill level (smurfing) to gain an unfair advantage is strictly prohibited.</li>
              <li><strong>4.5. Streaming:</strong> Players may be permitted to stream their Point-Of-View (POV) during matches, but typically with a mandatory stream delay (e.g., 5 minutes) to prevent stream sniping. Specific streaming rules will be announced.</li>
              <li><strong>4.6. Admin Instructions:</strong> All players and teams must adhere to the instructions and decisions of tournament administrators. Admin decisions are final.</li>
            </ol>
          </section>

          <section id="match-procedures">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">5. Match Procedures</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>5.1. Lobby Creation:</strong> The higher-seeded team, or as designated by administrators or pre-determined schedule, is typically responsible for creating the game lobby with the correct settings (game mode, server, password if required). Lobby details must be communicated to the opposing team captain.</li>
              <li><strong>5.2. Pre-Match Setup:</strong> Both teams must confirm their readiness before the game starts. Ensure all players are connected and settings are correct.</li>
              <li><strong>5.3. Match Reporting:</strong> After each match or series, the winning team's captain is responsible for reporting the score on the designated platform/channel (e.g., Discord, tournament website) within a specified timeframe. Screenshots of the end-game scoreboard may be required.</li>
              <li><strong>5.4. Disputes & Issues:</strong> Any disputes, rule clarifications, or technical issues during a match should be brought to an administrator's attention immediately. If possible, pause the game. Do not continue playing if a significant issue arises that could affect the outcome.</li>
              <li><strong>5.5. Forfeits:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>If a team fails to show up within the grace period (e.g., 15 minutes past scheduled start time) without prior communication to admins, they may forfeit the match.</li>
                  <li>A team may choose to forfeit a match. This must be communicated to the opposing captain and an administrator.</li>
                  <li>If a team forfeits multiple matches, they may be removed from the tournament.</li>
                </ul>
              </li>
              <li><strong>5.6. Disconnects & Reconnects:</strong> If a player disconnects, the game should be paused immediately (see rule 3.5). The player should attempt to reconnect. If a player cannot reconnect within a reasonable time (e.g., 10 minutes), the match may continue 4v5 or be subject to admin review, depending on specific tournament rules.</li>
            </ol>
          </section>

          <section id="penalties">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">6. Cheating & Penalties</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>6.1. Definition of Cheating:</strong> Cheating includes, but is not limited to, ghosting (receiving outside information about the opponent's gameplay), stream sniping, using unauthorized third-party software, match-fixing, colluding with opponents, or any other action designed to gain an unfair advantage.</li>
              <li><strong>6.2. Investigation:</strong> Tournament administrators reserve the right to investigate any claims of cheating or rule violations. Teams and players are expected to cooperate fully with such investigations.</li>
              <li><strong>6.3. Penalties for Violations:</strong> Violation of tournament rules or engaging in unsportsmanlike conduct may result in penalties, applied at the discretion of tournament administrators. These penalties can include, but are not limited to:
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Verbal warnings</li>
                  <li>Loss of draft priority (e.g., side choice or pick order)</li>
                  <li>Game forfeit</li>
                  <li>Match forfeit</li>
                  <li>Player suspension for one or more matches</li>
                  <li>Team disqualification from the tournament</li>
                  <li>Temporary or permanent bans from future events organized by the same entity</li>
                </ul>
              </li>
              <li><strong>6.4. Severity of Penalties:</strong> The severity of the penalty will be determined by tournament administrators based on the nature, severity, and repetition of the offense. All decisions regarding penalties are final.</li>
            </ol>
          </section>

          <section id="tournament-format-schedule">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">7. Tournament Format & Schedule</h2>
            <p>Specific details on the tournament format (e.g., group stage format, playoff bracket type, match series format - Bo1, Bo3, Bo5) and the full schedule will be announced on the main tournament page, schedule page, and/or the official Discord server.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>7.1. Group Stage:</strong> If applicable, details on how teams advance from group stages (e.g., points system, tie-breaker rules) will be clearly outlined.</li>
              <li><strong>7.2. Playoffs:</strong> If applicable, the playoff bracket (Single Elimination, Double Elimination) will be displayed and rules for progression explained.</li>
              <li><strong>7.3. Match Format:</strong> The format for matches (e.g., Best of 1, Best of 3, Best of 5 for finals) will be specified for each stage of the tournament.</li>
              <li><strong>7.4. Schedule Adherence:</strong> Teams are responsible for knowing their match schedule and being prepared on time. Changes to the schedule will be communicated officially by administrators.</li>
            </ul>
          </section>
          
          <p className="text-center text-muted-foreground pt-4 italic">
            Tournament administrators reserve the right to make final decisions on all matters not explicitly covered in these rules or in unforeseen circumstances, always with the goal of maintaining fair competition and the integrity of the tournament. Good luck to all participants!
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

    