"use client";

import { SeasonPointsTable } from "@/components/playoffs/SeasonPointsTable";
import { PlayoffBracket } from "@/components/playoffs/PlayoffBracket";
import { useTournament } from "@/context/TournamentContext";
import { useEffect, useState } from "react";
import { Team, PlayoffMatch } from "@/lib/definitions";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trophy, Loader2 } from "lucide-react";

export default function PlayoffsPage() {
  const { tournament } = useTournament();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!tournament?.id) return;

      try {
        setLoading(true);

        // 1. Fetch all Teams
        const teamsRef = collection(db, "tournaments", tournament.id, "teams");
        const teamsSnap = await getDocs(teamsRef);
        // Initialize teams map
        const teamsMap = new Map<string, Team>();
        teamsSnap.docs.forEach(doc => {
          teamsMap.set(doc.id, { id: doc.id, ...doc.data(), seasonPoints: 0, wins: 0, draws: 0, losses: 0 } as Team);
        });

        // 2. Fetch all Regular Season Matches to calculate points dynamically
        const matchesRef = collection(db, "tournaments", tournament.id, "matches");
        const matchesSnap = await getDocs(matchesRef);

        matchesSnap.docs.forEach(doc => {
          const m = doc.data();
          if (m.status === 'completed') {
            const teamAId = m.teamA?.id;
            const teamBId = m.teamB?.id;
            const scoreA = m.teamA?.score || 0;
            const scoreB = m.teamB?.score || 0;

            // Update Team A
            if (teamsMap.has(teamAId)) {
              const t = teamsMap.get(teamAId)!;
              if (scoreA > scoreB) {
                t.seasonPoints = (t.seasonPoints || 0) + 2; // Win = 2 pts
                t.wins = (t.wins || 0) + 1;
              } else if (scoreA === scoreB) {
                t.seasonPoints = (t.seasonPoints || 0) + 1; // Draw = 1 pt
                t.draws = (t.draws || 0) + 1;
              } else {
                t.losses = (t.losses || 0) + 1;
              }
              teamsMap.set(teamAId, t);
            }

            // Update Team B
            if (teamsMap.has(teamBId)) {
              const t = teamsMap.get(teamBId)!;
              if (scoreB > scoreA) {
                t.seasonPoints = (t.seasonPoints || 0) + 2;
                t.wins = (t.wins || 0) + 1;
              } else if (scoreB === scoreA) {
                t.seasonPoints = (t.seasonPoints || 0) + 1;
                t.draws = (t.draws || 0) + 1;
              } else {
                t.losses = (t.losses || 0) + 1;
              }
              teamsMap.set(teamBId, t);
            }
          }
        });

        setTeams(Array.from(teamsMap.values()));

        // 3. Fetch Playoff Matches 
        const playoffMatchesRef = collection(db, "tournaments", tournament.id, "playoff_matches");
        const playoffMatchesSnap = await getDocs(playoffMatchesRef);

        let playoffData = playoffMatchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayoffMatch));

        // If no official playoff matches, GENERATE PREDICTED BRACKET from Top 4 Teams
        if (playoffData.length === 0) {
          const sortedTeams = Array.from(teamsMap.values())
            .sort((a, b) => (b.seasonPoints || 0) - (a.seasonPoints || 0));

          const top4 = sortedTeams.slice(0, 4);
          const getTeam = (idx: number) => top4[idx] ? { id: top4[idx].id, name: top4[idx].name, logoUrl: top4[idx].logoUrl } : { id: `tbd-${idx}`, name: 'TBD' };

          playoffData = [
            {
              id: 'projected-semi-1',
              bracketType: 'final',
              round: 1,
              position: 1,
              teamA: getTeam(0), // Rank 1 vs
              teamB: getTeam(3), // Rank 4
              format: 'bo3',
              status: 'scheduled',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 'projected-semi-2',
              bracketType: 'final',
              round: 1,
              position: 2,
              teamA: getTeam(1), // Rank 2 vs
              teamB: getTeam(2), // Rank 3
              format: 'bo3',
              status: 'scheduled',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 'projected-final',
              bracketType: 'final',
              round: 2,
              position: 1,
              teamA: { id: 'winner-1', name: 'TBD' },
              teamB: { id: 'winner-2', name: 'TBD' },
              format: 'bo5',
              status: 'scheduled',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ];
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-pdl-gold animate-spin" />
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
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-pdl-gold/5 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-pdl-crimson/5 blur-[120px] rounded-full mix-blend-screen" />

        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-12">
        {/* Header - Ultra Premium */}
        <div className="text-center space-y-6 mb-20 relative">
          {/* Header Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-pdl-gold/10 blur-[100px] rounded-full pointer-events-none" />

          <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-500 tracking-tighter uppercase drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative z-10">
            Playoffs
          </h1>

          {/* Decorative Separator */}
          <div className="flex items-center justify-center gap-6 opacity-80 relative z-10">
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-pdl-gold to-transparent" />
            <div className="flex items-center gap-2 text-pdl-gold tracking-widest uppercase font-logik text-sm">
              <Trophy className="w-4 h-4" />
              <span>Road to Warsaw</span>
              <Trophy className="w-4 h-4" />
            </div>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-pdl-gold to-transparent" />
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
          {/* Left: Season Points Table (4 cols) */}
          <div className="xl:col-span-4">
            <SeasonPointsTable teams={teams} />
          </div>

          {/* Right: Bracket (8 cols) */}
          <div className="xl:col-span-8 min-h-[600px] flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <Trophy className="h-6 w-6 text-pdl-gold" />
              </div>
              <div>
                <h2 className="text-3xl font-logik-extended-bold text-white tracking-tight">LAN Finals Bracket</h2>
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
