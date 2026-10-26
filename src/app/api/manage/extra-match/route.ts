/**
 * Admin API: matches added outside the planned schedule — tiebreaks, showmatches, rematches.
 * Rules for what they count towards live in src/lib/match-flags.ts.
 *
 * POST   { tournamentId, teamAId, teamBId, kind, replacesMatchId?, note?, seriesFormat,
 *          scheduledFor?, round?, matchday?, divisionId? }
 *        A rematch copies the replaced match's place (division, round, LAN group/slot) and marks
 *        the original `replacedByMatchId`; other extras go where the admin put them.
 * DELETE { tournamentId, matchId } — only extra matches without games; restores a replaced original.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/server/lib/require-admin';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import { recalculateAllPDLDivisionStandingsAdmin } from '@/lib/pdl-admin-actions';
import type { ExtraMatchKind } from '@/lib/definitions';

const KINDS: ExtraMatchKind[] = ['tiebreak', 'rematch', 'showmatch', 'other'];
const FORMATS = ['bo1', 'bo2', 'bo3', 'bo5'] as const;
const bestOfOf = (f: string) => (f === 'bo1' ? 1 : f === 'bo2' ? 2 : f === 'bo5' ? 5 : 3);

/** Stored tables (league divisions) are recomputed; Swiss and MMR tables are computed live */
async function refreshStandings(tournamentId: string) {
  try { await recalculateAllPDLDivisionStandingsAdmin(tournamentId); } catch (e) { console.warn('[extra-match] standings refresh failed:', e); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId, teamAId, teamBId, kind, replacesMatchId, note, seriesFormat, scheduledFor, round, matchday, divisionId } = body ?? {};
    if (!tournamentId || !teamAId || !teamBId || teamAId === teamBId) return NextResponse.json({ error: 'Wybierz dwie różne drużyny.' }, { status: 400 });
    if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Nieznany rodzaj meczu.' }, { status: 400 });
    if (kind === 'rematch' && !replacesMatchId) return NextResponse.json({ error: 'Wybierz mecz, który jest powtarzany.' }, { status: 400 });
    if (!FORMATS.includes(seriesFormat)) return NextResponse.json({ error: 'Nieznany format serii.' }, { status: 400 });
    if (scheduledFor && Number.isNaN(Date.parse(scheduledFor))) return NextResponse.json({ error: 'Niepoprawna data.' }, { status: 400 });

    const caller = await requireAdmin(req, tournamentId);
    if (caller instanceof NextResponse) return caller;

    ensureAdminInitialized();
    const db = getAdminDb();
    const tRef = db.collection('tournaments').doc(tournamentId);
    const [teamA, teamB] = await Promise.all([tRef.collection('teams').doc(teamAId).get(), tRef.collection('teams').doc(teamBId).get()]);
    if (!teamA.exists || !teamB.exists) return NextResponse.json({ error: 'Nie znaleziono drużyny.' }, { status: 404 });

    // Where the match sits: a rematch takes the original's place, other extras the admin's choice
    let place: Record<string, unknown> = {};
    let originalRef: FirebaseFirestore.DocumentReference | null = null;
    if (kind === 'rematch') {
      originalRef = tRef.collection('matches').doc(String(replacesMatchId));
      const orig = await originalRef.get();
      const o = orig.data();
      if (!o) return NextResponse.json({ error: 'Nie znaleziono powtarzanego meczu.' }, { status: 404 });
      const ids = [o.teamA?.id, o.teamB?.id];
      if (!ids.includes(teamAId) || !ids.includes(teamBId)) return NextResponse.json({ error: 'Powtarzany mecz musi być meczem tych samych drużyn.' }, { status: 400 });
      if (o.replacedByMatchId) return NextResponse.json({ error: 'Ten mecz ma już powtórkę.' }, { status: 409 });
      if (o.isPlayoff || o.isSwissByeMatch || o.isBanForfeit) return NextResponse.json({ error: 'Tego meczu nie można powtórzyć w ten sposób.' }, { status: 400 });
      if (o.extra && o.extra.kind !== 'rematch') return NextResponse.json({ error: 'Dodatkowego meczu (tiebreaker, showmatch) nie powtarza się — usuń go i dodaj nowy.' }, { status: 400 });
      for (const k of ['divisionId', 'group_id', 'round', 'matchday', 'lanStage', 'lanSlot', 'deadline']) if (o[k] != null) place[k] = o[k];
    } else {
      if (Number.isInteger(round) && round > 0) place.round = round;
      if (Number.isInteger(matchday) && matchday > 0) place.matchday = matchday; else if (place.round) place.matchday = place.round;
      // no division picked: the one both teams play in (division views and tables filter by it)
      const shared = teamA.data()?.divisionId && teamA.data()?.divisionId === teamB.data()?.divisionId ? teamA.data()!.divisionId : null;
      const div = typeof divisionId === 'string' && divisionId ? divisionId : shared;
      if (div) { place.divisionId = div; place.group_id = div; }
    }

    const now = new Date().toISOString();
    const ref = tRef.collection('matches').doc();
    const side = (snap: FirebaseFirestore.DocumentSnapshot) => ({ id: snap.id, name: snap.data()?.name ?? snap.id, score: 0, logoUrl: snap.data()?.logoUrl ?? '' });
    const when = scheduledFor ? new Date(scheduledFor).toISOString() : null;
    const batch = db.batch();
    batch.set(ref, {
      id: ref.id,
      tournamentId,
      teamA: side(teamA),
      teamB: side(teamB),
      teams: [teamAId, teamBId],
      ...place,
      series_format: seriesFormat,
      bestOf: bestOfOf(seriesFormat),
      status: 'scheduled',
      // always present: the admin match list orders by it and drops documents without the field
      scheduledFor: when,
      schedulingStatus: when ? 'confirmed' : 'unscheduled',
      schedulingMethod: when ? 'admin-scheduled' : 'captain-scheduled',
      game_ids: [],
      winnerId: null,
      extra: { kind, ...(typeof note === 'string' && note.trim() ? { note: note.trim().slice(0, 80) } : {}), createdAt: now, createdBy: caller.uid },
      ...(originalRef ? { replacesMatchId: originalRef.id } : {}),
      createdAt: now,
      updatedAt: now,
    });
    if (originalRef) batch.update(originalRef, { replacedByMatchId: ref.id, updatedAt: now });
    await batch.commit();
    if (originalRef) await refreshStandings(tournamentId);
    return NextResponse.json({ success: true, matchId: ref.id });
  } catch (err: any) {
    console.error('[extra-match] create failed:', err);
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { tournamentId, matchId } = (await req.json()) ?? {};
    if (!tournamentId || !matchId) return NextResponse.json({ error: 'tournamentId and matchId are required' }, { status: 400 });
    const caller = await requireAdmin(req, tournamentId);
    if (caller instanceof NextResponse) return caller;

    ensureAdminInitialized();
    const db = getAdminDb();
    const tRef = db.collection('tournaments').doc(tournamentId);
    const ref = tRef.collection('matches').doc(String(matchId));
    const m = (await ref.get()).data();
    if (!m) return NextResponse.json({ error: 'Nie znaleziono meczu.' }, { status: 404 });
    if (!m.extra) return NextResponse.json({ error: 'To nie jest dodatkowy mecz.' }, { status: 400 });
    const games = await ref.collection('games').limit(1).get();
    if (m.status === 'completed' || (m.game_ids?.length ?? 0) > 0 || !games.empty) {
      return NextResponse.json({ error: 'Mecz ma już rozegrane gry — najpierw usuń gry, potem mecz.' }, { status: 409 });
    }
    const batch = db.batch();
    batch.delete(ref);
    if (m.replacesMatchId) batch.update(tRef.collection('matches').doc(m.replacesMatchId), { replacedByMatchId: FieldValue.delete(), updatedAt: new Date().toISOString() });
    await batch.commit();
    if (m.replacesMatchId) await refreshStandings(tournamentId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[extra-match] delete failed:', err);
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 500 });
  }
}
