
"use client";

import { TeamCard } from "@/components/app/TeamCard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllTeams } from "@/lib/firestore";
import type { Team } from "@/lib/definitions";
import { Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, useState } from "react";

export default function TeamsPage() {
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await getAllTeams();
        setTeams(teamsData);
      } catch (error) {
        console.error("Failed to load teams:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, []);

  if (loading) {
    return <div className="text-center py-10">{t('common.loading')}...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/teams.png)` }} 
          data-ai-hint="neon fantasy space"
        />
      </Card>

      {teams.length === 0 ? (
        <p className="text-center text-muted-foreground text-xl py-10">
          {t('teams.noTeamsRegistered')}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
