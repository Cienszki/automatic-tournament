import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/admin';
import { recalculatePlayoffBracket } from '@/lib/playoff-management';

export async function POST(request: NextRequest) {
    try {
        const adminDb = getAdminDb();
        
        // Step 1: Clear the incorrect team assignments in lb-r4-m1
        const lbR4M1Doc = await adminDb.collection('matches')
            .where('playoff_match_id', '==', 'lb-r4-m1')
            .get();
            
        if (!lbR4M1Doc.empty) {
            const matchDoc = lbR4M1Doc.docs[0];
            await matchDoc.ref.update({
                teamA: {
                    id: 'placeholder-lb-slot-r4-1',
                    name: 'Winner of LB Match',
                    score: 0,
                    logoUrl: ''
                },
                teamB: {
                    id: 'placeholder-lb-slot-r4-3', 
                    name: 'Winner of LB Match',
                    score: 0,
                    logoUrl: ''
                },
                teams: ['placeholder-lb-slot-r4-1', 'placeholder-lb-slot-r4-3'],
                status: 'waiting_for_teams'
            });
            console.log('Cleared lb-r4-m1 teams');
        }
        
        // Step 2: Run recalculation to properly assign teams
        console.log('Running recalculation...');
        const recalcResult = await recalculatePlayoffBracket();
        
        return NextResponse.json({
            success: true,
            message: 'Fixed match assignments and recalculated bracket',
            recalculation: recalcResult
        });

    } catch (error) {
        console.error('Error fixing and recalculating:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}