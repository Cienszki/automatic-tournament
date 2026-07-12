"use client";

import { useTournament, useTournamentType } from "@/context/TournamentContext";
import { useEffect, useState } from "react";
import { Team, PlayoffMatch } from "@/lib/definitions";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trophy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useTranslations } from "next-intl";
import { SeasonPointsTable } from "@/components/playoffs/SeasonPointsTable";
import { MirroredPlayoffBracket } from "@/components/playoffs/MirroredPlayoffBracket";

export default function PlayoffsPage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();
  const t = useTranslations("pdlPlayoffs");

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const accentColor = theme?.secondaryColor || "#D4AF37";
  const glowColor = theme?.primaryColor || "#8B1538";

  useEffect(() => {
    async function fetchData() {
      if (!tournament?.id || tournament.playoffs?.enabled === false) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch teams for the season points table (league only)
        if (isLeague) {
          const teamsRef = collection(db, "tournaments", tournament.id, "teams");
          const teamsSnap = await getDocs(teamsRef);
          const teamsMap = new Map<string, Team>();
          teamsSnap.docs.forEach((doc) => {
            teamsMap.set(doc.id, {
              id: doc.id,
              ...doc.data(),
              seasonPoints: 0,
              wins: 0,
              draws: 0,
              losses: 0,
            } as Team);
          });

          const matchesRef = collection(db, "tournaments", tournament.id, "matches");
          const matchesSnap = await getDocs(matchesRef);
          const eliteTeamIds = new Set<string>();

          matchesSnap.docs.forEach((d) => {
            const m = d.data();
            if (m.divisionId !== "elite") return;

            const teamAId = m.teamA?.id;
            const teamBId = m.teamB?.id;
            if (teamAId) eliteTeamIds.add(teamAId);
            if (teamBId) eliteTeamIds.add(teamBId);

            if (m.status === "completed") {
              const scoreA = m.teamA?.score || 0;
              const scoreB = m.teamB?.score || 0;

              if (teamsMap.has(teamAId)) {
                const tm = teamsMap.get(teamAId)!;
                if (scoreA > scoreB) { tm.seasonPoints = (tm.seasonPoints || 0) + 2; tm.wins = (tm.wins || 0) + 1; }
                else if (scoreA === scoreB) { tm.seasonPoints = (tm.seasonPoints || 0) + 1; tm.draws = (tm.draws || 0) + 1; }
                else { tm.losses = (tm.losses || 0) + 1; }
                teamsMap.set(teamAId, tm);
              }
              if (teamsMap.has(teamBId)) {
                const tm = teamsMap.get(teamBId)!;
                if (scoreB > scoreA) { tm.seasonPoints = (tm.seasonPoints || 0) + 2; tm.wins = (tm.wins || 0) + 1; }
                else if (scoreB === scoreA) { tm.seasonPoints = (tm.seasonPoints || 0) + 1; tm.draws = (tm.draws || 0) + 1; }
                else { tm.losses = (tm.losses || 0) + 1; }
                teamsMap.set(teamBId, tm);
              }
            }
          });

          setTeams(
            Array.from(teamsMap.values()).filter((tm) => eliteTeamIds.has(tm.id)),
          );
        }

        // Fetch playoff matches
        let playoffData: PlayoffMatch[] = [];
        try {
          const pfRef = collection(db, "tournaments", tournament.id, "playoff_matches");
          const pfSnap = await getDocs(pfRef);
          playoffData = pfSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PlayoffMatch));
        } catch {
          // collection not accessible yet
        }

        setMatches(playoffData);
      } catch (error) {
        console.error("Error fetching playoff data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tournament?.id, isLeague, tournament?.playoffs?.enabled]);

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />;

  // ── Playoffs disabled / not visible ─────────────────────────────────
  if (
    tournament?.playoffs?.enabled === false ||
    (!tournament?.playoffs?.playoffsVisible && matches.length === 0)
  ) {
    return (
      <div className="w-full relative overflow-hidden text-white pt-8 min-h-screen">
        <PageBackground accentColor={accentColor} glowColor={glowColor} />
        <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-12">
          <PageHeader
            theme={theme}
            accentColor={accentColor}
            isLeague={isLeague}
            t={t}
          />
          <div className="flex flex-col items-center justify-center gap-6 py-24">
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <Lock className="h-16 w-16 mx-auto" style={{ color: `${accentColor}99` }} />
            </div>
            <div className="text-center space-y-3 max-w-lg">
              <h2
                className="text-2xl font-logik-extended-bold"
                style={{ color: theme?.headingColor || theme?.primaryTextColor || "white" }}
              >
                {t("notActiveTitle")}
              </h2>
              <p className="text-muted-foreground font-logik">{t("notActiveDesc")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main playoffs page (mirrored, grand final centered) ─────────────
  return (
    <div className="w-full relative text-white">
      <PageBackground accentColor={accentColor} glowColor={glowColor} />

      {/* Full-bleed: break out of the layout container to use the whole screen width */}
      <div className="relative z-10 w-screen ml-[calc(50%-50vw)] px-3 py-3">
        {/* Header — overlaid in the bracket's top whitespace so the bracket
            itself keeps its exact vertical position (same font size as the
            Groups / Teams pages) */}
        <div className="absolute inset-x-0 top-0 z-20 pointer-events-none pt-4">
          <div className="text-center space-y-4 relative">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-32 blur-[100px] rounded-full pointer-events-none"
              style={{ background: `${theme?.primaryColor || "#8B1538"}0D` }}
            />
            <h1
              className="text-5xl md:text-6xl 2xl:text-7xl font-logik-wide-black tracking-tighter uppercase relative z-10 drop-shadow-2xl"
              style={{ color: theme?.titleColor || "white" }}
            >
              {t("title")}
            </h1>
            <div className="flex items-center justify-center gap-4 opacity-60">
              <div
                className="h-[1px] w-12"
                style={{ background: `linear-gradient(to right, transparent, ${theme?.primaryColor || "#8B1538"})` }}
              />
              <div
                className="w-2 h-2 rotate-45 border"
                style={{ borderColor: theme?.primaryColor || "#8B1538" }}
              />
              <div
                className="h-[1px] w-12"
                style={{ background: `linear-gradient(to left, transparent, ${theme?.primaryColor || "#8B1538"})` }}
              />
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            isLeague ? "xl:grid-cols-12" : "",
          )}
        >
          {/* Season points table (league only) */}
          {isLeague && (
            <div className="xl:col-span-3">
              <SeasonPointsTable teams={teams} />
            </div>
          )}

          {/* Bracket area — sits directly on the page background */}
          <div className={cn("flex flex-col min-h-0", isLeague ? "xl:col-span-9" : "")}>
            <div className="relative z-10 p-2">
              <MirroredPlayoffBracket matches={matches} maxHeight="calc(100vh - 96px)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function PageBackground({
  accentColor,
  glowColor,
}: {
  accentColor: string;
  glowColor: string;
}) {
  return (
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
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

function PageHeader({
  theme,
  accentColor,
  isLeague,
  t,
}: {
  theme: ReturnType<typeof useTournament>["theme"];
  accentColor: string;
  isLeague: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="text-center space-y-6 mb-16 relative">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] blur-[100px] rounded-full pointer-events-none opacity-10"
        style={{ background: accentColor }}
      />
      <h1
        className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black tracking-tighter uppercase drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative z-10"
        style={{
          color: theme?.titleColor || "white",
          fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
        }}
      >
        {t("title")}
      </h1>
      <div className="flex items-center justify-center gap-6 opacity-80 relative z-10">
        <div
          className="h-[1px] w-24"
          style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
        />
        <div
          className="flex items-center gap-2 tracking-widest uppercase font-logik text-sm"
          style={{ color: accentColor }}
        >
          <Trophy className="w-4 h-4" />
          <span>{isLeague ? t("roadToWarsaw") : "Faza Playoff"}</span>
          <Trophy className="w-4 h-4" />
        </div>
        <div
          className="h-[1px] w-24"
          style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
        />
      </div>
    </div>
  );
}
