"use client";

import { useMemo } from "react";
import { useTournament } from "@/context/TournamentContext";
import { PlayoffBracket } from "@/components/playoffs/PlayoffBracketView";
import { generateBracket } from "@/lib/playoff-bracket-generator";
import type { PlayoffMatch } from "@/lib/definitions";

// ─── Mock teams ────────────────────────────────────────────────────────────────

const TEAMS = [
  { id: "t1",  name: "Void Spirit",    logoUrl: "https://i.imgur.com/7QK5jcd.png" },
  { id: "t2",  name: "OG",             logoUrl: "https://i.imgur.com/FXH1Ojj.png" },
  { id: "t3",  name: "Team Secret",    logoUrl: "https://i.imgur.com/K5bAFPY.png" },
  { id: "t4",  name: "Tundra",         logoUrl: "https://i.imgur.com/9nXYKWr.png" },
  { id: "t5",  name: "Liquid",         logoUrl: "https://i.imgur.com/Nif2qxu.png" },
  { id: "t6",  name: "Gaimin",         logoUrl: "" },
  { id: "t7",  name: "Nigma",          logoUrl: "" },
  { id: "t8",  name: "EG",             logoUrl: "" },
  { id: "t9",  name: "Alliance",       logoUrl: "" },
  { id: "t10", name: "VP",             logoUrl: "" },
  { id: "t11", name: "NaVi",           logoUrl: "" },
  { id: "t12", name: "Fnatic",         logoUrl: "" },
  { id: "t13", name: "beastcoast",     logoUrl: "" },
  { id: "t14", name: "Aster",          logoUrl: "" },
  { id: "t15", name: "TSM",            logoUrl: "" },
  { id: "t16", name: "Talon Esports",  logoUrl: "" },
];

function team(id: string) {
  const t = TEAMS.find((x) => x.id === id)!;
  return { id: t.id, name: t.name, logoUrl: t.logoUrl };
}

function completed(
  base: PlayoffMatch,
  winnerId: string,
  loserId: string,
  winScore: number,
  loseScore: number,
): PlayoffMatch {
  const aWins = base.teamA?.id === winnerId;
  return {
    ...base,
    status: "completed",
    result: {
      winnerId,
      loserId,
      teamAScore: aWins ? winScore : loseScore,
      teamBScore: aWins ? loseScore : winScore,
      completedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

/**
 * 16-team single elimination:
 *   R1: 8 matches  (all resolved)
 *   R2: 4 matches  (all resolved)
 *   R3: 2 matches  (1 resolved, 1 scheduled)
 *   R4: 1 match    (Grand Final, pending)
 *
 * Seeding / expected path:
 *   t1 → wins R1,R2,R3 → GF
 *   t3 → wins R1,R2 → R3 (scheduled)
 *   t5 → wins R1,R2 → R3 (scheduled, vs t3)
 *   t2 → wins R1,R2,then loses R3
 *   remaining teams fill the rest of the bracket
 */
function buildMockMatches(): PlayoffMatch[] {
  const template = generateBracket({
    format: "single-elimination",
    upperBracketTeams: 16,
    lowerBracketTeams: 0,
    defaultFormat: "bo3",
    semifinalFormat: "bo3",
    finalFormat: "bo5",
    grandFinalFormat: "bo5",
  });

  const byId = new Map<string, PlayoffMatch>(template.map((m) => [m.id, m]));

  const patch = (id: string, updates: Partial<PlayoffMatch>) => {
    const ex = byId.get(id);
    if (ex) byId.set(id, { ...ex, ...updates });
  };

  const setTeams = (id: string, a: string, b: string) =>
    patch(id, { teamA: team(a), teamB: team(b) });

  const setCompleted = (id: string, winnerId: string, loserId: string, w: number, l: number) => {
    const ex = byId.get(id);
    if (ex) byId.set(id, completed(ex, winnerId, loserId, w, l));
  };

  // ── Round 1 (8 matches, all resolved) ─────────────────────────────────────
  setTeams("ub-r1-p1", "t1", "t16"); setCompleted("ub-r1-p1", "t1",  "t16", 2, 0);
  setTeams("ub-r1-p2", "t9", "t8");  setCompleted("ub-r1-p2", "t9",  "t8",  2, 1);
  setTeams("ub-r1-p3", "t5", "t12"); setCompleted("ub-r1-p3", "t5",  "t12", 2, 0);
  setTeams("ub-r1-p4", "t13","t4");  setCompleted("ub-r1-p4", "t13", "t4",  2, 1);
  setTeams("ub-r1-p5", "t3", "t14"); setCompleted("ub-r1-p5", "t3",  "t14", 2, 0);
  setTeams("ub-r1-p6", "t11","t6");  setCompleted("ub-r1-p6", "t11", "t6",  2, 1);
  setTeams("ub-r1-p7", "t7", "t10"); setCompleted("ub-r1-p7", "t7",  "t10", 2, 0);
  setTeams("ub-r1-p8", "t2", "t15"); setCompleted("ub-r1-p8", "t2",  "t15", 2, 0);

  // ── Round 2 (4 matches, all resolved) ─────────────────────────────────────
  // R2p1 = R1p1 winner vs R1p2 winner = t1 vs t9
  setTeams("ub-r2-p1", "t1", "t9");   setCompleted("ub-r2-p1", "t1",  "t9",  2, 0);
  // R2p2 = R1p3 winner vs R1p4 winner = t5 vs t13
  setTeams("ub-r2-p2", "t5", "t13");  setCompleted("ub-r2-p2", "t5",  "t13", 2, 1);
  // R2p3 = R1p5 winner vs R1p6 winner = t3 vs t11
  setTeams("ub-r2-p3", "t3", "t11");  setCompleted("ub-r2-p3", "t3",  "t11", 2, 0);
  // R2p4 = R1p7 winner vs R1p8 winner = t7 vs t2
  setTeams("ub-r2-p4", "t7", "t2");   setCompleted("ub-r2-p4", "t2",  "t7",  2, 1);

  // ── Round 3 (2 matches — 1 resolved, 1 scheduled) ─────────────────────────
  // R3p1 = R2p1 winner vs R2p2 winner = t1 vs t5  → t1 wins (resolved)
  setTeams("ub-r3-p1", "t1", "t5");   setCompleted("ub-r3-p1", "t1",  "t5",  2, 0);
  // R3p2 = R2p3 winner vs R2p4 winner = t3 vs t2  → still scheduled
  setTeams("ub-r3-p2", "t3", "t2");
  patch("ub-r3-p2", {
    status: "scheduled",
    scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // ── Grand Final (pending, teams unknown until R3p2 resolves) ──────────────
  // t1 is confirmed, other slot is TBD
  patch("ub-r4-p1", { teamA: team("t1"), status: "scheduled" });

  return Array.from(byId.values());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayoffsTest16Page() {
  const { theme } = useTournament();

  const matches = useMemo(() => buildMockMatches(), []);

  const accentColor = theme?.secondaryColor || "#D4AF37";
  const glowColor = theme?.primaryColor || "#8B1538";

  return (
    <div className="w-full h-[calc(100vh-64px)] relative overflow-hidden text-white flex flex-col">
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

      {/* Bracket — fills the entire remaining height */}
      <div className="relative z-10 flex-1 min-h-0 px-2 pb-2">
        <PlayoffBracket matches={matches} view="upper" maxHeight="100%" />
      </div>
    </div>
  );
}
