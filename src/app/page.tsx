
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarDays, UserPlus, Megaphone } from "lucide-react";
import Link from "next/link";
import { getAnnouncements } from "@/lib/firestore";
import { Announcement } from "@/lib/definitions";
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState, useMemo } from "react";

function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [announcements]);

  useEffect(() => {
    async function fetchAnnouncements() {
      const allAnnouncements = await getAnnouncements();
      setAnnouncements(allAnnouncements);
    }
    fetchAnnouncements();
  }, []);

  if (announcements.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Megaphone className="h-6 w-6 mr-2 text-primary" />
          Latest Announcements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {sortedAnnouncements.map((announcement) => (
            <li key={announcement.id} className="p-4 bg-muted/50 rounded-lg">
              <p className="font-bold text-lg">{announcement.title}</p>
              <p className="text-foreground mt-1">{announcement.content}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Posted {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden rounded-lg bg-card p-8 text-center shadow-xl md:p-12">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          data-ai-hint="esports gaming cyber"
        >
          <source src="https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.webm" type="video/webm" />
          Your browser does not support the video tag.
        </video>
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
                Register Your Team <UserPlus className="ml-2 h-5" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/schedule">
                View Schedule <CalendarDays className="ml-2 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Announcements />

      {/* New sections */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="min-h-[200px]"></Card>
        <Card className="min-h-[200px]"></Card>
        <Card className="min-h-[200px]"></Card>
        <Card className="min-h-[200px]"></Card>
      </section>
    </div>
  );
}
