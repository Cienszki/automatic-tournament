import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../../server/lib/admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  const needsQuoting = s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r');
  const escaped = s.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

export async function GET(req: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    const tournamentId = req.nextUrl.searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Missing tournamentId query param. Example: /api/pickem/export?tournamentId=YOUR_ID' },
        { status: 400 },
      );
    }

    // Fetch tournament-scoped pickems and teams in parallel.
    const [pickemsSnap, teamsSnap] = await Promise.all([
      db.collection('tournaments').doc(tournamentId).collection('pickems').get(),
      db.collection('tournaments').doc(tournamentId).collection('teams').get(),
    ]);

    const teams = new Map<string, Record<string, unknown>>();
    teamsSnap.docs.forEach((doc: QueryDocumentSnapshot) =>
      teams.set(doc.id, { id: doc.id, ...doc.data() })
    );

    const userIds = Array.from(new Set(pickemsSnap.docs.map((d: QueryDocumentSnapshot) => d.id)));
    const userSnaps = await Promise.all(
      userIds.map((uid) => db.collection('userProfiles').doc(uid).get().catch(() => null)),
    );
    const users = new Map<string, Record<string, unknown>>();
    userSnaps.forEach((snap, idx) => {
      if (snap?.exists) {
        users.set(userIds[idx], { id: userIds[idx], ...snap.data() });
      }
    });

    // Helper to map teamId -> display name
    const teamName = (id: string): string => {
      const t = teams.get(id) as Record<string, string> | undefined;
      return t?.name || t?.teamName || t?.tag || id || '';
    };

    // Row-per-predicted-team format is easiest for manual scoring in Sheets.
    const headers = [
      'tournamentId',
      'userId',
      'displayName',
      'discordUsername',
      'submittedAt',
      'teamId',
      'teamName',
      'bucketId',
      'predictedScore',
      'actualScore',
      'difference_abs',
    ];

    const rows: unknown[][] = [headers];

    pickemsSnap.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data: Record<string, unknown> = { userId: doc.id, ...doc.data() };
      const baskets = (data['baskets'] as Record<string, string[]>) || {};
      const scores = (data['scores'] as Record<string, number>) || {};
      const profile = (users.get(data['userId'] as string) || users.get(doc.id) || {}) as Record<string, unknown>;

      const lastUpdatedRaw = data['lastUpdated'] as { toDate?: () => Date } | string | undefined;
      const submittedAt = lastUpdatedRaw
        ? (typeof (lastUpdatedRaw as { toDate?: () => Date }).toDate === 'function'
            ? (lastUpdatedRaw as { toDate: () => Date }).toDate()
            : new Date(lastUpdatedRaw as string))
        : '';

      const userId = (data['userId'] as string) || doc.id;
      const displayName = (data['displayName'] as string) || (profile.displayName as string) || (profile.name as string) || '';
      const discordUsername = (data['discordUsername'] as string) || (profile.discordUsername as string) || '';
      const submittedAtIso = submittedAt ? new Date(submittedAt).toISOString() : '';

      const emittedTeams = new Set<string>();
      Object.entries(baskets).forEach(([bucketId, teamIds]) => {
        if (!Array.isArray(teamIds)) return;
        teamIds.forEach((teamId) => {
          if (!teamId || emittedTeams.has(teamId)) return;
          emittedTeams.add(teamId);

          rows.push([
            tournamentId,
            userId,
            displayName,
            discordUsername,
            submittedAtIso,
            teamId,
            teamName(teamId),
            bucketId,
            scores[teamId] ?? '',
            '',
            '',
          ]);
        });
      });
    });

    const csv = toCsv(rows);
    const filename = `pickem_export_${tournamentId}_${new Date().toISOString().slice(0,10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (err: any) {
    console.error('Pickem export failed:', err);
    return NextResponse.json({ error: err?.message || 'Failed to export Pick\'em data' }, { status: 500 });
  }
}
