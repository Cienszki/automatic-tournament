"use client";

import { useTournament } from '@/context/TournamentContext';
import { getAllMatches } from "@/lib/firestore";
import type { Match } from "@/lib/definitions";
import { useEffect, useState } from "react";
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MatchdayCarousel } from '@/components/schedule/MatchdayCarousel';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

/**
 * Schedule page - Premium redesign with full-width layout
 */
export default function SchedulePage() {
  const { tournament, isLegacyTournament, theme } = useTournament();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatches = async () => {
      try {
        let fetchedMatches: Match[] = [];

        if (isLegacyTournament) {
          const allMatches = await getAllMatches();
          fetchedMatches = allMatches;
        } else if (tournament?.id) {
          const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
          const matchesSnapshot = await getDocs(matchesRef);

          fetchedMatches = matchesSnapshot.docs.map(doc => {
            const data = doc.data();

            const mapTeam = (teamData: any) => {
              if (typeof teamData === 'object' && teamData !== null) return teamData;
              return { id: String(teamData), name: 'TBA', score: 0, logoUrl: '' };
            };

            const teamAObj = mapTeam(data.teamA);
            const teamBObj = mapTeam(data.teamB);

            return {
              id: doc.id,
              teamA: teamAObj,
              teamB: teamBObj,
              teams: [teamAObj.id, teamBObj.id],
              status: data.status || 'scheduled',
              scheduledFor: data.scheduledFor || data.scheduled_for || '',
              schedulingStatus: data.schedulingStatus || 'unscheduled',
              completed_at: data.completed_at,
              scoreA: data.scoreA,
              scoreB: data.scoreB,
              round: data.round,
              matchday: data.matchday,
              group_id: data.group_id,
              bestOf: data.bestOf || 2,
              series_format: data.series_format,
              approvedStandins: data.approvedStandins,
            } as unknown as Match;
          });
        }

        const validMatches = fetchedMatches.filter(m => m.scheduledFor);

        setMatches(validMatches);

      } catch (error) {
        console.error("Failed to load matches:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, [isLegacyTournament, tournament?.id]);

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

      {/* Main Content */}
      <div className="relative z-10 max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-12 py-6 sm:py-8">
        <MatchdayCarousel matches={matches} />
      </div>
    </div>
  );
}
