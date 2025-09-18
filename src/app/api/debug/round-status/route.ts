// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getTournamentStatusAdmin, getNextRoundIdAdmin } from '@/lib/admin-actions';

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Debug: Checking round status...');
        
        const [currentStatus, nextRoundId] = await Promise.all([
            getTournamentStatusAdmin(),
            getNextRoundIdAdmin()
        ]);

        console.log('📊 Tournament Status:', currentStatus);
        console.log('🎯 Next Round ID:', nextRoundId);

        return NextResponse.json({
            success: true,
            currentRound: currentStatus?.roundId || 'unknown',
            nextRoundForLineups: nextRoundId,
            message: `Lineups are being saved FOR: ${nextRoundId} (current round: ${currentStatus?.roundId})`
        });

    } catch (error) {
        console.error('❌ Error checking round status:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to check round status',
            error: (error as Error).message
        }, { status: 500 });
    }
}