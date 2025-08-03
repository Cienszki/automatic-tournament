// src/app/api/debug/clear-processed/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const { ensureAdminInitialized, getAdminDb } = await import('@/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get all processed games documents
    const processedGamesSnap = await db.collection('processedGames').get();
    
    // Delete all processed games documents
    const batch = db.batch();
    processedGamesSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    return NextResponse.json({ 
      success: true, 
      message: `Cleared ${processedGamesSnap.size} processed games.`,
      clearedCount: processedGamesSnap.size 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to clear processed games' }, { status: 500 });
  }
}
