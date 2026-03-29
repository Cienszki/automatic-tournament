"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { GroupTable } from "@/components/app/GroupTable";
import { getAllGroups, getAllTeams } from "@/lib/firestore";
import { getGroups, calculateGroupStandings } from "@/lib/api/groups";
import type { TeamForStandings, MatchForStandings } from "@/lib/api/groups";
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Group, GroupStanding } from "@/lib/definitions";
import { AlertTriangle } from 'lucide-react';
import { useState, useEffect } from "react";
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// Hydrate groups with team data (legacy)
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
        } else if (tournament?.id) {
          const [groupDocs, teamsSnap, matchesSnap] = await Promise.all([
            getGroups(tournament.id),
            getDocs(collection(db, 'tournaments', tournament.id, 'teams')),
            getDocs(collection(db, 'tournaments', tournament.id, 'matches')),
          ]);

          const teams: TeamForStandings[] = teamsSnap.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<TeamForStandings, 'id'>),
          }));

          const matches = matchesSnap.docs.map(doc => doc.data() as MatchForStandings);

          setGroups(calculateGroupStandings(groupDocs, teams, matches));
        }
      } catch (error) {
        console.error("Failed to load groups:", error);
      } finally {
        setLoading(false);
      }
    }
    loadGroups();
  }, [isLegacyTournament, tournament?.id]);

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
    return <LoadingScreen />;
  }

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

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
          style={{ background: theme?.secondaryColor || '#6366f1' }}
        />
      </div>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 py-8 relative">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-32 blur-[100px] rounded-full pointer-events-none opacity-5"
            style={{ background: theme.primaryColor }}
          />
          <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tighter uppercase relative z-10 drop-shadow-2xl">
            Faza grupowa
          </h1>
          <div className="flex items-center justify-center gap-4 opacity-60">
            <div
              className="h-[1px] w-12"
              style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor})` }}
            />
            <div
              className="w-2 h-2 rotate-45 border"
              style={{ borderColor: theme.primaryColor }}
            />
            <div
              className="h-[1px] w-12"
              style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor})` }}
            />
          </div>
        </div>

        {/* Groups */}
        {sortedGroups.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-12 text-center relative overflow-hidden group">
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: `linear-gradient(135deg, ${theme.primaryColor}08, transparent, transparent)` }}
            />
            <div className="relative z-10 space-y-4">
              <AlertTriangle className="w-16 h-16 mx-auto mb-2 text-yellow-400/60" />
              <h2 className="text-2xl font-logik-extended-bold text-white">Grupy nie zostały jeszcze utworzone</h2>
              <p className="text-white/50 font-logik">
                Sprawdź ponownie po zakończeniu rejestracji.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sortedGroups.map((group) => (
              <GroupTable key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
