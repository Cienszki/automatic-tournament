// src/app/api/admin-sync-matches/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Import the sync function only on server side
    const { syncLeagueMatchesAdmin } = await import('@/lib/admin-actions');
    const result = await syncLeagueMatchesAdmin();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API sync error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Sync failed.' }, { status: 500 });
  }
}
