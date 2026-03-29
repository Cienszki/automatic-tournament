"use client";

import { SeasonPointsTable } from "@/components/playoffs/SeasonPointsTable";
import { PlayoffBracket } from "@/components/playoffs/PlayoffBracket";
import { useTournament, useTournamentType } from "@/context/TournamentContext";
import { useEffect, useState } from "react";
import { Team, PlayoffMatch } from "@/lib/definitions";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trophy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslations } from "next-intl";

export default function PlayoffsPage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();
  const t = useTranslations('pdlPlayoffs');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // For PDL (league), use the gold secondary color; for MMR/others, use primary
  const accentColor = theme?.secondaryColor || '#D4AF37';
  const glowColor = theme?.primaryColor || '#8B1538';

  useEffect(() => {
    async function fetchData() {
      if (!tournament?.id || tournament.playoffs?.enabled === false) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // For league tournaments, fetch division standings for the sidebar
        if (isLeague) {
          // 1. Fetch all Teams
          const teamsRef = collection(db, "tournaments", tournament.id, "teams");
          const teamsSnap = await getDocs(teamsRef);
          const teamsMap = new Map<string, Team>();
          teamsSnap.docs.forEach(doc => {
            teamsMap.set(doc.id, { id: doc.id, ...doc.data(), seasonPoints: 0, wins: 0, draws: 0, losses: 0 } as Team);
          });

          // 2. Fetch all matches and filter client-side by Elite division
          const matchesRef = collection(db, "tournaments", tournament.id, "matches");
          const matchesSnap = await getDocs(matchesRef);
          const eliteTeamIds = new Set<string>();

          matchesSnap.docs.forEach(doc => {
            const m = doc.data();
            if (m.divisionId !== 'elite') return;

            const teamAId = m.teamA?.id;
            const teamBId = m.teamB?.id;
            if (teamAId) eliteTeamIds.add(teamAId);
            if (teamBId) eliteTeamIds.add(teamBId);

            if (m.status === 'completed') {
              const scoreA = m.teamA?.score || 0;
              const scoreB = m.teamB?.score || 0;

              if (teamsMap.has(teamAId)) {
                const t = teamsMap.get(teamAId)!;
                if (scoreA > scoreB) { t.seasonPoints = (t.seasonPoints || 0) + 2; t.wins = (t.wins || 0) + 1; }
                else if (scoreA === scoreB) { t.seasonPoints = (t.seasonPoints || 0) + 1; t.draws = (t.draws || 0) + 1; }
                else { t.losses = (t.losses || 0) + 1; }
                teamsMap.set(teamAId, t);
              }

              if (teamsMap.has(teamBId)) {
                const t = teamsMap.get(teamBId)!;
                if (scoreB > scoreA) { t.seasonPoints = (t.seasonPoints || 0) + 2; t.wins = (t.wins || 0) + 1; }
                else if (scoreB === scoreA) { t.seasonPoints = (t.seasonPoints || 0) + 1; t.draws = (t.draws || 0) + 1; }
                else { t.losses = (t.losses || 0) + 1; }
                teamsMap.set(teamBId, t);
              }
            }
          });

          const eliteTeams = Array.from(teamsMap.values()).filter(t => eliteTeamIds.has(t.id));
          setTeams(eliteTeams);
        }

        // 3. Fetch Playoff Matches (gracefully falls back if collection doesn't exist or rules block it)
        let playoffData: PlayoffMatch[] = [];
        try {
          const playoffMatchesRef = collection(db, "tournaments", tournament.id, "playoff_matches");
          const playoffMatchesSnap = await getDocs(playoffMatchesRef);
          playoffData = playoffMatchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayoffMatch));
        } catch {
          // Collection not accessible yet — fall through to generated bracket below
        }

        setMatches(playoffData);

      } catch (error: any) {
        // Log errors, but don't mock data violently anymore
        console.error("Error fetching playoff data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tournament?.id]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (tournament?.playoffs?.enabled === false) {
    return (
      <div className="w-full relative overflow-hidden text-white pt-8 min-h-screen">
        {/* Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] opacity-80" />
          <div
            className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full mix-blend-screen opacity-[0.07]"
            style={{ background: accentColor }}
          />
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full mix-blend-screen opacity-[0.05]"
            style={{ background: glowColor }}
          />
        </div>

        <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-12">
          <div className="text-center space-y-6 mb-16 relative">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] blur-[100px] rounded-full pointer-events-none opacity-10"
              style={{ background: accentColor }}
            />
            <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-500 tracking-tighter uppercase drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative z-10">
              {t('title')}
            </h1>
            <div className="flex items-center justify-center gap-6 opacity-80 relative z-10">
              <div
                className="h-[1px] w-24"
                style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
              />
              {isLeague ? (
                <div className="flex items-center gap-2 tracking-widest uppercase font-logik text-sm" style={{ color: accentColor }}>
                  <Trophy className="w-4 h-4" />
                  <span>{t('roadToWarsaw')}</span>
                  <Trophy className="w-4 h-4" />
                </div>
              ) : (
                <div className="flex items-center gap-2 tracking-widest uppercase font-logik text-sm" style={{ color: accentColor }}>
                  <Trophy className="w-4 h-4" />
                  <span>Faza Playoff</span>
                  <Trophy className="w-4 h-4" />
                </div>
              )}
              <div
                className="h-[1px] w-24"
                style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-24">
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <Lock className="h-16 w-16 mx-auto" style={{ color: `${accentColor}99` }} />
            </div>
            <div className="text-center space-y-3 max-w-lg">
              <h2 className="text-2xl font-logik-extended-bold text-white">{t('notActiveTitle')}</h2>
              <p className="text-muted-foreground font-logik">
                {t('notActiveDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden text-white pt-8">
      {/* Premium Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Deep Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] opacity-80" />

        {/* Ambient Glows */}
        <div
          className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full mix-blend-screen opacity-[0.07]"
          style={{ background: accentColor }}
        />
        <div
          className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full mix-blend-screen opacity-[0.05]"
          style={{ background: glowColor }}
        />

        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-12">
        {/* Header - Ultra Premium */}
        <div className="text-center space-y-6 mb-20 relative">
          {/* Header Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] blur-[100px] rounded-full pointer-events-none opacity-10"
            style={{ background: accentColor }}
          />

          <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-500 tracking-tighter uppercase drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative z-10">
            {t('title')}
          </h1>

          {/* Decorative Separator */}
          <div className="flex items-center justify-center gap-6 opacity-80 relative z-10">
            <div
              className="h-[1px] w-24"
              style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
            />
            {isLeague ? (
              <div className="flex items-center gap-2 tracking-widest uppercase font-logik text-sm" style={{ color: accentColor }}>
                <Trophy className="w-4 h-4" />
                <span>{t('roadToWarsaw')}</span>
                <Trophy className="w-4 h-4" />
              </div>
            ) : (
              <div className="flex items-center gap-2 tracking-widest uppercase font-logik text-sm" style={{ color: accentColor }}>
                <Trophy className="w-4 h-4" />
                <span>Faza Playoff</span>
                <Trophy className="w-4 h-4" />
              </div>
            )}
            <div
              className="h-[1px] w-24"
              style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
            />
          </div>
        </div>

        {/* Content Grid */}
        <div className={cn(
          "grid grid-cols-1 gap-12",
          isLeague ? "xl:grid-cols-12" : ""
        )}>
          {/* Left: Season Points Table — league only */}
          {isLeague && (
            <div className="xl:col-span-4">
              <SeasonPointsTable teams={teams} />
            </div>
          )}

          {/* Right: Bracket */}
          <div className={cn(
            "min-h-[600px] flex flex-col",
            isLeague ? "xl:col-span-8" : ""
          )}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <Trophy className="h-6 w-6" style={{ color: accentColor }} />
              </div>
              <div>
                <h2 className="text-3xl font-logik-extended-bold text-white tracking-tight">{t('lanFinalsBracket')}</h2>
              </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl relative overflow-hidden shadow-2xl">
              {/* Noise */}
              <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
              />

              {/* Grid Pattern Background */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
              />

              <PlayoffBracket matches={matches} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
