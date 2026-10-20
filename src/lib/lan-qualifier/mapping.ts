// src/lib/lan-qualifier/mapping.ts
//
// Pure conversions between the Swiss storage (teams, stored matches) and the LAN-qualifier engine.
// No Firestore here, so admin, public views and tests share exactly the same mapping.

import type { LanQualifierConfig } from '@/types/tournament';
import { SWISS_BYE_TEAM_ID, isSwissByeTeam, type SwissPairing } from '@/lib/swiss/pairing';
import type { SwissRoundMatch, SwissTeam } from '@/lib/swiss/actions';
import { PLACEMENT_ROUNDS, type LQConfig, type LQDecisions, type LQMatch, type LQPairing } from './engine';

/** The field in seed order (best first): seed MMR, then name — the Swiss tab's order. */
export function seedOrder(teams: SwissTeam[], divisionId = 'swiss'): SwissTeam[] {
  return teams
    .filter(t => !t.isSwissBye && t.divisionId === divisionId)
    .sort((a, b) => (b.seedMmr ?? -1) - (a.seedMmr ?? -1) || a.name.localeCompare(b.name));
}

/** The engine's view of the field: the top group (stored pick, else the 4 best seeds) and the rest. */
export function lanConfig(teams: SwissTeam[], lq?: LanQualifierConfig | null, divisionId = 'swiss'): LQConfig {
  const order = seedOrder(teams, divisionId).map(t => t.id);
  const seed = Object.fromEntries(order.map((id, i) => [id, i + 1]));
  const stored = (lq?.groupA ?? []).filter(id => id in seed);
  const groupA = (stored.length === 4 ? stored : order.slice(0, 4)).sort((x, y) => seed[x] - seed[y]);
  return { groupA, groupB: order.filter(id => !groupA.includes(id)), seed, placementRounds: PLACEMENT_ROUNDS };
}

export function lanDecisions(lq?: LanQualifierConfig | null): LQDecisions {
  return { advanced: lq?.advanced ?? null };
}

/** Stored matches of the format → engine matches (byes become `b: null`, the real team as `a`). */
export function toLQMatches(ms: SwissRoundMatch[]): LQMatch[] {
  return ms
    .filter(m => m.stage)
    .map(m => {
      const byeA = isSwissByeTeam(m.teamAId);
      const bye = byeA || isSwissByeTeam(m.teamBId);
      const a = byeA ? m.teamBId : m.teamAId;
      const b = bye ? null : m.teamBId;
      const sa = byeA ? m.scoreB : m.scoreA;
      const sb = byeA ? m.scoreA : m.scoreB;
      const done = m.status === 'completed';
      const winner = !done ? null : bye ? a : m.winnerId ?? (sa > sb ? a : sb > sa ? b : null);
      return { id: m.id, stage: m.stage!, slot: (m.slot ?? undefined) as LQMatch['slot'], round: m.round, a, b, sa, sb, done, winner };
    });
}

/** Engine pairings → the Swiss draft's pairings (a bye is played against the BYE sentinel team). */
export function toSwissPairings(pairings: LQPairing[]): SwissPairing[] {
  return pairings.map(pr => ({
    teamAId: pr.a,
    teamBId: pr.b ?? SWISS_BYE_TEAM_ID,
    isBye: !pr.b,
    stage: pr.stage,
    slot: pr.slot ?? null,
  }));
}

/** Matches of the Swiss division that do not belong to the format (e.g. rounds from before the switch). */
export function foreignMatches(ms: SwissRoundMatch[]): SwissRoundMatch[] {
  return ms.filter(m => !m.stage);
}
