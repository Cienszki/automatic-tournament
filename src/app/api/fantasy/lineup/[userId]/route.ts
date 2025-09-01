import { NextRequest, NextResponse } from 'next/server';
import { getUserFantasyLineupAdmin, getNextRoundIdAdmin } from '@/lib/admin-actions';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const resolvedParams = await params;
        const { userId } = resolvedParams;

        console.log(`📋 Fetching fantasy lineup for user: ${userId}`);

        if (!userId) {
            return NextResponse.json({
                success: false,
                message: 'User ID is required'
            }, { status: 400 });
        }

        // Get the current round to fetch lineup for
        const roundId = await getNextRoundIdAdmin();
        if (!roundId) {
            return NextResponse.json({
                success: false,
                message: 'No active round found',
                lineup: {},
                roundId: null
            });
        }

        // Fetch the user's lineup for the current round
        const lineupData = await getUserFantasyLineupAdmin(userId, roundId);
        
        if (!lineupData) {
            console.log(`📝 No lineup found for user ${userId} in round ${roundId}`);
            return NextResponse.json({
                success: true,
                message: 'No lineup found for current round',
                lineup: {},
                roundId,
                hasLineup: false
            });
        }

        const lineup = lineupData.lineup || {};
        
        // Calculate total MMR
        const totalMMR = Object.values(lineup).reduce((sum: number, player: any) => {
            return sum + (player?.mmr || 0);
        }, 0);

        console.log(`✅ Found lineup for user ${userId} in round ${roundId} (MMR: ${totalMMR})`);

        return NextResponse.json({
            success: true,
            lineup,
            roundId,
            hasLineup: true,
            totalMMR,
            playerCount: Object.keys(lineup).length
        });

    } catch (error) {
        console.error('❌ Error fetching fantasy lineup:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to fetch fantasy lineup',
            error: (error as Error).message,
            lineup: {},
            roundId: null,
            hasLineup: false
        }, { status: 500 });
    }
}