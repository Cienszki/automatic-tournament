// GET /api/v1/stats/dataset?tournamentId=<id>: the stats hub's dataset, computed from the
// tournament's rows in PostgreSQL (src/features/stats), compressed, kept by the CDN for five
// minutes. The old /api/stats/dataset (Firestore) is unchanged until the hub moves over (WP-10).

import { getDataset } from '@/features/stats/queries';
import { publicJson } from '@/platform/http';

// Read at request time: a build reads no database.
export const dynamic = 'force-dynamic';

const TOURNAMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(request: Request): Promise<Response> {
  const tournamentId = new URL(request.url).searchParams.get('tournamentId');
  if (!tournamentId || !TOURNAMENT_ID.test(tournamentId)) return Response.json({ error: 'tournamentId required' }, { status: 400 });
  const dataset = await getDataset(tournamentId);
  if (!dataset) return Response.json({ error: 'tournament not found' }, { status: 404 });
  return publicJson(request, dataset, { sMaxAge: 300, staleWhileRevalidate: 600 });
}
