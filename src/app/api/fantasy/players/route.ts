import { NextRequest, NextResponse } from 'next/server';
import { getAllTournamentPlayersAdmin } from '@/lib/admin-actions';

export async function GET(request: NextRequest) {
    try {
        console.log('📋 Fetching tournament players for fantasy selection...');
        
        const players = await getAllTournamentPlayersAdmin();
        
        if (!players || players.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'No tournament players found',
                players: []
            });
        }

        // Group players by role and sort by MMR descending
        const playersByRole = players.reduce((acc: any, player: any) => {
            const role = player.role;
            if (!acc[role]) {
                acc[role] = [];
            }
            acc[role].push(player);
            return acc;
        }, {});

        // Sort each role by MMR descending
        Object.keys(playersByRole).forEach(role => {
            playersByRole[role].sort((a: any, b: any) => b.mmr - a.mmr);
        });

        console.log(`✅ Found ${players.length} tournament players across ${Object.keys(playersByRole).length} roles`);

        return NextResponse.json({
            success: true,
            playersByRole,
            totalPlayers: players.length
        });

    } catch (error) {
        console.error('❌ Error fetching tournament players:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to fetch tournament players',
            error: (error as Error).message
        }, { status: 500 });
    }
}