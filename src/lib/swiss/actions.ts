// src/lib/swiss/actions.ts
//
// Firestore read/write layer for Swiss tournaments.
//
// The pairing maths lives in ./pairing.ts and stays free of Firestore. This file
// is the only place that knows how a Swiss round is persisted.
//
// Storage shape, and why:
//   - The whole Swiss field lives in ONE auto-created division. That lets the
//     existing standings table, schedule views, match-detail modal and
//     match-by-divisionId queries work unchanged.
//   - Each generated round is a doc at tournaments/{id}/swissRounds/{round}.
//     A 'draft' round is a regenerable preview; committing writes the matches.

import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MatchFormat, SwissRound, SwissStandingRow } from '@/types/tournament';
import {
  SWISS_BYE_TEAM_ID,
  isSwissByeTeam,
  buildSwissHistory,
  computeSwissStandings,
  generatePairings,
  type SwissMatchResult,
  type SwissPairing,
} from './pairing';

/** Division name used for the single auto-created Swiss division. */
export const SWISS_DIVISION_ID = 'swiss';
export const SWISS_DIVISION_NAME = 'Swiss';

export interface SwissTeam {
  id: string;
  name: string;
  tag?: string;
  logoUrl?: string;
  status?: string;
  divisionId?: string | null;
  seedMmr?: number;
  seedPosition?: number;
  isSwissBye?: boolean;
}

export interface SwissRoundMatch {
  id: string;
  round: number;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  status: string;
  scheduledFor?: string | null;
  isBye: boolean;
}

/** Games the winner needs, and therefore the walkover score, for a format. */
export function gamesToWin(format: MatchFormat): number {
  switch (format) {
    case 'bo1': return 1;
    case 'bo2': return 2; // bo2 is played in full; a walkover takes both games
    case 'bo3': return 2;
    case 'bo5': return 3;
    case 'bo7': return 4;
    default: return 2;
  }
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function loadSwissTeams(tournamentId: string): Promise<SwissTeam[]> {
  const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'teams'));
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? d.id,
      tag: data.tag,
      logoUrl: data.logoUrl,
      status: data.status,
      divisionId: data.divisionId ?? null,
      seedMmr: typeof data.seedMmr === 'number' ? data.seedMmr : undefined,
      seedPosition: typeof data.seedPosition === 'number' ? data.seedPosition : undefined,
      isSwissBye: data.isSwissBye === true,
    };
  });
}

/**
 * Load every match belonging to the Swiss division.
 *
 * Queried by `divisionId` only, then filtered/sorted in memory. Adding `round`
 * to the query would need the composite index to be live, and this keeps the
 * admin tab working even before that index is deployed.
 */
export async function loadSwissMatches(
  tournamentId: string,
  divisionId: string
): Promise<SwissRoundMatch[]> {
  const q = query(
    collection(db, 'tournaments', tournamentId, 'matches'),
    where('divisionId', '==', divisionId)
  );
  const snap = await getDocs(q);

  return snap.docs
    .map(d => {
      const m = d.data();
      const teamAId = m.teamA?.id ?? '';
      const teamBId = m.teamB?.id ?? '';
      return {
        id: d.id,
        round: typeof m.round === 'number' ? m.round : 0,
        teamAId,
        teamBId,
        scoreA: typeof m.teamA?.score === 'number' ? m.teamA.score : 0,
        scoreB: typeof m.teamB?.score === 'number' ? m.teamB.score : 0,
        status: m.status ?? 'scheduled',
        scheduledFor: m.scheduledFor ?? null,
        isBye: isSwissByeTeam(teamAId) || isSwissByeTeam(teamBId),
      };
    })
    .sort((a, b) => a.round - b.round);
}

/** Flatten matches into the shape the pairing engine consumes. */
export function toSwissResults(matches: SwissRoundMatch[]): SwissMatchResult[] {
  return matches.map(m => ({
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    round: m.round,
    completed: m.status === 'completed',
  }));
}

export async function loadSwissRounds(tournamentId: string): Promise<SwissRound[]> {
  const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'swissRounds'));
  return snap.docs
    .map(d => d.data() as SwissRound)
    .sort((a, b) => a.round - b.round);
}

/**
 * Compute the live Swiss table.
 *
 * `includeBye` controls whether the sentinel appears as a row. The admin tab and
 * the public table both show it, so a walkover win has a visible explanation.
 */
