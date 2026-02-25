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

    const usersSnap = await db.collection('userProfiles').get().catch(() => null);

    // Fetch pickems and teams in parallel
    const [pickemsSnap, teamsSnap] = await Promise.all([
      db.collection('pickems').get(),
      db.collection('teams').get(),
    ]);

    const teams = new Map<string, Record<string, unknown>>();
    teamsSnap.docs.forEach((doc: QueryDocumentSnapshot) =>
      teams.set(doc.id, { id: doc.id, ...doc.data() })
    );

    const users = new Map<string, Record<string, unknown>>();
    if (usersSnap) {
      usersSnap.docs.forEach((doc: QueryDocumentSnapshot) =>
        users.set(doc.id, { id: doc.id, ...doc.data() })
      );
    }

    // Helper to map teamId -> display name
    const teamName = (id: string): string => {
      const t = teams.get(id) as Record<string, string> | undefined;
      return t?.name || t?.teamName || t?.tag || id || '';
    };

    // Column layout for Google Sheets
    const headers = [
      'userId',
      'displayName',
      'discordUsername',
      'submittedAt',
      'champion',
      'runnerUp',
      'thirdPlace',
      'fourthPlace',
      'fifthToSixth_1', 'fifthToSixth_2',
      'seventhToEighth_1', 'seventhToEighth_2',
      'ninthToTwelfth_1', 'ninthToTwelfth_2', 'ninthToTwelfth_3', 'ninthToTwelfth_4',
      'thirteenthToSixteenth_1', 'thirteenthToSixteenth_2', 'thirteenthToSixteenth_3', 'thirteenthToSixteenth_4',
      'pool_count',
      'pool_list'
    ];

    const rows: unknown[][] = [headers];

    pickemsSnap.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data: Record<string, unknown> = { userId: doc.id, ...doc.data() };
      const preds = (data['predictions'] as Record<string, string[]>) || {};
      const profile = (users.get(data['userId'] as string) || users.get(doc.id) || {}) as Record<string, unknown>;

      // Normalize arrays per category
      const one = (arr?: string[]): string => (Array.isArray(arr) && arr.length > 0 ? teamName(arr[0]) : '');
      const two = (arr?: string[]): string[] => [0, 1].map(i => (Array.isArray(arr) && arr[i] ? teamName(arr[i]) : ''));
      const four = (arr?: string[]): string[] => [0, 1, 2, 3].map(i => (Array.isArray(arr) && arr[i] ? teamName(arr[i]) : ''));

      const champion = one(preds.champion);
      const runnerUp = one(preds.runnerUp);
      const thirdPlace = one(preds.thirdPlace);
      const fourthPlace = one(preds.fourthPlace);
      const [f56_1, f56_2] = two(preds.fifthToSixth);
      const [s78_1, s78_2] = two(preds.seventhToEighth);
      const [n12_1, n12_2, n12_3, n12_4] = four(preds.ninthToTwelfth);
      const [t16_1, t16_2, t16_3, t16_4] = four(preds.thirteenthToSixteenth);
      const poolArr: string[] = Array.isArray(preds.pool) ? preds.pool : [];
      const poolNames = poolArr.map(teamName);

      const lastUpdatedRaw = data['lastUpdated'] as { toDate?: () => Date } | string | undefined;
      const submittedAt = lastUpdatedRaw
        ? (typeof (lastUpdatedRaw as { toDate?: () => Date }).toDate === 'function'
            ? (lastUpdatedRaw as { toDate: () => Date }).toDate()
            : new Date(lastUpdatedRaw as string))
        : '';

      rows.push([
        data['userId'] || doc.id,
        (profile.displayName as string) || (profile.name as string) || '',
        (profile.discordUsername as string) || '',
        submittedAt ? new Date(submittedAt).toISOString() : '',
        champion,
        runnerUp,
        thirdPlace,
        fourthPlace,
        f56_1, f56_2,
        s78_1, s78_2,
        n12_1, n12_2, n12_3, n12_4,
        t16_1, t16_2, t16_3, t16_4,
        poolNames.length,
        poolNames.join(' | ')
      ]);
    });

    const csv = toCsv(rows);
    const filename = `pickem_export_${new Date().toISOString().slice(0,10)}.csv`;

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
