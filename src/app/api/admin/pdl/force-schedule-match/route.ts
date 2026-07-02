import { NextResponse } from 'next/server';
import { forceSchedulePDLMatchAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/force-schedule-match
 *
 * Admin override — set a match's scheduled time regardless of current scheduling state.
 * Teams can still reschedule afterwards through the normal flow.
 *
 * Body:
 * {
 *   tournamentId: string,
 *   matchId:      string,
 *   scheduledFor: string,   // ISO datetime
 *   reason?:      string,
 *   adminUserId?: string
 * }
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { tournamentId, matchId, scheduledFor, reason = '', adminUserId = 'admin' } = body;

        if (!tournamentId || !matchId || !scheduledFor) {
            return NextResponse.json(
                { success: false, error: 'tournamentId, matchId and scheduledFor are required' },
                { status: 400 },
            );
        }

        const parsed = new Date(scheduledFor);
        if (isNaN(parsed.getTime())) {
            return NextResponse.json({ success: false, error: 'scheduledFor is not a valid date' }, { status: 400 });
        }

        const result = await forceSchedulePDLMatchAdmin(
            tournamentId,
            matchId,
            parsed.toISOString(),
            reason,
            adminUserId,
        );

        return NextResponse.json(
            { success: result.success, message: result.success ? result.message : undefined, error: result.success ? undefined : result.message },
            { status: result.success ? 200 : 400 },
        );

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Force-schedule failed';
        console.error('[API] force-schedule-match error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
