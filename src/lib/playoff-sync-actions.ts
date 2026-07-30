"use server";

import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import { bridgePlayoffResult, revertPlayoffResult } from './playoff-result-bridge';

/**
 * Syncs a playoff bracket from its mirror match after a MANUAL admin score edit. The normal
 * game-sync / forfeit paths fire the bridge automatically, but a hand-edited score saved from the
 * Matches admin tab does not — so the bracket (`playoff_matches`) would keep showing the old
 * result. This ensures `winnerId` is set from the scores, then advances the bracket when the match
 * is completed (or reverts it when un-completed). No-op for non-playoff matches.
 */
export async function syncPlayoffResultFromMirror(
  tournamentId: string,
  matchId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    const ref = db.collection('tournaments').doc(tournamentId).collection('matches').doc(matchId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'Match not found' };
    const m = snap.data() as Record<string, any>;

    if (!m.playoff_match_id) return { success: true }; // not a playoff mirror — nothing to do

    if (m.status === 'completed') {
      const teamAId = m.teams?.[0] ?? m.teamA?.id;
      const teamBId = m.teams?.[1] ?? m.teamB?.id;
      const aScore = Number(m.teamA?.score ?? 0);
      const bScore = Number(m.teamB?.score ?? 0);
      // Manual score edits don't set winnerId — derive it from the scores so the bridge can advance.
      let winnerId: string | null = m.winnerId ?? null;
      if (!winnerId && aScore !== bScore) {
        winnerId = aScore > bScore ? teamAId : teamBId;
        await ref.update({ winnerId });
      }
      if (!winnerId) return { success: false, error: 'Remis — brak zwycięzcy, drabinka nie awansuje.' };
      await bridgePlayoffResult(tournamentId, matchId);
    } else {
      // Un-completed (e.g. status changed back to scheduled) — pull the advancement.
      await revertPlayoffResult(tournamentId, matchId);
    }

    return { success: true };
  } catch (e) {
    console.error('[playoff-sync] syncPlayoffResultFromMirror error', e);
    return { success: false, error: (e as Error).message };
  }
}