export function buildStandings(
  teams: SwissTeam[],
  matches: SwissRoundMatch[],
  includeBye = true
): SwissStandingRow[] {
  const participating = teams.filter(t => !t.isSwissBye);
  const ids = participating.map(t => t.id);
  if (includeBye && matches.some(m => m.isBye)) ids.push(SWISS_BYE_TEAM_ID);

  const seedMmr: Record<string, number | undefined> = {};
  for (const t of participating) seedMmr[t.id] = t.seedMmr;

  return computeSwissStandings(ids, toSwissResults(matches), seedMmr);
}

// ── setup ────────────────────────────────────────────────────────────────────

/**
 * Create the Swiss division and assign every eligible team to it.
 *
 * Idempotent: safe to re-run after more teams register, which is the normal case
 * since registration and setup overlap in practice.
 */
export async function setupSwissField(
  tournamentId: string,
  opts: { includeUnverified?: boolean } = {}
): Promise<{ divisionId: string; assigned: number; total: number }> {
  const divisionRef = doc(db, 'tournaments', tournamentId, 'divisions', SWISS_DIVISION_ID);
  const existing = await getDoc(divisionRef);
  if (!existing.exists()) {
    await setDoc(divisionRef, {
      name: SWISS_DIVISION_NAME,
      tier: 1,
      color: '#6366f1',
      // Marks this as the Swiss field rather than an ordinary division, so UI can
      // pick the Swiss column set without inferring from the tournament type.
      isSwissField: true,
      createdAt: new Date().toISOString(),
    });
  }

  const teams = await loadSwissTeams(tournamentId);
  const eligible = teams.filter(t => {
    if (t.isSwissBye) return false;
    if (opts.includeUnverified) return true;
    return t.status === 'verified';
  });

  const batch = writeBatch(db);
  let assigned = 0;
  for (const t of eligible) {
    if (t.divisionId === SWISS_DIVISION_ID) continue;
    batch.update(doc(db, 'tournaments', tournamentId, 'teams', t.id), {
      divisionId: SWISS_DIVISION_ID,
      updatedAt: new Date().toISOString(),
    });
    assigned++;
  }
  if (assigned > 0) await batch.commit();

  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'swiss.divisionId': SWISS_DIVISION_ID,
    updatedAt: new Date().toISOString(),
  });

  return { divisionId: SWISS_DIVISION_ID, assigned, total: eligible.length };
}

/**
 * Ensure the virtual BYE opponent exists as a real (hidden) team document.
 *
 * Making it a real doc means every downstream consumer — match detail modals,
 * team-name lookups, standings — resolves its id like any other team instead of
 * needing a special case. It is excluded from public team lists via `isSwissBye`.
 */
export async function ensureByeTeam(tournamentId: string): Promise<string> {
  const ref = doc(db, 'tournaments', tournamentId, 'teams', SWISS_BYE_TEAM_ID);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      name: 'BYE',
      tag: 'BYE',
      logoUrl: '',
      captainId: '',
      status: 'eliminated',
      divisionId: SWISS_DIVISION_ID,
      // Hides it from public team grids and excludes it from the Swiss field.
      isSwissBye: true,
      seedMmr: 0,
      createdAt: new Date().toISOString(),
    });
  }
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'swiss.byeTeamId': SWISS_BYE_TEAM_ID,
  });
  return SWISS_BYE_TEAM_ID;
}

export async function saveSeedMmr(
  tournamentId: string,
  teamId: string,
  seedMmr: number | null
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'teams', teamId), {
    seedMmr: seedMmr,
    updatedAt: new Date().toISOString(),
  });
}

/** Recompute and persist `seedPosition` (1 = highest seed MMR) for the field. */
export async function renumberSeeds(tournamentId: string): Promise<number> {
  const teams = (await loadSwissTeams(tournamentId)).filter(
    t => !t.isSwissBye && t.divisionId === SWISS_DIVISION_ID
  );
  const ordered = [...teams].sort((a, b) => {
    const ma = a.seedMmr ?? -1;
    const mb = b.seedMmr ?? -1;
    if (ma !== mb) return mb - ma;
    return a.name.localeCompare(b.name);
  });

  const batch = writeBatch(db);
  ordered.forEach((t, i) => {
    batch.update(doc(db, 'tournaments', tournamentId, 'teams', t.id), {
      seedPosition: i + 1,
    });
  });
  await batch.commit();
  return ordered.length;
}

// ── round generation ─────────────────────────────────────────────────────────

export interface GenerateDraftInput {
  tournamentId: string;
  round: number;
  matchFormat: MatchFormat;
  scheduling: SwissRound['scheduling'];
  allowConsecutiveRematch?: boolean;
  teams: SwissTeam[];
  matches: SwissRoundMatch[];
}

