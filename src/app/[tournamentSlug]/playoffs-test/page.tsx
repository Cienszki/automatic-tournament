"use client";

import { useState, useMemo } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTournament } from "@/context/TournamentContext";
import { useTranslations } from "next-intl";
import { PlayoffBracket } from "@/components/playoffs/PlayoffBracketView";
import { motion, AnimatePresence } from "framer-motion";
import { generateBracket } from "@/lib/playoff-bracket-generator";
import type { PlayoffMatch } from "@/lib/definitions";

type BracketView = "upper" | "lower";

// ─── Mock teams ───────────────────────────────────────────────────────────────

const TEAMS = [
  { id: "t1", name: "Void Spirit", logoUrl: "https://i.imgur.com/7QK5jcd.png" },
  { id: "t2", name: "OG", logoUrl: "https://i.imgur.com/FXH1Ojj.png" },
  { id: "t3", name: "Team Secret", logoUrl: "https://i.imgur.com/K5bAFPY.png" },
  { id: "t4", name: "Tundra", logoUrl: "https://i.imgur.com/9nXYKWr.png" },
  { id: "t5", name: "Liquid", logoUrl: "https://i.imgur.com/Nif2qxu.png" },
  { id: "t6", name: "Gaimin", logoUrl: "https://i.imgur.com/1a2b3c4.png" },
  { id: "t7", name: "Nigma", logoUrl: "https://i.imgur.com/5d6e7f8.png" },
  { id: "t8", name: "EG", logoUrl: "https://i.imgur.com/9a0b1c2.png" },
  { id: "t9", name: "Alliance", logoUrl: "" },
  { id: "t10", name: "VP", logoUrl: "" },
  { id: "t11", name: "NaVi", logoUrl: "" },
  { id: "t12", name: "Fnatic", logoUrl: "" },
];

function team(id: string) {
  const t = TEAMS.find((x) => x.id === id)!;
  return { id: t.id, name: t.name, logoUrl: t.logoUrl };
}

function completedMatch(
  base: PlayoffMatch,
  winnerId: string,
  loserId: string,
  winnerScore: number,
  loserScore: number,
): PlayoffMatch {
  const teamAIsWinner = base.teamA?.id === winnerId;
  return {
    ...base,
    status: "completed",
    result: {
      winnerId,
      loserId,
      teamAScore: teamAIsWinner ? winnerScore : loserScore,
      teamBScore: teamAIsWinner ? loserScore : winnerScore,
      completedAt: new Date().toISOString(),
    },
  };
}

/**
 * Build mock double-elimination bracket:
 * - 8 teams in UB, 4 teams in LB (so LB starts with 6 matches in R1)
 * - All matches resolved except Grand Final
 *
 * UB structure (8 teams):
 *   UB R1: 4 matches  (positions 1-4)
 *   UB R2: 2 matches  (positions 1-2)
 *   UB R3: 1 match    (UB final, position 1)
 *   GF
 *
 * LB structure (8 UB teams → generator chooses 6 LB rounds):
 *   LB R1: 2 matches  — pure LB teams play each other (odd, reduction)
 *   LB R2: 2 matches  — LB R1 winners + UB R1 losers (even, drop-down)
 *   LB R3: 2 matches  — (odd, reduction)
 *   LB R4: 1 match    — LB R3 winner + UB R2 loser (even, drop-down)
 *   LB R5: 1 match    — LB R4 winner + UB R3 loser (even, drop-down) — wait, UB has 3 rounds
 *   LB R6: 1 match    — LB final
 *
 * Let's generate the template first, then patch teams + results.
 */
