
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HelpCircle, ListChecks, UserPlus, CalendarClock, ShieldQuestion, Settings, MessageSquare } from "lucide-react";

const faqSections = [
  {
    id: "general",
    title: "General Information",
    icon: HelpCircle,
    items: [
      {
        id: "gen-1",
        question: "What is this tournament all about?",
        answer: "This is the 'Jesienna Zadyma' Dota 2 tournament, a community-focused event designed for players of various skill levels to compete, improve, and have fun.",
      },
      {
        id: "gen-2",
        question: "Who are the organizers?",
        answer: "The tournament is organized by a dedicated team of community members including Cienszki, SATO, AxePerson, and vanRooD. You can find more details on the 'Rules' page.",
      },
      {
        id: "gen-3",
        question: "Is there an entry fee?",
        answer: "Information regarding entry fees (if any) will be clearly stated during the registration announcement period. Please check the main announcements or registration page.",
      },
      {
        id: "gen-4",
        question: "Are there any prizes?",
        answer: "Details about prizes, if applicable, will be announced closer to the tournament start date on our main communication channels (e.g., Discord).",
      },
    ],
  },
  {
    id: "registration",
    title: "Registration & Teams",
    icon: UserPlus,
    items: [
      {
        id: "reg-1",
        question: "How do I register my team?",
        answer: "Team captains can register their team by following the instructions on the 'Register' page. This typically involves filling out a form and potentially registering on a platform like Challonge.",
      },
      {
        id: "reg-2",
        question: "What is the deadline for registration?",
        answer: "The registration deadline is stated on the 'Rules' page and the tournament homepage. For 'Jesienna Zadyma', it's from 16.09.24 to 28.09.2024 (midnight, Polish time).",
      },
      {
        id: "reg-3",
        question: "What are the MMR restrictions for teams?",
        answer: "The sum of MMR for all 5 players in a team cannot exceed 22,000. Specific examples and verification processes are detailed on the 'Rules' page.",
      },
      {
        id: "reg-4",
        question: "How do I submit player MMR proof?",
        answer: "Captains must send screenshots of each player's MMR to designated administrators (Cienszki or AxePerson) as per the 'Rules' page instructions.",
      },
      {
        id: "reg-5",
        question: "Can we use stand-ins (substitute players)?",
        answer: "Yes, stand-ins are permitted under specific conditions outlined in the 'Rules' page, including MMR limits and ensuring the stand-in is not part of another active team. Captains must verify stand-ins with administration.",
      },
      {
        id: "reg-6",
        question: "What if a player on my team is uncalibrated?",
        answer: "Uncalibrated players will be assessed individually by the administration based on their match history to determine an appropriate MMR for the tournament.",
      },
    ],
  },
  {
    id: "gameplay",
    title: "Gameplay & Rules",
    icon: ShieldQuestion,
    items: [
      {
        id: "game-1",
        question: "What is the tournament format?",
        answer: "The tournament consists of a Swiss-system group stage (BO1 matches) followed by a double-elimination playoff bracket (BO3 for Winners Bracket, BO1 then BO3 for Losers Bracket). Full details are on the 'Rules' page.",
      },
      {
        id: "game-2",
        question: "What are the match lobby settings?",
        answer: "Specific lobby settings (Mode: Captains Mode, Server: Europe West/Austria, Delay: 5 mins, League: Jesienna Zadyma, etc.) are detailed on the 'Rules' page.",
      },
      {
        id: "game-3",
        question: "What is the policy on smurfing or cheating?",
        answer: "Smurfing, cheating, using external programs, or exploiting bugs is strictly prohibited and will result in disqualification and potential future bans. Refer to the 'Rules' page for a full list of prohibited actions.",
      },
      {
        id: "game-4",
        question: "What is the code of conduct for players?",
        answer: "All participants are expected to maintain a positive attitude, show respect to opponents and organizers, and uphold fair play. Unsportsmanlike conduct can lead to penalties, as detailed in the 'Rules' page.",
      },
      {
        id: "game-5",
        question: "How are pauses handled during matches?",
        answer: "Pausing is allowed as per in-game rules. Abusing the pause system (e.g., pausing during critical moments like teamfights) is considered unsportsmanlike and can lead to warnings or penalties.",
      },
    ],
  },
  {
    id: "schedule",
    title: "Schedule & Matches",
    icon: CalendarClock,
    items: [
      {
        id: "sch-1",
        question: "Where can I find the match schedule?",
        answer: "The full match schedule, including deadlines for each round, is available on the 'Schedule' page and also outlined in the 'Rules' page.",
      },
      {
        id: "sch-2",
        question: "What if teams cannot agree on a match time?",
        answer: "If teams cannot agree, the default match time is 20:00 (Polish time) on the last day of the designated round period. Failure to appear results in a forfeit.",
      },
      {
        id: "sch-3",
        question: "What is the punctuality policy?",
        answer: "A 15-minute grace period is allowed for tardiness. Further delays can result in game or match forfeits, as specified in the 'Rules' page.",
      },
      {
        id: "sch-4",
        question: "How are match results reported?",
        answer: "The captain of the winning team is responsible for promptly reporting the match result on the designated platform (e.g., Challonge) after the match concludes.",
      },
    ],
  },
  {
    id: "technical",
    title: "Technical & Support",
    icon: Settings,
    items: [
      {
        id: "tech-1",
        question: "What happens if there's a server crash or game bug?",
        answer: "Rehosting a game is allowed within the first 5 minutes only if both captains agree and it's due to critical game bugs or server issues. Refer to the 'Rules' page for specifics.",
      },
      {
        id: "tech-2",
        question: "Can players stream their own matches?",
        answer: "Yes, players are allowed to stream their own matches. However, the administration is not responsible for any issues arising from opponents watching the stream (stream sniping). A 10-minute delay is recommended.",
      },
      {
        id: "tech-3",
        question: "Who do I contact for issues or questions not covered here?",
        answer: "For any issues or questions, please contact one of the tournament administrators (Cienszki, SATO, AxePerson, vanRooD) through the official tournament Discord server.",
      },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    icon: MessageSquare,
    items: [
      {
        id: "com-1",
        question: "What is the main channel for tournament announcements?",
        answer: "All official announcements, schedule updates, and important information will be posted on our designated Discord server channels. Team captains are responsible for staying updated.",
      },
      {
        id: "com-2",
        question: "How do team captains contact each other to schedule matches?",
        answer: "Team captains should use the provided Discord channels or direct messages on Discord to communicate with opposing team captains for scheduling matches.",
      },
    ],
  }
];

export default function FaqPage() {
  return (
    <div className="space-y-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <HelpCircle className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Frequently Asked Questions</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Find answers to common questions about the 'Jesienna Zadyma' tournament.
          </CardDescription>
        </CardHeader>
      </Card>

      {faqSections.map((section) => (
        <Card key={section.id} className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-accent flex items-center">
              <section.icon className="h-7 w-7 mr-3" />
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            {section.items.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {section.items.map((item) => (
                  <AccordionItem value={item.id} key={item.id}>
                    <AccordionTrigger className="text-lg hover:no-underline text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="text-muted-foreground">No questions in this section yet.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export const metadata = {
  title: "FAQ | Tournament Tracker",
  description: "Frequently asked questions about the 'Jesienna Zadyma' tournament.",
};

