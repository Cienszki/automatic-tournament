"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { TeamCard as LegacyTeamCard } from "@/components/app/TeamCard";
import { TeamCard as PDLTeamCard } from "@/components/pdl/TeamCard";
import { getAllTeams } from "@/lib/firestore";
import type { Team } from "@/lib/definitions";
import { useEffect, useState } from "react";
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Teams page - lists all teams registered in the tournament
 */
export default function TeamsPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { isLeague } = useTournamentType();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate mock data for team stats
  const generateMockStats = (teamId: string, teamName: string) => {
    // Seed random based on team name for consistency
    const seed = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (min: number, max: number) => {
      const x = Math.sin(seed + min) * 10000;
      return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
    };

    const wins = random(3, 10);
    const losses = random(0, 5);
    const draws = random(0, 2);
    const totalMatches = wins + losses + draws;
    const points = wins * 2 + draws;
    
    // Generate recent form (last 5 matches)
    const recentForm: ('W' | 'L' | 'D')[] = [];
    for (let i = 0; i < Math.min(5, totalMatches); i++) {
      const r = random(i, i + 100) % 10;
      recentForm.push(r < 6 ? 'W' : r < 8 ? 'D' : 'L');
    }
    
    return { wins, losses, draws, points, recentForm };
  };

  // Generate division ranking (1-based position in division)
  const generateDivisionRanking = (teamId: string, division: string) => {
    const seed = teamId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (seed % 8) + 1; // Ranks 1-8
  };

  // Mock next opponent data
  const mockNextOpponents: Record<string, { name: string; id: string }> = {};
  const mockHeadToHead: Record<string, { wins: number; losses: number; draws: number }> = {};

  // Load teams from Firestore
  useEffect(() => {
    const loadTeams = async () => {
      try {
        if (isLegacyTournament) {
          // Legacy Letnia data - use existing Firestore structure
          const teamsData = await getAllTeams();
          setTeams(teamsData);
        } else if (tournament?.id) {
          // New tournament structure - load from /tournaments/{id}/teams with players
          const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
          const teamsSnapshot = await getDocs(teamsRef);
          
          // Load each team with its players subcollection
          const teamsData: Team[] = await Promise.all(
            teamsSnapshot.docs.map(async (teamDoc) => {
              const teamData = teamDoc.data();
              
              // Load players for this team
              const playersRef = collection(db, 'tournaments', tournament.id, 'teams', teamDoc.id, 'players');
              const playersSnapshot = await getDocs(playersRef);
              const players = playersSnapshot.docs.map(playerDoc => ({
                id: playerDoc.id,
                ...playerDoc.data()
              }));
              
              return {
                id: teamDoc.id,
                ...teamData,
                players
              } as Team;
            })
          );
          
          // Sort by division (Elite, Challenger, Adept) then by name
          const divisionOrder: Record<string, number> = { 'elite': 1, 'challenger': 2, 'adept': 3 };
          teamsData.sort((a, b) => {
            const aDivOrder = divisionOrder[a.divisionId?.toLowerCase() || ''] || 999;
            const bDivOrder = divisionOrder[b.divisionId?.toLowerCase() || ''] || 999;
            if (aDivOrder !== bDivOrder) return aDivOrder - bDivOrder;
            return (a.name || '').localeCompare(b.name || '');
          });
          
          // Add mock stats to each team
          teamsData.forEach((team, idx) => {
            const stats = generateMockStats(team.id, team.name);
            team.wins = stats.wins;
            team.losses = stats.losses;
            team.draws = stats.draws;
            team.points = stats.points;
            team.recentForm = stats.recentForm;
            
            // Set up next opponent (circular: each team plays the next one)
            const nextIdx = (idx + 1) % teamsData.length;
            mockNextOpponents[team.id] = {
              name: teamsData[nextIdx].name,
              id: teamsData[nextIdx].id
            };
            
            // Generate head-to-head vs next opponent
            const seed = team.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const h2hWins = seed % 3;
            const h2hLosses = (seed + 1) % 3;
            const h2hDraws = seed % 2;
            mockHeadToHead[team.id] = { wins: h2hWins, losses: h2hLosses, draws: h2hDraws };
          });
          
          setTeams(teamsData);
        }
      } catch (error) {
        console.error("Failed to load teams:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [isLegacyTournament, tournament?.id]);

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
            isLeague ? (
              <PDLTeamCard 
                key={team.id} 
                team={team}
                divisionRanking={generateDivisionRanking(team.id, team.division || '')}
                nextOpponent={mockNextOpponents[team.id]}
                headToHeadRecord={mockHeadToHead[team.id]}
              />
            ) : (
              <LegacyTeamCard key={team.id} team={team} />
            )
          ))}
        </div>
      )}
    </div>
  );
}
