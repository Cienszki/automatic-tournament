/**
 * playoff-advancement.ts
 *
 * Pure bracket-advancement logic for the `playoff_matches` system, shared by the admin
 * PlayoffsTab (client) and the server-side result bridge (admin SDK). Operates on an in-memory
 * `Map<string, PlayoffMatch>` and never touches Firestore, so it is safe in both environments.
 *
 * Callers are responsible for persisting whichever docs changed.
 */

import type { PlayoffMatch } from './definitions';
import { isByeTeam } from './playoff-bracket-generator';

export type SlotTeam = { id: string; name: string; logoUrl?: string };

/**
 * Places `team` into the given slot of the target match, unless the target is missing, already
 * completed, or already holds that exact team. Returns true when it actually changed something.
 */
export function setTeamInSlot(
  matchMap: Map<string, PlayoffMatch>,
  targetMatchId: string | undefined,
  targetSlot: 'teamA' | 'teamB' | undefined,
  team: SlotTeam,
  now: string,
): boolean {
  if (!targetMatchId || !targetSlot) return false;

  const nextMatch = matchMap.get(targetMatchId);
  if (!nextMatch || nextMatch.status === 'completed') return false;

  const current = targetSlot === 'teamA' ? nextMatch.teamA : nextMatch.teamB;
  if (current?.id === team.id && current?.name === team.name) {
    return false;
  }

  if (targetSlot === 'teamA') {
    nextMatch.teamA = team;
  } else {
    nextMatch.teamB = team;
  }
  nextMatch.updatedAt = now;
  return true;
}

/**
 * Resolves every match where a slot holds the synthetic BYE placeholder: the real opponent
 * auto-advances. Iterates to a fixed point so chains of byes settle. Mirrors the logic that used
 * to live inline in PlayoffsTab.
 */
export function applyByeAutoAdvancement(matchMap: Map<string, PlayoffMatch>, now: string): void {
  let changed = true;
  let guard = 0;
  const maxIterations = Math.max(matchMap.size * 3, 10);

  while (changed && guard < maxIterations) {
    changed = false;
    guard += 1;

    for (const match of matchMap.values()) {
      if (match.status === 'completed' && !isByeTeam(match.teamA) && !isByeTeam(match.teamB)) {
        continue;
      }

      const teamA = match.teamA;
      const teamB = match.teamB;
      if (!teamA || !teamB) continue;

      const teamAIsBye = isByeTeam(teamA);
      const teamBIsBye = isByeTeam(teamB);
      if (!teamAIsBye && !teamBIsBye) continue;

      const winner = teamAIsBye && !teamBIsBye ? teamB : teamA;
      const loser = winner.id === teamA.id ? teamB : teamA;
      const teamAScore = winner.id === teamA.id ? 1 : 0;
      const teamBScore = winner.id === teamB.id ? 1 : 0;

      const oldStatus = match.status;
      const oldWinnerId = match.result?.winnerId;

      match.status = 'bye';
      match.result = {
        winnerId: winner.id,
        loserId: loser.id,
        teamAScore,
        teamBScore,
        completedAt: now,
      };
      match.updatedAt = now;

      if (oldStatus !== 'bye' || oldWinnerId !== winner.id) {
        changed = true;
      }

      const winnerChanged = setTeamInSlot(matchMap, match.nextWinnerMatchId, match.nextWinnerSlot, winner, now);
      const loserChanged = setTeamInSlot(matchMap, match.nextLoserMatchId, match.nextLoserSlot, loser, now);

      if (winnerChanged || loserChanged) {
        changed = true;
      }
    }
  }
}

/**
 * Records a played result on `matchId` and advances the winner (and, for double-elim, the loser)
 * into their next matches, then settles any byes that result. Returns the set of match ids whose
 * documents changed so the caller can persist exactly those.
 */
export function applyResultAndAdvance(
  matchMap: Map<string, PlayoffMatch>,
  matchId: string,
  winnerId: string,
  loserId: string,
  teamAScore: number,
  teamBScore: number,
  now: string = new Date().toISOString(),
): Set<string> {
  const match = matchMap.get(matchId);
  if (!match || !match.teamA || !match.teamB) return new Set();

  const before = snapshotMap(matchMap);

  match.result = { winnerId, loserId, teamAScore, teamBScore, completedAt: now };
  match.status = 'completed';
  match.updatedAt = now;

  const winnerTeam = match.teamA.id === winnerId ? match.teamA : match.teamB;
  const loserTeam = match.teamA.id === winnerId ? match.teamB : match.teamA;

  setTeamInSlot(matchMap, match.nextWinnerMatchId, match.nextWinnerSlot, winnerTeam, now);
  setTeamInSlot(matchMap, match.nextLoserMatchId, match.nextLoserSlot, loserTeam, now);

  applyByeAutoAdvancement(matchMap, now);

  // Diff against the snapshot so the caller only writes docs that actually changed.
  const changed = new Set<string>();
  for (const [id, m] of matchMap) {
    if (before.get(id) !== JSON.stringify(m)) changed.add(id);
  }
  return changed;
}

function snapshotMap(matchMap: Map<string, PlayoffMatch>): Map<string, string> {
  const snap = new Map<string, string>();
  for (const [id, m] of matchMap) snap.set(id, JSON.stringify(m));
  return snap;
}
