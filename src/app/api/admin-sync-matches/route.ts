// src/app/api/admin-sync-matches/route.ts
import { NextResponse } from 'next/server';
import { syncLeagueMatches } from '@/lib/actions';

export async function POST() {
  try {
    const result = await syncLeagueMatches();
    // result already contains a 'success' property
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Sync failed.' }, { status: 500 });
  }
}
