import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/admin';

export async function POST(request: NextRequest) {
    try {
        const adminDb = getAdminDb();
        const playoffDocRef = adminDb.collection('playoffs').doc('main-playoffs');
        const playoffDoc = await playoffDocRef.get();
        
        if (!playoffDoc.exists) {
            return NextResponse.json({
                success: false,
                error: 'No playoff data found'
            });
        }
        
        const playoffData = playoffDoc.data();
        
        // Find upper bracket and fix ub-r2 matches loser slots
        const brackets = playoffData?.brackets || [];
        
        for (let bracket of brackets) {
            if (bracket.type === 'upper') {
                for (let match of bracket.matches) {
                    // Fix ub-r2-m1 and ub-r2-m2 loser slots
                    if (match.id === 'ub-r2-m1') {
                        console.log(`Fixing ${match.id}: ${match.loserSlotId} -> lb-slot-r4-3`);
                        match.loserSlotId = 'lb-slot-r4-3';
                    } else if (match.id === 'ub-r2-m2') {
                        console.log(`Fixing ${match.id}: ${match.loserSlotId} -> lb-slot-r4-4`);
                        match.loserSlotId = 'lb-slot-r4-4';
                    }
                }
            }
        }
        
        // Update the playoff data
        await playoffDocRef.update({
            brackets: brackets,
            updatedAt: new Date().toISOString()
        });
        
        return NextResponse.json({
            success: true,
            message: 'Bracket slot assignments fixed'
        });

    } catch (error) {
        console.error('Error fixing bracket slots:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}