// src/app/api/captain-change/redeem/route.ts
// A logged-in user redeems a one-time captain-change code handed to them by an admin.
// On success the team's captainId is reassigned to the caller and the code is discarded.

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';

/** Normalize user-typed input: strip whitespace/dashes, uppercase. */
function normalizeCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * POST /api/captain-change/redeem
 * Body: { code: string, tournamentId: string }
 * Returns: { success: true, teamName: string }
 *
 * Auth: any signed-in user (the prospective new captain).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Sesja wygasła. Zaloguj się ponownie.' }, { status: 401 });
    }

    const body = await req.json();
    const { code: rawCode, tournamentId } = body as { code?: string; tournamentId?: string };
    if (!rawCode || !tournamentId) {
      return NextResponse.json({ error: 'Brak kodu lub turnieju.' }, { status: 400 });
    }

    const code = normalizeCode(rawCode);
    if (!code) {
      return NextResponse.json({ error: 'Nieprawidłowy kod.' }, { status: 400 });
    }

    const db = getAdminDb();
    const codeRef = db.collection('captainChangeCodes').doc(code);

    // Run the swap in a transaction so a code can be redeemed at most once even under
    // concurrent submissions: re-read the code inside the txn, reassign the captain, delete.
    const result = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) {
        return { ok: false as const, status: 404, error: 'Kod jest nieprawidłowy lub został już użyty.' };
      }
      const data = codeSnap.data() as { tournamentId: string; teamId: string; teamName?: string };

      // The code is scoped to the tournament it was issued for.
      if (data.tournamentId !== tournamentId) {
        return { ok: false as const, status: 400, error: 'Ten kod należy do innego turnieju.' };
      }

      const teamsCol = db
        .collection('tournaments')
        .doc(data.tournamentId)
        .collection('teams');

      // A user may captain at most one team per tournament. Reject if they already
      // captain a DIFFERENT team here. (Re-claiming the same team is a harmless no-op.)
      const ownedSnap = await tx.get(teamsCol.where('captainId', '==', uid));
      const otherTeam = ownedSnap.docs.find((d) => d.id !== data.teamId);
      if (otherTeam) {
        const otherName = (otherTeam.data() as { name?: string }).name ?? '';
        return {
          ok: false as const,
          status: 409,
          error: otherName
            ? `Jesteś już kapitanem drużyny „${otherName}" w tym turnieju. Nie możesz prowadzić więcej niż jednej drużyny.`
            : 'Jesteś już kapitanem innej drużyny w tym turnieju. Nie możesz prowadzić więcej niż jednej drużyny.',
        };
      }

      const teamRef = teamsCol.doc(data.teamId);
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists) {
        return { ok: false as const, status: 404, error: 'Drużyna już nie istnieje.' };
      }

      tx.update(teamRef, { captainId: uid });
      tx.delete(codeRef); // one-time use — discard so no one else can redeem it

      const teamName = (teamSnap.data() as { name?: string }).name ?? data.teamName ?? '';
      return { ok: true as const, teamName };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, teamName: result.teamName });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] captain-change redeem error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
