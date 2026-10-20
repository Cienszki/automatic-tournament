import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { forceSchedulePDLMatchAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/manage/pdl/force-schedule-match
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
 * }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { tournamentId, matchId, scheduledFor, reason = '' } = body;

        if (!tournamentId || !matchId || !scheduledFor) {
            return NextResponse.json(
                { success: false, error: 'tournamentId, matchId and scheduledFor are required' },
                { status: 400 },
            );
        }

        const caller = await requireAdmin(req, tournamentId);
        if (caller instanceof NextResponse) return caller;

        const parsed = new Date(scheduledFor);
        if (isNaN(parsed.getTime())) {
            return NextResponse.json({ success: false, error: 'scheduledFor is not a valid date' }, { status: 400 });
        }

        const result = await forceSchedulePDLMatchAdmin(
            tournamentId,
            matchId,
            parsed.toISOString(),
            reason,
            caller.uid,
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
