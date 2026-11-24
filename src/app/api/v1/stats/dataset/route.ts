// GET /api/v1/stats/dataset?tournamentId=<id>: the stats hub's dataset, computed from the
// tournament's rows in PostgreSQL (src/features/stats), kept in the server's data cache until its
// stats, teams or matches tags are invalidated, compressed, and kept by the CDN for five minutes.
// A draft answers like an unknown tournament. The old /api/stats/dataset (Firestore) is unchanged
// until the hub moves over (WP-10).

import { getCachedDataset } from '@/features/stats/queries';
import { publicJson } from '@/platform/http';

// Read at request time: a build reads no database.
export const dynamic = 'force-dynamic';

const TOURNAMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** An error answer no cache keeps. */
const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request): Promise<Response> {
  const tournamentId = new URL(request.url).searchParams.get('tournamentId');
  if (!tournamentId || !TOURNAMENT_ID.test(tournamentId)) return refuse(400, 'tournamentId required');
  const dataset = await getCachedDataset(tournamentId);
  if (!dataset) return refuse(404, 'tournament not found');
  return publicJson(request, dataset, { sMaxAge: 300, staleWhileRevalidate: 600 });
}
