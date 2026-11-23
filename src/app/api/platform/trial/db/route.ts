// GET /api/platform/trial/db?slug=<slug>: database reads timed from inside a function, never
// cached; the target of the concurrency test (scripts/measure/concurrency.ts).

import { NextResponse, type NextRequest } from 'next/server';
import { checkTrialAccess } from '@/features/hosting-trial';
import { probeDatabase } from '@/features/hosting-trial/commands';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = checkTrialAccess(request.headers.get('authorization'), process.env.PLATFORM_TRIAL_SECRET);
  if (access !== 'allowed') return new NextResponse(null, { status: access === 'disabled' ? 404 : 401 });
  const result = await probeDatabase(request.nextUrl.searchParams.get('slug') ?? '');
  return result
    ? NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
    : NextResponse.json({ error: 'not_found' }, { status: 404 });
}
