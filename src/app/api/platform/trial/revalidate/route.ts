// POST /api/platform/trial/revalidate?slug=<slug>[&kind=teams]: the invalidation a command would
// make, for timing how long the old page is still served (scripts/measure/invalidation.ts).

import { NextResponse, type NextRequest } from 'next/server';
import { checkTrialAccess } from '@/features/hosting-trial';
import { invalidateTournament } from '@/features/hosting-trial/commands';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = checkTrialAccess(request.headers.get('authorization'), process.env.PLATFORM_TRIAL_SECRET);
  if (access !== 'allowed') return new NextResponse(null, { status: access === 'disabled' ? 404 : 401 });
  const slug = request.nextUrl.searchParams.get('slug') ?? '';
  const result = await invalidateTournament(slug, request.nextUrl.searchParams.get('kind') ?? undefined);
  return result ? NextResponse.json(result) : NextResponse.json({ error: 'not_found' }, { status: 404 });
}
