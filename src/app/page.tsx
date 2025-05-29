
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, LayoutGrid, Shield, CalendarDays, UserPlus, ScrollText, HelpCircle, BarChart2, GitFork, Crown } from "lucide-react"; // Added Crown
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="text-center py-12 bg-card rounded-lg shadow-lg">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold tracking-tight text-primary mb-6">
            Welcome to Tournament Tracker
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your central hub for all tournament information, from registration to final scores. Stay updated, register your team, and follow the action!
          </p>
          <div className="flex justify-center space-x-4">
            <Button asChild size="lg">
              <Link href="/register">
                Register Your Team <UserPlus className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/schedule">
                View Schedule <CalendarDays className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <FeatureCard
          title="Team Registration"
          description="Easily register your team and player information through Discord."
          href="/register"
          icon={UserPlus}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Team registration"
          aiHint="gaming setup"
        />
        <FeatureCard
          title="Group Stage Standings"
          description="Follow real-time group scores and standings."
          href="/groups"
          icon={LayoutGrid}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Group standings"
          aiHint="leaderboard chart"
        />
        <FeatureCard
          title="Team Profiles"
          description="Explore detailed information about each participating team."
          href="/teams"
          icon={Shield}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Team profiles"
          aiHint="team esports"
        />
         <FeatureCard
          title="Upcoming Matches"
          description="See the schedule for upcoming games and add them to your calendar."
          href="/schedule"
          icon={CalendarDays}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Match schedule"
          aiHint="calendar schedule"
        />
         <FeatureCard
          title="Playoff Bracket"
          description="View the tournament playoff bracket as teams advance."
          href="/playoffs"
          icon={GitFork}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Playoff bracket"
          aiHint="tournament bracket"
        />
        <FeatureCard
          title="Fantasy League"
          description="Build your dream team within budget and compete for glory!"
          href="/fantasy"
          icon={Crown} 
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Fantasy league concept"
          aiHint="fantasy sports trophy"
        />
        <FeatureCard
          title="Tournament Stats"
          description="Dive into detailed player and tournament statistics."
          href="/stats"
          icon={BarChart2}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Tournament statistics"
          aiHint="data analytics"
        />
        <FeatureCard
          title="Tournament Rules"
          description="Familiarize yourself with the official tournament regulations."
          href="/rules"
          icon={ScrollText}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Tournament rules"
          aiHint="rules document"
        />
        <FeatureCard
          title="FAQ"
          description="Find answers to common questions about the tournament."
          href="/faq"
          icon={HelpCircle}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Frequently Asked Questions"
          aiHint="question mark"
        />
      </section>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  imageSrc: string;
  imageAlt: string;
  aiHint: string;
}

function FeatureCard({ title, description, href, icon: Icon, imageSrc, imageAlt, aiHint }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <Image 
        src={imageSrc} 
        alt={imageAlt}
        width={600}
        height={400}
        className="w-full h-48 object-cover"
        data-ai-hint={aiHint}
      />
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <Icon className="h-7 w-7 mr-3 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 h-12 overflow-hidden">{description}</p>
        <Button variant="outline" asChild className="w-full">
          <Link href={href}>
            Learn More <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
