
import { Button } from "@/components/ui/button";
import { CalendarDays, UserPlus } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden rounded-lg bg-card p-8 text-center shadow-xl md:p-12">
        <Image
          src="https://placehold.co/1200x600.png"
          alt="Esports tournament promotional background"
          fill={true}
          className="object-cover"
          quality={80}
          priority
          data-ai-hint="esports tournament"
        />
        {/* Overlay to improve text readability */}
        <div className="absolute inset-0 bg-black/40 z-0" />

        <div className="relative z-10 container mx-auto px-4">
          <h1 className="text-5xl font-bold tracking-tight text-primary mb-6" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Welcome to Tournament Tracker
          </h1>
          <p className="text-xl text-white mb-8 max-w-2xl mx-auto" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
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