export interface GeneratedDraft {
  round: SwissRound;
  warnings: string[];
}

/**
 * Build a draft round and persist it as `status: 'draft'`.
 *
 * Nothing in the matches collection is touched — the admin can regenerate or
 * hand-edit a draft freely, and only `commitRound` makes it real.
 */
export async function generateRoundDraft(input: GenerateDraftInput): Promise<GeneratedDraft> {
  const { tournamentId, round, matchFormat, scheduling, allowConsecutiveRematch } = input;

  const standings = buildStandings(input.teams, input.matches, false);
  const history = buildSwissHistory(toSwissResults(input.matches));
  const result = generatePairings(standings, history, { allowConsecutiveRematch });

  const roundDoc: SwissRound = {
    round,
    status: 'draft',
    matchFormat,
    scheduling,
    pairings: result.pairings.map(p => ({
      teamAId: p.teamAId,
      teamBId: p.teamBId,
      matchId: '',
      isBye: p.isBye,
    })),
    standingsSnapshot: standings,
    generatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'tournaments', tournamentId, 'swissRounds', String(round)), roundDoc);
  return { round: roundDoc, warnings: result.warnings };
}

/** Persist a hand-edited draft (admin swapped pairs in the preview). */
export async function saveDraftPairings(
  tournamentId: string,
  round: number,
  pairings: SwissPairing[]
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'swissRounds', String(round)), {
    pairings: pairings.map(p => ({
      teamAId: p.teamAId,
      teamBId: p.teamBId,
      matchId: '',
      isBye: p.isBye,
    })),
  });
}

/**
 * Turn a draft into real matches.
 *
 * Bye matches are written already-completed with a `forfeit` record and
 * `isSwissByeMatch`, in the same batch as everything else. Going through
 * /api/admin/pdl/forfeit-match instead would cost a round trip per bye and would
 * trigger that route's league-only standings recalculation.
 */
