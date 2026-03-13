"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { TeamCard as LegacyTeamCard } from "@/components/app/TeamCard";
import { TeamCard as PDLTeamCard } from "@/components/pdl/TeamCard";
import { getAllTeams } from "@/lib/firestore";
import type { Team, Player } from "@/lib/definitions";
import { useEffect, useState } from "react";
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

/**
 * Teams page - lists all teams registered in the tournament
 */
export default function TeamsPage() {
  const { tournament, theme, isLegacyTournament, getTournamentPath } = useTournament();
  const { isLeague } = useTournamentType();
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisionRankings, setDivisionRankings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Compute real 1-based position within each division group from team stats.
  // Sort key: points (W*2+D) desc → name asc as a deterministic tie-break.
  const computeDivisionRankings = (allTeams: Team[]): Record<string, number> => {
    const rankings: Record<string, number> = {};
    const byDivision: Record<string, Team[]> = {};
    allTeams.forEach(t => {
      const div = t.divisionId || 'none';
      if (!byDivision[div]) byDivision[div] = [];
      byDivision[div].push(t);
    });
    Object.values(byDivision).forEach(divTeams => {
      const getPoints = (t: Team): number => {
        const stats = (t as any).stats;
        if (stats?.points !== undefined) return stats.points as number;
        const w: number = stats?.wins ?? (t as any).wins ?? 0;
        const d: number = stats?.draws ?? (t as any).draws ?? 0;
        return w * 2 + d;
      };
      [...divTeams]
        .sort((a, b) => {
          const diff = getPoints(b) - getPoints(a);
          return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
        })
        .forEach((t, idx) => { rankings[t.id] = idx + 1; });
    });
    return rankings;
  };

  // Load teams from Firestore
  useEffect(() => {
    const loadTeams = async () => {
      try {
        if (isLegacyTournament) {
          // Legacy Letnia data - use existing Firestore structure
          const teamsData = await getAllTeams();
          setTeams(teamsData);
          setDivisionRankings(computeDivisionRankings(teamsData));
        } else if (tournament?.id) {
          // New tournament structure - load from /tournaments/{id}/teams with players
          const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
          const teamsSnapshot = await getDocs(teamsRef);

          // Load each team with its players
          const teamsData: Team[] = await Promise.all(
            teamsSnapshot.docs.map(async (teamDoc) => {
              const teamData = teamDoc.data();

              // Prefer the embedded roster map (new architecture) — has nickname, avatar, role.
              // Fall back to player subcollection for legacy teams without a roster map.
              const rosterMap = teamData.roster as Record<string, { nickname: string; role: string; steamId32: string; avatar?: string }> | undefined;

              let players: Player[];
              if (rosterMap && Object.keys(rosterMap).length > 0) {
                players = Object.entries(rosterMap).map(([steamId64, info]) => ({
                  id: steamId64,
                  steamId: steamId64,
                  steamId32: info.steamId32,
                  nickname: info.nickname,
                  role: info.role,
                  avatar: info.avatar || '',
                } as unknown as Player));
              } else {
                // Legacy fallback: read from player subcollection
                const playersRef = collection(db, 'tournaments', tournament.id, 'teams', teamDoc.id, 'players');
                const playersSnapshot = await getDocs(playersRef);
                players = playersSnapshot.docs.map(playerDoc => ({
                  id: playerDoc.id,
                  ...playerDoc.data()
                })) as unknown as Player[];
              }

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

          setTeams(teamsData);
          setDivisionRankings(computeDivisionRankings(teamsData));
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
    return <LoadingScreen />;
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

          <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tighter uppercase relative z-10 drop-shadow-2xl">
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
                <p className="text-gray-300 font-logik font-medium text-lg">
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
                  divisionRanking={divisionRankings[team.id]}
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
