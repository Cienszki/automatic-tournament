
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const faqItems = [
  {
    id: "faq-1",
    question: "How do I register my team?",
    answer: "You can register your team by navigating to the 'Register' page and filling out the form. Ensure you have your Discord login ready and all player information, including Steam profile links and MMR screenshots.",
  },
  {
    id: "faq-2",
    question: "What is the deadline for registration?",
    answer: "The registration deadline will be announced on the tournament homepage and our Discord server. Please check these regularly for updates.",
  },
  {
    id: "faq-3",
    question: "Where can I find the match schedule?",
    answer: "The match schedule is available on the 'Schedule' page. Upcoming matches for the next 7 days will be listed there. You can also add matches to your Google Calendar.",
  },
  {
    id: "faq-4",
    question: "How are group stage standings calculated?",
    answer: "Group stage standings are based on points awarded for wins and losses. Specific point distributions will be detailed in the tournament rules. Scores are typically updated via the OpenDota API (though currently simulated).",
  },
  {
    id: "faq-5",
    question: "What if I need to change a player on my roster?",
    answer: "Roster changes after the registration deadline are generally not permitted. In exceptional circumstances, please contact a tournament administrator through Discord to discuss your situation.",
  },
  {
    id: "faq-6",
    question: "What is the policy on cheating or unsportsmanlike conduct?",
    answer: "We have a zero-tolerance policy for cheating and unsportsmanlike conduct. Please refer to the 'Rules' page for detailed information on player conduct and potential penalties.",
  },
  {
    id: "faq-7",
    question: "How do I report match results?",
    answer: "The winning team's captain is responsible for reporting match results through the designated channel on our Discord server. Further instructions will be provided before the tournament starts.",
  },
];

export default function FaqPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <HelpCircle className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Frequently Asked Questions</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Find answers to common questions about the tournament.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-6 md:p-8">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item) => (
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
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "FAQ | Tournament Tracker",
  description: "Frequently asked questions about the tournament.",
};
