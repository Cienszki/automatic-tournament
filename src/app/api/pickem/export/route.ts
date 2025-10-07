// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../../server/lib/admin';

function csvEscape(value: any): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  const needsQuoting = s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r');
  const escaped = s.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function toCsv(rows: any[][]): string {
  return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

export async function GET(req: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Fetch all pickems, teams, and user profiles in parallel
    const [pickemsSnap, teamsSnap, usersSnap] = await Promise.all([
      db.collection('pickems').get(),
      db.collection('teams').get(),
      db.collection('userProfiles').get().catch(() => ({ docs: [] }))
    ]);

    const teams = new Map<string, any>();
    teamsSnap.docs.forEach(doc => teams.set(doc.id, { id: doc.id, ...doc.data() }));

    const users = new Map<string, any>();
    usersSnap.docs.forEach(doc => users.set(doc.id, { id: doc.id, ...doc.data() }));

    // Helper to map teamId -> display name
    const teamName = (id: string) => {
      const t = teams.get(id);
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

    const rows: any[][] = [headers];

    pickemsSnap.docs.forEach(doc => {
      const data: any = { userId: doc.id, ...doc.data() };
      const preds = data.predictions || {};
      const scores = data.scores || {};
      const profile = users.get(data.userId) || users.get(doc.id) || {};

      // Normalize arrays per category
      const one = (arr?: string[]) => (Array.isArray(arr) && arr.length > 0 ? teamName(arr[0]) : '');
      const two = (arr?: string[]) => [0,1].map(i => (Array.isArray(arr) && arr[i] ? teamName(arr[i]) : ''));
      const four = (arr?: string[]) => [0,1,2,3].map(i => (Array.isArray(arr) && arr[i] ? teamName(arr[i]) : ''));

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

      const submittedAt = (data.lastUpdated && (data.lastUpdated.toDate ? data.lastUpdated.toDate() : new Date(data.lastUpdated))) || '';

      rows.push([
        data.userId || doc.id,
        profile.displayName || profile.name || '',
        profile.discordUsername || '',
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
