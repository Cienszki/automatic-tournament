import { NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

        const matchRef = doc(db, 'tournaments', tournamentId, 'matches', matchId);
        const matchSnap = await getDoc(matchRef);
        if (!matchSnap.exists()) {
            return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
        }

        const matchData = matchSnap.data();
        if (matchData.status === 'completed') {
            return NextResponse.json(
                { success: false, error: 'Cannot force-schedule a completed match' },
                { status: 400 },
            );
        }

        const now = new Date().toISOString();
        await updateDoc(matchRef, {
            scheduledFor: parsed.toISOString(),
            schedulingStatus: 'confirmed',
            proposedTime: null,
            proposingCaptainId: null,
            proposedById: null,
            rescheduleRequest: null,
            adminScheduledAt: now,
            adminScheduledBy: adminUserId,
            adminScheduleReason: reason || null,
            updatedAt: now,
        });

        return NextResponse.json({
            success: true,
            message: `Match scheduled for ${parsed.toLocaleString('pl-PL')}`,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Force-schedule failed';
        console.error('[API] force-schedule-match error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
