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
  const { tournament, theme, isLegacyTournament, getTournamentPath } = useTournament();
  const { isLeague } = useTournamentType();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // TODO: Load actual match results for team form
  // This should query matches from current round and calculate real W/L/D records

  // Generate division ranking (1-based position in division)
  const generateDivisionRanking = (teamId: string, division: string) => {
    const seed = teamId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (seed % 8) + 1; // Ranks 1-8
  };

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

          // TODO: Load actual standings data (wins, losses, draws, points)
          // TODO: Load actual recent form from last 5 matches
          // For now, teams will display without form bars
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
          <Users className="h-8 w-8 text-pdl-gold" />
          <h1 className="text-3xl font-logik-extended-bold text-white">Drużyny</h1>
        </div>
        <div className="text-center py-20 relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <div className="w-32 h-32 border-4 border-pdl-gold rounded-full animate-spin-slow" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pdl-gold mx-auto mb-3 relative z-10"></div>
          <p className="text-gray-400 font-logik tracking-wider uppercase text-sm">Ładowanie drużyn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">
      {/* Premium Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle vignette */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)',
          }}
        />

        {/* Ambient glow - top right */}
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme?.primaryColor || '#3b82f6' }}
        />

        {/* Ambient glow - bottom left */}
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: '#dc2626' }}
        />
      </div>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-8 space-y-12">
        {/* Header - Redesigned for Elegance */}
        <div className="text-center space-y-4 py-8 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-32 bg-pdl-crimson/5 blur-[100px] rounded-full pointer-events-none" />

          <h1 className="text-6xl md:text-7xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tighter uppercase relative z-10 drop-shadow-2xl">
            Drużyny
          </h1>

          <div className="flex items-center justify-center gap-4 opacity-60">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-pdl-gold" />
            <div className="w-2 h-2 rotate-45 border border-pdl-gold" />
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-pdl-gold" />
          </div>
        </div>

        {/* Teams Grid */}
        {teams.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-12 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-pdl-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 space-y-6">
              <Users className="h-12 w-12 mx-auto text-white/20 mb-4" />
              <div className="space-y-2">
                <p className="text-gray-400 font-logik text-lg">
                  {tournament.status === 'registration'
                    ? 'Brak zarejestrowanych drużyn. Bądź pierwszy!'
                    : 'Brak drużyn w tym turnieju.'}
                </p>
              </div>
              {tournament.status === 'registration' && (
                <a
                  href={getTournamentPath('/register')}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-logik-extended-bold text-white transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                  style={{ backgroundColor: theme?.primaryColor || '#8B1538' }}
                >
                  Zarejestruj Drużynę
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {teams.map((team) => (
              isLeague ? (
                <PDLTeamCard
                  key={team.id}
                  team={team}
                  divisionRanking={generateDivisionRanking(team.id, team.division || '')}
                />
              ) : (
                <LegacyTeamCard key={team.id} team={team} />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
