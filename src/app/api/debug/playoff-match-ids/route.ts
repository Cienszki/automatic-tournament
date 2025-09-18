import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/admin';

export async function GET(request: NextRequest) {
    try {
        // Query all matches that have playoff_match_id
        const adminDb = getAdminDb();
        const snapshot = await adminDb.collection('matches')
            .where('playoff_match_id', '!=', null)
            .get();
        
        const playoffMatches: any[] = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            playoffMatches.push({
                documentId: doc.id,
                playoffMatchId: data.playoff_match_id,
                status: data.status,
                teamA: data.teamA,
                teamB: data.teamB,
                bracket: data.bracket,
                round: data.round
            });
        });

        return NextResponse.json({
            success: true,
            count: playoffMatches.length,
            matches: playoffMatches
        });

    } catch (error) {
        console.error('Error fetching playoff match IDs:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}