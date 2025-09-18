import { NextRequest, NextResponse } from 'next/server';
import { recalculatePlayoffBracket } from '@/lib/playoff-management';

export async function POST(request: NextRequest) {
    try {
        console.log('Starting playoff bracket recalculation test...');
        
        const result = await recalculatePlayoffBracket();
        
        return NextResponse.json({
            success: result,
            message: result ? 'Playoff bracket recalculated successfully' : 'Recalculation failed'
        });

    } catch (error) {
        console.error('Error testing playoff recalculation:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}