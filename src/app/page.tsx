
import { Button } from "@/components/ui/button";
import { CalendarDays, UserPlus } from "lucide-react";
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
    </div>
  );
}
