"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardContent } from '@/components/ui/card';
import { GroupTable } from "@/components/app/GroupTable";
import { getAllGroups, getAllTeams } from "@/lib/firestore";
import type { Group, GroupStanding } from "@/lib/definitions";
import { LayoutGrid, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from "react";

// Hydrate groups with team data
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
          draws: standing.draws || 0,
          teamName: team.name,
          teamLogoUrl: team.logoUrl || '',
          totalMMR: team.players.reduce((sum, p) => sum + p.mmr, 0)
        };
      }
    }
    
    // Calculate Neustadtl score
    Object.values(hydratedStandings).forEach(standing => {
      let neustadtl = 0;
      if (standing.headToHead) {
        Object.entries(standing.headToHead).forEach(([opponentId, result]) => {
           const opponentPoints = hydratedStandings[opponentId]?.points || 0;
           if (result === 'win') {
             neustadtl += opponentPoints;
           } else if (result === 'draw') {
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

/**
 * Groups page - shows group stage standings (MMR tournaments only)
 */
export default function GroupsPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { isMmrLimited } = useTournamentType();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroups() {
      try {
        if (isLegacyTournament) {
          const data = await getHydratedGroupsData();
          setGroups(data);
        } else {
          // New tournament structure - would load from /tournaments/{id}/groups
          setGroups([]);
        }
      } catch (error) {
        console.error("Failed to load groups:", error);
      } finally {
        setLoading(false);
      }
    }
    loadGroups();
  }, [isLegacyTournament]);

  if (!tournament) return null;

  // This page is only for MMR-limited tournaments
  if (!isMmrLimited) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Strona niedostępna</h1>
        <p className="text-muted-foreground">
          Ten turniej nie posiada fazy grupowej.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Faza grupowa</h1>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-muted-foreground">Ładowanie grup...</p>
        </div>
      </div>
    );
  }

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutGrid className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Faza grupowa</h1>
      </div>

      {/* Groups */}
      {sortedGroups.length === 0 ? (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Grupy nie zostały jeszcze utworzone</h2>
            <p className="text-muted-foreground">
              Sprawdź ponownie po zakończeniu rejestracji.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {sortedGroups.map((group) => (
            <GroupTable key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
