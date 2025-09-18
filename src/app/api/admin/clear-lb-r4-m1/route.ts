import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/admin';

export async function POST(request: NextRequest) {
    try {
        const adminDb = getAdminDb();
        
        // Clear the incorrect team assignments in lb-r4-m1
        const lbR4M1Query = await adminDb.collection('matches')
            .where('playoff_match_id', '==', 'lb-r4-m1')
            .get();
            
        if (lbR4M1Query.empty) {
            return NextResponse.json({
                success: false,
                error: 'lb-r4-m1 match not found'
            });
        }
        
        const matchDoc = lbR4M1Query.docs[0];
        const currentData = matchDoc.data();
        
        // Reset both teams to placeholders
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
            status: 'waiting_for_teams',
            updated_at: new Date().toISOString()
        });
        
        return NextResponse.json({
            success: true,
            message: 'lb-r4-m1 teams cleared and reset to placeholders',
            before: {
                teamA: currentData.teamA,
                teamB: currentData.teamB
            }
        });

    } catch (error) {
        console.error('Error clearing lb-r4-m1:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}