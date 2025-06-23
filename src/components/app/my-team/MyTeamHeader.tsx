
'use client';

import Image from "next/image";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Team } from "@/lib/definitions";

interface MyTeamHeaderProps {
  team: Team;
}

export function MyTeamHeader({ team }: MyTeamHeaderProps) {
  return (
    <Card className="shadow-xl overflow-hidden">
      <CardHeader className="p-6 bg-muted/30">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <Image
            src={team.logoUrl || `https://placehold.co/128x128.png`}
            alt={`${team.name} Logo`}
            width={100}
            height={100}
            className="rounded-lg border-2 border-card shadow-md"
            data-ai-hint="team logo"
          />
          <div className="flex-1">
            <CardTitle className="text-4xl text-secondary">{team.name}</CardTitle>
            <CardDescription className="mt-1 italic text-base">"{team.motto}"</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
