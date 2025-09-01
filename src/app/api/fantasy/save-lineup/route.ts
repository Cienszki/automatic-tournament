import { NextRequest, NextResponse } from 'next/server';
import { saveUserFantasyLineupAdmin, getNextRoundIdAdmin } from '@/lib/admin-actions';
import { FANTASY_BUDGET_MMR } from '@/lib/definitions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, displayName, lineup } = body;

        console.log('💾 Saving fantasy lineup for user:', userId);

        if (!userId || !displayName || !lineup) {
            return NextResponse.json({
                success: false,
                message: 'Missing required fields: userId, displayName, lineup'
            }, { status: 400 });
        }

        // Validate lineup structure
        const roles = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
        const selectedPlayers = Object.entries(lineup);
        
        if (selectedPlayers.length !== 5) {
            return NextResponse.json({
                success: false,
                message: 'Lineup must contain exactly 5 players (one per role)'
            }, { status: 400 });
        }

        // Validate roles
        for (const [role, player] of selectedPlayers) {
            if (!roles.includes(role)) {
                return NextResponse.json({
                    success: false,
                    message: `Invalid role: ${role}`
                }, { status: 400 });
            }

            if (!player || typeof player !== 'object' || !(player as any).id || !(player as any).mmr) {
                return NextResponse.json({
                    success: false,
                    message: `Invalid player data for role: ${role}`
                }, { status: 400 });
            }
        }

        // Validate MMR budget
        const totalMMR = selectedPlayers.reduce((sum, [_, player]) => sum + ((player as any).mmr || 0), 0);
        if (totalMMR > FANTASY_BUDGET_MMR) {
            return NextResponse.json({
                success: false,
                message: `Total MMR (${totalMMR.toLocaleString()}) exceeds budget limit of ${FANTASY_BUDGET_MMR.toLocaleString()}`
            }, { status: 400 });
        }

        // Check for duplicate players
        const playerIds = selectedPlayers.map(([_, player]) => (player as any).id);
        const uniquePlayerIds = new Set(playerIds);
        if (uniquePlayerIds.size !== playerIds.length) {
            return NextResponse.json({
                success: false,
                message: 'Cannot select the same player for multiple roles'
            }, { status: 400 });
        }

        // Get the current round to save lineup for
        const roundId = await getNextRoundIdAdmin();
        if (!roundId) {
            return NextResponse.json({
                success: false,
                message: 'No active round found for lineup submission'
            }, { status: 400 });
        }

        // Save the lineup
        await saveUserFantasyLineupAdmin(userId, lineup, roundId, displayName);

        console.log(`✅ Fantasy lineup saved for user ${userId} in round ${roundId}`);
        console.log(`💰 Total MMR used: ${totalMMR.toLocaleString()}/${FANTASY_BUDGET_MMR.toLocaleString()}`);

        return NextResponse.json({
            success: true,
            message: 'Fantasy lineup saved successfully',
            roundId,
            totalMMR,
            budgetUsed: totalMMR,
            budgetRemaining: FANTASY_BUDGET_MMR - totalMMR
        });

    } catch (error) {
        console.error('❌ Error saving fantasy lineup:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to save fantasy lineup',
            error: (error as Error).message
        }, { status: 500 });
    }
}