// src/app/api/rankings/recalculate/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tournamentId = body.tournamentId as string | undefined;

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'tournamentId is required' },
        { status: 400 },
      );
    }

    const { recalculatePerformanceRankings } = await import('@/lib/performance-rankings-calculator');
    await recalculatePerformanceRankings(tournamentId);

    return NextResponse.json({
      success: true,
      message: 'Performance rankings recalculated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[/api/rankings/recalculate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Recalculation failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with { tournamentId } to recalculate performance rankings',
  });
}
