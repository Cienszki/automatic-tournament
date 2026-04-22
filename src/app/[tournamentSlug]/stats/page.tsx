"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { BarChart3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  StatsPageLayout,
  type TournamentStatsData,
  type PlayerStatsData,
  type TeamStatsData,
} from '@/components/stats/StatsContent';

// ─── Main Page ───────────────────────────────────────────────────────

export default function StatsPage(): React.ReactElement | null {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const t = useTranslations('stats');

  const [tournamentStats, setTournamentStats] = useState<TournamentStatsData | null>(null);
  const [playerStats, setPlayerStats]         = useState<PlayerStatsData[]>([]);
  const [teamStats, setTeamStats]             = useState<TeamStatsData[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!tournament?.id) { setLoading(false); return; }
    try {
      // Legacy (Letnia) uses flat top-level collections; new tournaments use tournament-scoped paths
      const [tournamentDoc, playerSnap, teamSnap] = isLegacyTournament
        ? await Promise.all([
            getDoc(doc(db, 'tournamentStats', 'tournament-stats')),
            getDocs(collection(db, 'playerStats')),
            getDocs(collection(db, 'teamStats')),
          ])
        : await Promise.all([
            getDoc(doc(db, 'tournaments', tournament.id, 'stats', 'tournament-stats')),
            getDocs(collection(db, 'tournaments', tournament.id, 'playerStats')),
            getDocs(collection(db, 'tournaments', tournament.id, 'teamStats')),
          ]);
      if (tournamentDoc.exists()) {
        setTournamentStats(tournamentDoc.data() as TournamentStatsData);
      }
      setPlayerStats(playerSnap.docs.map(d => ({ playerId: d.id, ...d.data() } as PlayerStatsData)));
      setTeamStats(teamSnap.docs.map(d => ({ teamId: d.id, ...d.data() } as TeamStatsData)));
    } catch (err) {
      console.error('Error loading stats:', err);
      setError(t('errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [tournament?.id, isLegacyTournament, t]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (!tournament) return null;

  const pc = theme.primaryColor;
  const ac = theme.accentColor;
  const sc = theme.secondaryColor;

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="relative text-white min-h-[60vh] flex items-center justify-center">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]" style={{ background: pc }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 border-2 border-white/5 rounded-full" />
            <div
              className="absolute inset-0 w-20 h-20 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${pc}60 transparent transparent transparent` }}
            />
          </div>
          <span className="text-xs tracking-widest uppercase text-white/30 animate-pulse">{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative text-white min-h-[40vh] flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <BarChart3 className="w-12 h-12 mx-auto opacity-20" />
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">

      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)' }}
        />
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.05] blur-[200px]"
          style={{ background: pc }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: ac }}
        />
        <div
          className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] rounded-full opacity-[0.025] blur-[180px]"
          style={{ background: sc }}
        />
      </div>

      <div className="relative z-10">
        <StatsPageLayout
          tournamentStats={tournamentStats}
          playerStats={playerStats}
          teamStats={teamStats}
        />
      </div>
    </div>
  );
}
