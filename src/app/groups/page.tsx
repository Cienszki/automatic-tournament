
"use client";

import { GroupTable } from "@/components/app/GroupTable";
import { Card, CardContent } from "@/components/ui/card";
import { getAllGroups, getAllTeams } from "@/lib/firestore";
import { useTranslation } from "@/hooks/useTranslation";
import type { Group, Team, GroupStanding } from "@/lib/definitions";
import { AlertTriangle, Users } from "lucide-react";
import { useState, useEffect } from "react";

async function getHydratedGroupsData(): Promise<Group[]> {
  const [groups, teams] = await Promise.all([
    getAllGroups(),
    getAllTeams()
  ]);

  const teamsMap = new Map(teams.map(team => [team.id, team]));

  const hydratedGroups = groups.map(group => {
    const hydratedStandings: { [teamId: string]: GroupStanding } = {};
    
    for (const teamId in group.standings) {
      const team = teamsMap.get(teamId);
      if (team) {
        const standing = group.standings[teamId];
        hydratedStandings[teamId] = {
          ...standing,
          draws: standing.draws || 0, // Backwards compatibility
          teamName: team.name,
          teamLogoUrl: team.logoUrl || '',
          totalMMR: team.players.reduce((sum, p) => sum + p.mmr, 0)
        };
      }
    }
    
    Object.values(hydratedStandings).forEach(standing => {
      let neustadtl = 0;
      if (standing.headToHead) {
        Object.entries(standing.headToHead).forEach(([opponentId, result]) => {
           const opponentPoints = hydratedStandings[opponentId]?.points || 0;
           if (result === 'win') {
             // Full points for wins
             neustadtl += opponentPoints;
           } else if (result === 'draw') {
             // Half points for draws
             neustadtl += opponentPoints * 0.5;
           }
        });
      }
      standing.neustadtlScore = neustadtl;
    });

    return {
      ...group,
      standings: hydratedStandings,
    };
  });

  return hydratedGroups;
}

export default function GroupStagePage() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroups() {
      const data = await getHydratedGroupsData();
      setGroups(data);
      setLoading(false);
    }
    loadGroups();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64">{t("common.loading")}</div>;
  }

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      {/* Desktop: show image banner with fixed height */}
      <Card className="hidden md:flex shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/group%20stage.png)` }} />
      </Card>
      {/* Mobile: show text banner with neon font */}
      <Card className="flex md:hidden shadow-xl text-center relative overflow-hidden h-[120px] flex-col justify-center items-center p-4 bg-black">
        <span className="text-3xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_#39ff14] font-neon-bines">
          {t("groups.title")}
        </span>
      </Card>

      {sortedGroups.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">{t("groups.notFormedYet")}</h2>
            <p className="text-muted-foreground">
              {t("groups.notFormedYetDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8">
          {sortedGroups.map((group) => (
            <GroupTable key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