export async function commitRound(input: {
  tournamentId: string;
  round: number;
  divisionId: string;
  matchFormat: MatchFormat;
  scheduling: SwissRound['scheduling'];
  pairings: SwissPairing[];
  teamsById: Record<string, SwissTeam>;
  adminUserId: string;
}): Promise<{ created: number; byes: number }> {
  const {
    tournamentId, round, divisionId, matchFormat, scheduling, pairings, teamsById, adminUserId,
  } = input;

  const batch = writeBatch(db);
  const matchesRef = collection(db, 'tournaments', tournamentId, 'matches');
  const now = new Date().toISOString();
  const winScore = gamesToWin(matchFormat);
  const bestOf = matchFormat === 'bo2' ? 2 : winScore * 2 - 1;

  const scheduledFor =
    scheduling.mode === 'fixed' && scheduling.fixedAt ? scheduling.fixedAt : null;
  const schedulingStatus = scheduledFor ? 'confirmed' : 'unscheduled';

  const persistedPairings: SwissRound['pairings'] = [];
  let byes = 0;

  for (const p of pairings) {
    const ref = doc(matchesRef);
    const teamA = teamsById[p.teamAId];
    const teamB = teamsById[p.teamBId];

    const side = (id: string, t: SwissTeam | undefined, score: number) => ({
      id,
      name: t?.name ?? (isSwissByeTeam(id) ? 'BYE' : id),
      score,
      logoUrl: t?.logoUrl ?? '',
    });

    if (p.isBye) {
      byes++;
      // The real team takes the full series; the sentinel forfeits.
      const byeIsA = isSwissByeTeam(p.teamAId);
      const scoreA = byeIsA ? 0 : winScore;
      const scoreB = byeIsA ? winScore : 0;
      const winnerId = byeIsA ? p.teamBId : p.teamAId;

      batch.set(ref, {
        id: ref.id,
        tournamentId,
        teamA: side(p.teamAId, teamA, scoreA),
        teamB: side(p.teamBId, teamB, scoreB),
        teams: [p.teamAId, p.teamBId],
        divisionId,
        round,
        matchday: round,
        series_format: matchFormat,
        bestOf,
        status: 'completed',
        winnerId,
        completed_at: now,
        scheduledFor: scheduledFor ?? now,
        schedulingStatus: 'confirmed',
        schedulingMethod: 'admin-scheduled',
        game_ids: [],
        forfeit: {
          forfeitingTeam: byeIsA ? 'teamA' : 'teamB',
          scope: 'series',
          reason: 'Wolny los (nieparzysta liczba drużyn)',
          issuedAt: now,
          issuedBy: adminUserId,
        },
        // Keeps walkovers out of schedule views, mirroring `isBanForfeit`.
        isSwissByeMatch: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      batch.set(ref, {
        id: ref.id,
        tournamentId,
        teamA: side(p.teamAId, teamA, 0),
        teamB: side(p.teamBId, teamB, 0),
        teams: [p.teamAId, p.teamBId],
        divisionId,
        round,
        matchday: round,
        series_format: matchFormat,
        bestOf,
        status: 'scheduled',
        scheduledFor,
        schedulingStatus,
        schedulingMethod: scheduledFor ? 'admin-scheduled' : 'captain-scheduled',
        ...(scheduling.mode === 'window' && scheduling.windowEnd
          ? { deadline: scheduling.windowEnd }
          : {}),
        game_ids: [],
        result: null,
        winner: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    persistedPairings.push({
      teamAId: p.teamAId,
      teamBId: p.teamBId,
      matchId: ref.id,
      isBye: p.isBye,
    });
  }

  batch.update(doc(db, 'tournaments', tournamentId, 'swissRounds', String(round)), {
    status: 'committed',
    pairings: persistedPairings,
    committedAt: now,
  });

  batch.update(doc(db, 'tournaments', tournamentId), {
    'swiss.currentRound': round,
    updatedAt: now,
  });

  await batch.commit();
  return { created: pairings.length, byes };
}

/**
 * Delete a committed round's matches and return it to draft.
 *
 * Refuses when any match already has games synced, because those results would
 * be silently destroyed.
 */
export async function reopenRound(
  tournamentId: string,
  round: number,
  divisionId: string
): Promise<{ deleted: number }> {
  const matches = (await loadSwissMatches(tournamentId, divisionId)).filter(
    m => m.round === round
  );

  for (const m of matches) {
    if (m.isBye) continue;
    const games = await getDocs(
      collection(db, 'tournaments', tournamentId, 'matches', m.id, 'games')
    );
    if (!games.empty) {
      throw new Error(
        `Mecz ${m.teamAId} vs ${m.teamBId} ma już zaimportowane gry. ` +
        `Usuń je najpierw, albo zostaw rundę bez zmian.`
      );
    }
  }

  const batch = writeBatch(db);
  for (const m of matches) {
    batch.delete(doc(db, 'tournaments', tournamentId, 'matches', m.id));
  }
  batch.update(doc(db, 'tournaments', tournamentId, 'swissRounds', String(round)), {
    status: 'draft',
    committedAt: null,
  });
  await batch.commit();

  return { deleted: matches.length };
}

export async function markRoundComplete(tournamentId: string, round: number): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'swissRounds', String(round)), {
    status: 'complete',
  });
}

export async function deleteRoundDraft(tournamentId: string, round: number): Promise<void> {
  await deleteDoc(doc(db, 'tournaments', tournamentId, 'swissRounds', String(round)));
}

/**
 * Force a result on a match that was never played, so the round can close and
 * the next one be generated.
 *
 * Swiss is serial: round N+1 cannot exist until round N is complete, so a single
 * unresponsive team blocks the entire field. This is the release valve.
 */
export async function forceMatchResult(input: {
  tournamentId: string;
  matchId: string;
  matchFormat: MatchFormat;
  /** Which side forfeits, or 'both' for a double no-show (0-0). */
  forfeitingTeam: 'teamA' | 'teamB' | 'both';
  teamAId: string;
  teamBId: string;
  reason: string;
  adminUserId: string;
}): Promise<void> {
  const {
    tournamentId, matchId, matchFormat, forfeitingTeam, teamAId, teamBId, reason, adminUserId,
  } = input;
  const now = new Date().toISOString();
  const winScore = gamesToWin(matchFormat);

  const scoreA = forfeitingTeam === 'teamA' ? 0 : forfeitingTeam === 'both' ? 0 : winScore;
  const scoreB = forfeitingTeam === 'teamB' ? 0 : forfeitingTeam === 'both' ? 0 : winScore;
  const winnerId =
    forfeitingTeam === 'both' ? null : forfeitingTeam === 'teamA' ? teamBId : teamAId;

  await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', matchId), {
    'teamA.score': scoreA,
    'teamB.score': scoreB,
    status: 'completed',
    winnerId,
    completed_at: now,
    forfeit: {
      forfeitingTeam: forfeitingTeam === 'both' ? 'teamA' : forfeitingTeam,
      scope: 'series',
      reason: reason || 'Walkower — brak rozegranego meczu w terminie',
      issuedAt: now,
      issuedBy: adminUserId,
      ...(forfeitingTeam === 'both' ? { doubleForfeit: true } : {}),
    },
    updatedAt: now,
  });
}
