"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { TeamCard } from "@/components/app/TeamCard";
import { getAllTeams } from "@/lib/firestore";
import type { Team } from "@/lib/definitions";
import { useEffect, useState } from "react";

/**
 * Teams page - lists all teams registered in the tournament
 */
export default function TeamsPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { isLeague } = useTournamentType();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Load teams from Firestore
  useEffect(() => {
    const loadTeams = async () => {
      try {
        if (isLegacyTournament) {
          // Legacy Letnia data - use existing Firestore structure
          const teamsData = await getAllTeams();
          setTeams(teamsData);
        } else {
          // New tournament structure - would load from /tournaments/{id}/teams
          // For now, return empty array
          setTeams([]);
        }
      } catch (error) {
        console.error("Failed to load teams:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [isLegacyTournament]);

  if (!tournament) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Drużyny</h1>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-muted-foreground">Ładowanie drużyn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Drużyny</h1>
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              {tournament.status === 'registration' 
                ? 'Brak zarejestrowanych drużyn. Bądź pierwszy!'
                : 'Brak drużyn w tym turnieju.'}
            </p>
          </CardContent>
        </Card>
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
