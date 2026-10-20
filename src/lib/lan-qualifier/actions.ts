// src/lib/lan-qualifier/actions.ts
//
// Firestore glue for the LAN-qualifier Swiss format. The format logic is in ./engine.ts and the
// pure storage ↔ engine conversions in ./mapping.ts; storage reuses the Swiss machinery unchanged
// — rounds are swissRounds/{n} drafts that the admin commits into ordinary matches of the Swiss
// division — with each pairing/match tagged with its group (lanStage A/B/F/P) and GSL slot
// (lanSlot o1/o2/w/l/d, or 'tb' for P's tie-settling).

import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MatchFormat, SwissRound } from '@/types/tournament';
import type { SwissPairing } from '@/lib/swiss/pairing';
import { ensureByeTeam } from '@/lib/swiss/actions';
import { plan, type LQConfig, type LQDecisions, type LQMatch, type LQPlan } from './engine';
import { toSwissPairings } from './mapping';

export { seedOrder, lanConfig, lanDecisions, toLQMatches, foreignMatches, toSwissPairings } from './mapping';

/**
 * Build round `round` with the engine and store it as a draft. Returns the engine's plan: when it
 * is not 'pairings' (an earlier round is open, the tiebreak needs a decision, or everything is
 * played) nothing is written.
 */
export async function generateLanDraft(input: {
  tournamentId: string;
  round: number;
  cfg: LQConfig;
  matches: LQMatch[];
  decisions: LQDecisions;
  matchFormat: MatchFormat;
  scheduling: SwissRound['scheduling'];
}): Promise<{ plan: LQPlan; pairings: SwissPairing[] | null }> {
  const p = plan(input.cfg, input.matches, input.decisions, input.round);
  if (p.kind !== 'pairings') return { plan: p, pairings: null };

  const pairings = toSwissPairings(p.pairings);
  if (pairings.some(x => x.isBye)) await ensureByeTeam(input.tournamentId);

  const roundDoc: SwissRound = {
    round: input.round,
    status: 'draft',
    matchFormat: input.matchFormat,
    scheduling: input.scheduling,
    pairings: pairings.map(x => ({ teamAId: x.teamAId, teamBId: x.teamBId, matchId: '', isBye: x.isBye, stage: x.stage, slot: x.slot ?? null })),
    standingsSnapshot: [],
    generatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'tournaments', input.tournamentId, 'swissRounds', String(input.round)), roundDoc);
  return { plan: p, pairings };
}

/** Switch a Swiss tournament between the standard format and the LAN qualifier. */
export async function saveSwissFormat(tournamentId: string, format: 'standard' | 'lan-qualifier'): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'swiss.format': format,
    ...(format === 'lan-qualifier' ? { 'swiss.defaultMatchFormat': 'bo3' } : {}),
    updatedAt: new Date().toISOString(),
  });
}

export async function saveGroupA(tournamentId: string, groupA: string[]): Promise<void> {
  if (groupA.length !== 4 || new Set(groupA).size !== 4) throw new Error('Grupa A to dokładnie 4 różne drużyny.');
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'swiss.lanQualifier.groupA': groupA,
    updatedAt: new Date().toISOString(),
  });
}

export async function saveTiebreakDecision(tournamentId: string, advanced: string[] | null, adminUserId: string): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'swiss.lanQualifier.advanced': advanced,
    'swiss.lanQualifier.decidedAt': advanced ? new Date().toISOString() : null,
    'swiss.lanQualifier.decidedBy': advanced ? adminUserId : null,
    updatedAt: new Date().toISOString(),
  });
}
