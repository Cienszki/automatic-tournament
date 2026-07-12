/**
 * playoff-result-bridge.ts (server / admin SDK)
 *
 * When a mirrored playoff match (a `tournaments/{id}/matches` doc carrying `playoff_match_id`)
 * finishes, copy its result onto the `playoff_matches` bracket doc, advance the winner (and, for
 * double-elim, the loser) into their next matches, and create/update the mirror docs for any next
 * match that now has both teams. Idempotent — safe to call repeatedly for the same completed match.
 */

import type { PlayoffMatch } from './definitions';
import { applyResultAndAdvance } from './playoff-advancement';
import { shouldMirror, buildMirrorCreateData, buildMirrorTeamsPatch } from './playoff-mirror';

/** Strips undefined recursively — Firestore admin rejects undefined values. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Bridges the completed mirror match `matchId` back to the bracket. Reads the final score/winner
 * from the mirror doc, so callers should invoke this only after the match doc is marked completed.
 */
export async function bridgePlayoffResult(tournamentId: string, matchId: string): Promise<void> {
  const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const tRef = db.collection('tournaments').doc(tournamentId);
  const mirrorSnap = await tRef.collection('matches').doc(matchId).get();
  if (!mirrorSnap.exists) return;
  const mirror = mirrorSnap.data()!;

  const playoffMatchId: string | undefined = mirror.playoff_match_id;
  if (!playoffMatchId) return; // not a playoff mirror
  if (mirror.status !== 'completed') return; // only bridge finished series

  const winnerId: string | null = mirror.winnerId ?? null;
  if (!winnerId) return; // playoff series always have a winner; a null winner means not decided

  const teamAId = mirror.teams?.[0] ?? mirror.teamA?.id;
  const teamBId = mirror.teams?.[1] ?? mirror.teamB?.id;
  const loserId = winnerId === teamAId ? teamBId : teamAId;
  const teamAScore = Number(mirror.teamA?.score ?? 0);
  const teamBScore = Number(mirror.teamB?.score ?? 0);

  // Load the whole bracket into memory and advance.
  const pmSnap = await tRef.collection('playoff_matches').get();
  const map = new Map<string, PlayoffMatch>();
  pmSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as PlayoffMatch));

  if (!map.has(playoffMatchId)) return;

  const now = new Date().toISOString();
  const changed = applyResultAndAdvance(
    map,
    playoffMatchId,
    winnerId,
    loserId,
    teamAScore,
    teamBScore,
    now,
  );
  if (changed.size === 0) return;

  const batch = db.batch();

  for (const id of changed) {
    const pm = map.get(id)!;
    // Persist the updated bracket doc (result / status / advanced teams).
    batch.set(tRef.collection('playoff_matches').doc(id), clean(pm), { merge: true });
  }
  await batch.commit();

  // Create/update mirror docs for any changed match that is now playable, so the next round can
  // be scheduled and picked up by the bot exactly like a group match. The just-completed match's
  // mirror already exists (its score is untouched by the teams-only patch).
  for (const id of changed) {
    const pm = map.get(id)!;
    if (!shouldMirror(pm)) continue;
    const mRef = tRef.collection('matches').doc(id);
    const existing = await mRef.get();
    if (existing.exists) {
      await mRef.set(clean(buildMirrorTeamsPatch(pm)), { merge: true });
    } else {
      await mRef.set(clean(buildMirrorCreateData(pm)));
    }
  }
}

/**
 * Reverses a playoff match's advancement after its mirror was un-completed (revert forfeit,
 * delete game, etc.). Clears the bracket doc's result/status and removes the winner/loser this
 * match had pushed into its next matches — but only when those next matches are NOT themselves
 * decided. Deep cascades are intentionally NOT performed: an admin must revert a later round
 * before an earlier one, which matches how brackets are unwound in practice.
 */
export async function revertPlayoffResult(tournamentId: string, matchId: string): Promise<void> {
  const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();

  const tRef = db.collection('tournaments').doc(tournamentId);
  const pmSnap = await tRef.collection('playoff_matches').get();
  const map = new Map<string, PlayoffMatch>();
  pmSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as PlayoffMatch));

  const m = map.get(matchId);
  if (!m) return;

  const now = new Date().toISOString();
  const prevWinnerId = m.result?.winnerId;
  const prevLoserId = m.result?.loserId;
  const changed = new Set<string>();

  if (m.result || m.status === 'completed' || m.status === 'bye') {
    m.result = undefined;
    m.status = 'scheduled';
    m.updatedAt = now;
    changed.add(m.id);
  }

  // Remove a team from a downstream slot only if that slot still holds the team THIS match sent
  // there and the downstream match hasn't been decided.
  const clearSlot = (targetId?: string, slot?: 'teamA' | 'teamB', teamId?: string) => {
    if (!targetId || !slot || !teamId) return;
    const t = map.get(targetId);
    if (!t || t.status === 'completed' || t.status === 'bye') return;
    const cur = slot === 'teamA' ? t.teamA : t.teamB;
    if (cur?.id === teamId) {
      if (slot === 'teamA') t.teamA = undefined;
      else t.teamB = undefined;
      t.updatedAt = now;
      changed.add(targetId);
    }
  };
  clearSlot(m.nextWinnerMatchId, m.nextWinnerSlot, prevWinnerId);
  clearSlot(m.nextLoserMatchId, m.nextLoserSlot, prevLoserId);

  if (changed.size === 0) return;

  // Full overwrite (no merge) so the cleared result / team fields are actually removed.
  for (const id of changed) {
    await tRef.collection('playoff_matches').doc(id).set(clean(map.get(id)!));
  }

  // A downstream match that just lost a team is no longer playable — drop its (unplayed) mirror
  // so it disappears from the schedule / my-team until it is re-derived.
  for (const id of changed) {
    if (id === matchId) continue;
    if (shouldMirror(map.get(id)!)) continue;
    const mRef = tRef.collection('matches').doc(id);
    const ex = await mRef.get();
    if (ex.exists && ex.data()?.status !== 'completed') {
      await mRef.delete();
    }
  }
}
