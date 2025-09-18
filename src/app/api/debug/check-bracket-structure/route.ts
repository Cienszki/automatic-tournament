import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/admin';

export async function GET(request: NextRequest) {
    try {
        const adminDb = getAdminDb();
        const playoffDoc = await adminDb.collection('playoffs').doc('main-playoffs').get();
        
        if (!playoffDoc.exists) {
            return NextResponse.json({
                success: false,
                error: 'No playoff data found'
            });
        }
        
        const playoffData = playoffDoc.data();
        
        // Find lower bracket and look at lb-r4-m1 and ub-r2-m1
        const lowerBracket = playoffData?.brackets?.find((b: any) => b.type === 'lower');
        const upperBracket = playoffData?.brackets?.find((b: any) => b.type === 'upper');
        
        const lbR4M1 = lowerBracket?.matches?.find((m: any) => m.id === 'lb-r4-m1');
        const ubR2M1 = upperBracket?.matches?.find((m: any) => m.id === 'ub-r2-m1');
        
        return NextResponse.json({
            success: true,
            lbR4M1: {
                id: lbR4M1?.id,
                teamASlotId: lbR4M1?.teamASlotId,
                teamBSlotId: lbR4M1?.teamBSlotId,
                winnerSlotId: lbR4M1?.winnerSlotId
            },
            ubR2M1: {
                id: ubR2M1?.id,
                teamASlotId: ubR2M1?.teamASlotId,
                teamBSlotId: ubR2M1?.teamBSlotId,
                winnerSlotId: ubR2M1?.winnerSlotId,
                loserSlotId: ubR2M1?.loserSlotId
            }
        });

    } catch (error) {
        console.error('Error checking bracket structure:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}