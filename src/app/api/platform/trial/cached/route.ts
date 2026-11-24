// GET /api/platform/trial/cached?slug=<slug>: the teams page's cached reads, each timed with a
// 10-second limit, to find which step hangs on Vercel (WP-06 staging run; throwaway with the trial).

import { unstable_cache } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { checkTrialAccess } from '@/features/hosting-trial';
import { getTeamList, listTeams } from '@/features/teams/queries';
import { findPublicTournamentId, getTournamentFrame, resolveTournamentSlug } from '@/features/tournaments/queries';
import { getDb } from '@/platform/db';

export const dynamic = 'force-dynamic';

const LIMIT_MS = 10_000;

async function timed(step: string, run: () => Promise<unknown>) {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      run(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), LIMIT_MS); }),
    ]);
    return { step, ms: Math.round(performance.now() - start), ok: true, found: value !== null && value !== undefined };
  } catch (error) {
    return { step, ms: Math.round(performance.now() - start), ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'error' };
  } finally {
    clearTimeout(timer);
  }
}

const trivial = unstable_cache(async () => 1, ['trial.trivial'], { tags: ['trial'] });

export async function GET(request: NextRequest) {
  const access = checkTrialAccess(request.headers.get('authorization'), process.env.PLATFORM_TRIAL_SECRET);
  if (access !== 'allowed') return new NextResponse(null, { status: access === 'disabled' ? 404 : 401 });
  const slug = request.nextUrl.searchParams.get('slug') ?? '';
  const mode = request.nextUrl.searchParams.get('mode');
  if (mode === 'parallel-cached' || mode === 'parallel-direct') {
    // The page's generateMetadata and body read the same keys at the same time; repeat that here.
    const db = getDb();
    const id = mode === 'parallel-cached' ? await resolveTournamentSlug(slug) : await findPublicTournamentId(db, slug);
    if (!id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const read = mode === 'parallel-cached' ? () => getTeamList(id) : () => listTeams(db, id);
    const steps = await Promise.all([1, 2, 3, 4].map((n) => timed(`${mode} #${n}`, read)));
    return NextResponse.json({ steps }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const steps = [await timed('unstable_cache without the database', () => trivial())];
  let id: string | null = null;
  steps.push(await timed('resolveTournamentSlug', async () => (id = await resolveTournamentSlug(slug))));
  if (id) {
    const tournamentId: string = id;
    steps.push(await timed('getTournamentFrame', () => getTournamentFrame(tournamentId)));
    steps.push(await timed('getTeamList', () => getTeamList(tournamentId)));
  }
  return NextResponse.json({ steps }, { headers: { 'Cache-Control': 'no-store' } });
}