function buildMockMatches(): PlayoffMatch[] {
  // Generate template
  const template = generateBracket({
    format: "double-elimination",
    upperBracketTeams: 8,
    lowerBracketTeams: 4,
    defaultFormat: "bo3",
    semifinalFormat: "bo3",
    finalFormat: "bo3",
    grandFinalFormat: "bo5",
  });

  // Map by id for easy patching
  const byId = new Map<string, PlayoffMatch>(template.map((m) => [m.id, m]));

  const patch = (id: string, updates: Partial<PlayoffMatch>): void => {
    const existing = byId.get(id);
    if (existing) byId.set(id, { ...existing, ...updates });
  };

  // ── UB Round 1 ─────────────────────────────────────────────────────
  // Seed 4 matches: t1 vs t5, t2 vs t6, t3 vs t7, t4 vs t8
  patch("ub-r1-p1", { teamA: team("t1"), teamB: team("t5") });
  patch("ub-r1-p2", { teamA: team("t2"), teamB: team("t6") });
  patch("ub-r1-p3", { teamA: team("t3"), teamB: team("t7") });
  patch("ub-r1-p4", { teamA: team("t4"), teamB: team("t8") });

  // Results: t1, t2, t3, t4 win; losers drop to LB
  byId.set("ub-r1-p1", completedMatch(byId.get("ub-r1-p1")!, "t1", "t5", 2, 1));
  byId.set("ub-r1-p2", completedMatch(byId.get("ub-r1-p2")!, "t2", "t6", 2, 0));
  byId.set("ub-r1-p3", completedMatch(byId.get("ub-r1-p3")!, "t3", "t7", 2, 1));
  byId.set("ub-r1-p4", completedMatch(byId.get("ub-r1-p4")!, "t4", "t8", 2, 0));

  // ── UB Round 2 ─────────────────────────────────────────────────────
  patch("ub-r2-p1", { teamA: team("t1"), teamB: team("t2") });
  patch("ub-r2-p2", { teamA: team("t3"), teamB: team("t4") });

  byId.set("ub-r2-p1", completedMatch(byId.get("ub-r2-p1")!, "t1", "t2", 2, 1));
  byId.set("ub-r2-p2", completedMatch(byId.get("ub-r2-p2")!, "t3", "t4", 2, 0));

  // ── UB Round 3 (UB Final) ──────────────────────────────────────────
  patch("ub-r3-p1", { teamA: team("t1"), teamB: team("t3") });
  byId.set("ub-r3-p1", completedMatch(byId.get("ub-r3-p1")!, "t1", "t3", 2, 0));
  // t1 → GF as teamA, t3 → LB Final

  // ── LB Round 1 (pure LB seeds: t9, t10, t11, t12) ─────────────────
  // Generator creates 2 LB R1 matches (reduction: LB seeds vs LB seeds)
  patch("lb-r1-p1", { teamA: team("t9"), teamB: team("t10") });
  patch("lb-r1-p2", { teamA: team("t11"), teamB: team("t12") });

  byId.set("lb-r1-p1", completedMatch(byId.get("lb-r1-p1")!, "t9", "t10", 2, 0));
  byId.set("lb-r1-p2", completedMatch(byId.get("lb-r1-p2")!, "t11", "t12", 2, 1));

  // ── LB Round 2 (drop-down: LB R1 winners face UB R1 losers) ────────
  // LB R2 p1: t9 (LB R1 winner) vs t5 (UB R1 loser)
  // LB R2 p2: t11 (LB R1 winner) vs t6 (UB R1 loser)
  // Note: UB R1 losers enter as teamB per generator linking
  patch("lb-r2-p1", { teamA: team("t9"), teamB: team("t5") });
  patch("lb-r2-p2", { teamA: team("t11"), teamB: team("t6") });

  byId.set("lb-r2-p1", completedMatch(byId.get("lb-r2-p1")!, "t5", "t9", 2, 1));
  byId.set("lb-r2-p2", completedMatch(byId.get("lb-r2-p2")!, "t6", "t11", 2, 0));

  // ── LB Round 3 (reduction: t5 vs t6) ──────────────────────────────
  patch("lb-r3-p1", { teamA: team("t5"), teamB: team("t6") });
  byId.set("lb-r3-p1", completedMatch(byId.get("lb-r3-p1")!, "t5", "t6", 2, 1));

  // ── LB Round 4 (drop-down: t5 vs t2, UB R2 loser) ─────────────────
  patch("lb-r4-p1", { teamA: team("t5"), teamB: team("t2") });
  byId.set("lb-r4-p1", completedMatch(byId.get("lb-r4-p1")!, "t5", "t2", 2, 1));

  // ── LB Round 5 (drop-down: t5 vs t4, UB R2 loser) ─────────────────
  // Wait — generator produces lbTotalRounds = 2*(ubRounds-1) = 2*(3-1) = 4
  // So we have LB R1..R4. Let me handle both cases gracefully below.
  // If lb-r5-p1 exists, patch it.
  if (byId.has("lb-r5-p1")) {
    patch("lb-r5-p1", { teamA: team("t5"), teamB: team("t4") });
    byId.set("lb-r5-p1", completedMatch(byId.get("lb-r5-p1")!, "t5", "t4", 2, 0));
  }
  if (byId.has("lb-r6-p1")) {
    patch("lb-r6-p1", { teamA: team("t5"), teamB: team("t3") });
    byId.set("lb-r6-p1", completedMatch(byId.get("lb-r6-p1")!, "t5", "t3", 2, 1));
  }

  // ── Patch LB Final (last LB round) if not already done ────────────
  // Find the LB match that feeds into GF
  const lbFinalMatch = template.find(
    (m) => m.bracketType === "lower" && m.nextWinnerMatchId === "gf",
  );
  if (lbFinalMatch && !byId.get(lbFinalMatch.id)?.result) {
    patch(lbFinalMatch.id, { teamA: team("t5"), teamB: team("t3") });
    byId.set(
      lbFinalMatch.id,
      completedMatch(byId.get(lbFinalMatch.id)!, "t5", "t3", 2, 1),
    );
  }

  // ── Grand Final (pending) ──────────────────────────────────────────
  patch("gf", {
    teamA: team("t1"), // UB winner
    teamB: team("t5"), // LB winner
    status: "scheduled",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return Array.from(byId.values());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayoffsTestPage() {
  const { theme } = useTournament();
  const t = useTranslations("pdlPlayoffs");
  const [activeView, setActiveView] = useState<BracketView>("upper");

  const matches = useMemo(() => buildMockMatches(), []);

  const hasLower = matches.some((m) => m.bracketType === "lower");

  const accentColor = theme?.secondaryColor || "#D4AF37";
  const glowColor = theme?.primaryColor || "#8B1538";

  return (
    <div className="w-full relative overflow-hidden text-white pt-8">
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
        <div
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-12">
        {/* Header */}
        <div className="text-center space-y-6 mb-16 relative">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] blur-[100px] rounded-full pointer-events-none opacity-10"
            style={{ background: accentColor }}
          />
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs uppercase tracking-widest font-mono mb-4" style={{ color: accentColor }}>
            🧪 Test Page — Mock Data
          </div>
          <h1
            className="text-6xl md:text-7xl font-logik-wide-black tracking-tighter uppercase drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative z-10"
            style={{ color: theme?.titleColor || "white" }}
          >
            Playoffs
          </h1>
          <div className="flex items-center justify-center gap-6 opacity-80 relative z-10">
            <div
              className="h-[1px] w-24"
              style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
            />
            <div className="flex items-center gap-2 tracking-widest uppercase font-logik text-sm" style={{ color: accentColor }}>
              <Trophy className="w-4 h-4" />
              <span>Double Elimination — 8 UB + 4 LB</span>
              <Trophy className="w-4 h-4" />
            </div>
            <div
              className="h-[1px] w-24"
              style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
            />
          </div>
          <p className="text-sm font-logik text-white/30 relative z-10">
            All matches resolved · Only Grand Final remains
          </p>
        </div>

        {/* Bracket container */}
        <div className="flex flex-col">
          {/* UB / LB toggle */}
          {hasLower && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <BracketToggle
                active={activeView === "upper"}
                label={t("upperBracket")}
                onClick={() => setActiveView("upper")}
                color={accentColor}
              />
              <BracketToggle
                active={activeView === "lower"}
                label={t("lowerBracket")}
                onClick={() => setActiveView("lower")}
                color="#ef4444"
              />
            </div>
          )}

          {/* Bracket card */}
          <div className="flex-1 rounded-2xl border border-white/5 bg-white/[0.02] relative overflow-hidden shadow-2xl">
            <div
              className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            <div className="relative z-10 p-4 md:p-6 pt-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, x: activeView === "upper" ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: activeView === "upper" ? 20 : -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <PlayoffBracket matches={matches} view={activeView} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Debug: match list */}
          <details className="mt-8 rounded-xl border border-white/10 bg-black/30 text-xs font-mono">
            <summary className="px-4 py-3 cursor-pointer text-white/40 hover:text-white/70 uppercase tracking-widest">
              Debug — generated matches ({matches.length})
            </summary>
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="text-white/30">
                    <th className="text-left py-1 pr-4">ID</th>
                    <th className="text-left py-1 pr-4">Code</th>
                    <th className="text-left py-1 pr-4">Type</th>
                    <th className="text-left py-1 pr-4">R</th>
                    <th className="text-left py-1 pr-4">P</th>
                    <th className="text-left py-1 pr-4">Team A</th>
                    <th className="text-left py-1 pr-4">Team B</th>
                    <th className="text-left py-1 pr-4">Status</th>
                    <th className="text-left py-1 pr-4">Score</th>
                    <th className="text-left py-1">→ Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {matches
                    .sort((a, b) => {
                      const order = { upper: 0, lower: 1, final: 2, wildcard: 3 };
                      const ao = order[a.bracketType] * 100 + a.round * 10 + a.position;
                      const bo = order[b.bracketType] * 100 + b.round * 10 + b.position;
                      return ao - bo;
                    })
                    .map((m) => (
                      <tr key={m.id} className="border-t border-white/5 text-white/60">
                        <td className="py-0.5 pr-4 text-white/30">{m.id}</td>
                        <td className="py-0.5 pr-4 text-amber-400">{m.code}</td>
                        <td className="py-0.5 pr-4">{m.bracketType}</td>
                        <td className="py-0.5 pr-4">{m.round}</td>
                        <td className="py-0.5 pr-4">{m.position}</td>
                        <td className="py-0.5 pr-4">{m.teamA?.name || "—"}</td>
                        <td className="py-0.5 pr-4">{m.teamB?.name || "—"}</td>
                        <td
                          className="py-0.5 pr-4"
                          style={{ color: m.status === "completed" ? "#4ade80" : m.status === "scheduled" ? "#facc15" : "#f87171" }}
                        >
                          {m.status}
                        </td>
                        <td className="py-0.5 pr-4">
                          {m.result ? `${m.result.teamAScore}–${m.result.teamBScore}` : "—"}
                        </td>
                        <td className="py-0.5 text-white/30">{m.nextWinnerMatchId || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function BracketToggle({
  active,
  label,
  onClick,
  color,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2 rounded-lg font-logik-extended-bold text-sm uppercase tracking-wider transition-all duration-300 border",
        active
          ? "border-opacity-50 shadow-lg"
          : "border-white/10 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10",
      )}
      style={
        active
          ? {
              backgroundColor: `${color}20`,
              borderColor: `${color}50`,
              color,
              boxShadow: `0 0 20px ${color}15`,
            }
          : undefined
      }
    >
      {label}
    </button>
  );
}
