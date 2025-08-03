// API endpoint to import a specific OpenDota match
import { NextRequest, NextResponse } from 'next/server';
import { importMatchFromOpenDota } from '@/lib/actions';

export async function POST(request: NextRequest) {
    try {
        const { openDotaMatchId, ourMatchId } = await request.json();
        
        if (!openDotaMatchId || !ourMatchId) {
            return NextResponse.json({ 
                success: false, 
                message: 'Missing required parameters: openDotaMatchId and ourMatchId' 
            }, { status: 400 });
        }

        console.log(`Importing OpenDota match ${openDotaMatchId} to our match ${ourMatchId}...`);
        
        const result = await importMatchFromOpenDota(Number(openDotaMatchId), ourMatchId);
        
        if (result.success) {
            // After successful import, update team statistics
            const statsResponse = await fetch('http://localhost:3000/api/admin/update-team-stats', {
                method: 'POST'
            });
            const statsResult = await statsResponse.json();
            
            return NextResponse.json({ 
                success: true, 
                message: `Match imported successfully and team stats updated. ${result.message}`,
                importResult: result,
                statsResult: statsResult
            });
        } else {
            return NextResponse.json({ 
                success: false, 
                message: `Failed to import match: ${result.message}`,
                importResult: result
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Error importing match:', error);
        return NextResponse.json({ 
            success: false, 
            message: 'Failed to import match.',
            error: (error as Error).message 
        }, { status: 500 });
    }
}
