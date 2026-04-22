"use client";

import type { Match } from "@/lib/definitions";
import { SchedulePageLayout } from "@/components/schedule/MatchdayCarousel";

import { useTournament } from "@/context/TournamentContext";

// ─── Mock team helpers ────────────────────────────────────────────────────────

function team(id: string, name: string, score = 0) {
  return { id, name, score, logoUrl: "" };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns an ISO date string offset by `daysFromNow` days and a given time. */
function dt(daysFromNow: number, time = "20:00"): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// ─── Mock matches ─────────────────────────────────────────────────────────────
// Spread over ~6 weeks: past (completed) + present week + upcoming.
// With MATCHES_PER_COLUMN = 4, this gives ~6 columns — good for testing
// the auto-centering logic and single-column scroll arrows.

const MOCK_MATCHES: Match[] = [
  // ── Column 1 — 3 weeks ago ──────────────────────────────────────────────
  {
    id: "mock-1",
    teamA: { ...team("t1", "Void Walkers"), score: 2 },
    teamB: { ...team("t2", "Storm Riders"), score: 0 },
    teams: ["t1", "t2"],
    status: "completed",
    scheduledFor: dt(-21, "19:00"),
    completed_at: dt(-21, "21:30"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 1,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-2",
    teamA: { ...team("t3", "Night Owls"), score: 1 },
    teamB: { ...team("t4", "Iron Fist"), score: 1 },
    teams: ["t3", "t4"],
    status: "completed",
    scheduledFor: dt(-21, "20:00"),
    completed_at: dt(-21, "22:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 1,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-3",
    teamA: { ...team("t5", "Silver Wolves"), score: 0 },
    teamB: { ...team("t6", "Dragon Squad"), score: 2 },
    teams: ["t5", "t6"],
    status: "completed",
    scheduledFor: dt(-21, "21:00"),
    completed_at: dt(-21, "23:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 1,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-4",
    teamA: { ...team("t7", "Crystal Daggers"), score: 2 },
    teamB: { ...team("t8", "Red Tide"), score: 1 },
    teams: ["t7", "t8"],
    status: "completed",
    scheduledFor: dt(-21, "21:30"),
    completed_at: dt(-21, "23:45"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 1,
    bestOf: 2,
    group_id: "mmr",
  },

  // ── Column 2 — 2 weeks ago ──────────────────────────────────────────────
  {
    id: "mock-5",
    teamA: { ...team("t2", "Storm Riders"), score: 1 },
    teamB: { ...team("t3", "Night Owls"), score: 1 },
    teams: ["t2", "t3"],
    status: "completed",
    scheduledFor: dt(-14, "19:00"),
    completed_at: dt(-14, "21:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 2,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-6",
    teamA: { ...team("t4", "Iron Fist"), score: 2 },
    teamB: { ...team("t5", "Silver Wolves"), score: 0 },
    teams: ["t4", "t5"],
    status: "completed",
    scheduledFor: dt(-14, "20:00"),
    completed_at: dt(-14, "22:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 2,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-7",
    teamA: { ...team("t6", "Dragon Squad"), score: 0 },
    teamB: { ...team("t7", "Crystal Daggers"), score: 2 },
    teams: ["t6", "t7"],
    status: "completed",
    scheduledFor: dt(-14, "20:30"),
    completed_at: dt(-14, "22:45"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 2,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-8",
    teamA: { ...team("t1", "Void Walkers"), score: 2 },
    teamB: { ...team("t8", "Red Tide"), score: 1 },
    teams: ["t1", "t8"],
    status: "completed",
    scheduledFor: dt(-14, "21:00"),
    completed_at: dt(-14, "23:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 2,
    bestOf: 2,
    group_id: "mmr",
  },

  // ── Column 3 — last week (now the "next upcoming" target) ───────────────
  {
    id: "mock-9",
    teamA: team("t3", "Night Owls"),
    teamB: team("t6", "Dragon Squad"),
    teams: ["t3", "t6"],
    status: "scheduled",
    scheduledFor: dt(-3, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 3,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-10",
    teamA: team("t5", "Silver Wolves"),
    teamB: team("t2", "Storm Riders"),
    teams: ["t5", "t2"],
    status: "scheduled",
    scheduledFor: dt(-3, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 3,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-11",
    teamA: team("t8", "Red Tide"),
    teamB: team("t4", "Iron Fist"),
    teams: ["t8", "t4"],
    status: "scheduled",
    scheduledFor: dt(-2, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 3,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-12",
    teamA: team("t7", "Crystal Daggers"),
    teamB: team("t1", "Void Walkers"),
    teams: ["t7", "t1"],
    status: "scheduled",
    scheduledFor: dt(-2, "21:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 3,
    bestOf: 2,
    group_id: "mmr",
  },

  // ── Column 4 — this week / next few days ────────────────────────────────
  {
    id: "mock-13",
    teamA: team("t1", "Void Walkers"),
    teamB: team("t4", "Iron Fist"),
    teams: ["t1", "t4"],
    status: "scheduled",
    scheduledFor: dt(2, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 4,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-14",
    teamA: team("t2", "Storm Riders"),
    teamB: team("t6", "Dragon Squad"),
    teams: ["t2", "t6"],
    status: "scheduled",
    scheduledFor: dt(2, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 4,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-15",
    teamA: team("t3", "Night Owls"),
    teamB: team("t7", "Crystal Daggers"),
    teams: ["t3", "t7"],
    status: "scheduled",
    scheduledFor: dt(3, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 4,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-16",
    teamA: team("t5", "Silver Wolves"),
    teamB: team("t8", "Red Tide"),
    teams: ["t5", "t8"],
    status: "scheduled",
    scheduledFor: dt(3, "21:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 4,
    bestOf: 2,
    group_id: "mmr",
  },

  // ── Column 5 — next week ─────────────────────────────────────────────────
  {
    id: "mock-17",
    teamA: team("t6", "Dragon Squad"),
    teamB: team("t8", "Red Tide"),
    teams: ["t6", "t8"],
    status: "scheduled",
    scheduledFor: dt(10, "19:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 5,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-18",
    teamA: team("t7", "Crystal Daggers"),
    teamB: team("t5", "Silver Wolves"),
    teams: ["t7", "t5"],
    status: "scheduled",
    scheduledFor: dt(10, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 5,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-19",
    teamA: team("t4", "Iron Fist"),
    teamB: team("t3", "Night Owls"),
    teams: ["t4", "t3"],
    status: "scheduled",
    scheduledFor: dt(11, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 5,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-20",
    teamA: team("t2", "Storm Riders"),
    teamB: team("t1", "Void Walkers"),
    teams: ["t2", "t1"],
    status: "scheduled",
    scheduledFor: dt(11, "21:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 5,
    bestOf: 2,
    group_id: "mmr",
  },

  // ── Column 6 — in two weeks ──────────────────────────────────────────────
  {
    id: "mock-21",
    teamA: team("t1", "Void Walkers"),
    teamB: team("t6", "Dragon Squad"),
    teams: ["t1", "t6"],
    status: "scheduled",
    scheduledFor: dt(17, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 6,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-22",
    teamA: team("t3", "Night Owls"),
    teamB: team("t8", "Red Tide"),
    teams: ["t3", "t8"],
    status: "scheduled",
    scheduledFor: dt(17, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 6,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-23",
    teamA: team("t5", "Silver Wolves"),
    teamB: team("t4", "Iron Fist"),
    teams: ["t5", "t4"],
    status: "scheduled",
    scheduledFor: dt(18, "20:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 6,
    bestOf: 2,
    group_id: "mmr",
  },
  {
    id: "mock-24",
    teamA: team("t2", "Storm Riders"),
    teamB: team("t7", "Crystal Daggers"),
    teams: ["t2", "t7"],
    status: "scheduled",
    scheduledFor: dt(18, "21:00"),
    schedulingStatus: "confirmed",
    round: 1,
    matchday: 6,
    bestOf: 2,
    group_id: "mmr",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScheduleTestingPage() {
  const { theme } = useTournament();

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">
      {/* ── Background atmosphere (mirrors real schedule page) ────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)",
          }}
        />
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme?.primaryColor || "#3b82f6" }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: "#dc2626" }}
        />
      </div>

      {/* ── Schedule content — same component as the real /schedule page ─ */}
      <div className="relative z-10">
        <SchedulePageLayout matches={MOCK_MATCHES} />
      </div>
    </div>
  );
}
