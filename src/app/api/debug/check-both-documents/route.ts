// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking both leaderboard documents...');
    
    // Check 'current' document
    const currentRef = db.collection('fantasyLeaderboards').doc('current');
    const currentSnap = await currentRef.get();
    
    // Check 'data' document  
    const dataRef = db.collection('fantasyLeaderboards').doc('data');
    const dataSnap = await dataRef.get();
    
    const currentData = currentSnap.exists ? currentSnap.data() : null;
    const dataData = dataSnap.exists ? dataSnap.data() : null;
    
    // Find Fey in both
    const currentFey = currentData?.byRole?.Carry?.find((p: any) => p.playerId === 'CjQPTnr5wqXDXqLL2hf4');
    const dataFey = dataData?.byRole?.Carry?.find((p: any) => p.playerId === 'CjQPTnr5wqXDXqLL2hf4');
    
    return NextResponse.json({
      success: true,
      current: {
        exists: currentSnap.exists,
        generatedAt: currentData?.generatedAt,
        algorithm: currentData?.algorithm,
        feyData: currentFey
      },
      data: {
        exists: dataSnap.exists,
        generatedAt: dataData?.generatedAt,
        algorithm: dataData?.algorithm,
        feyData: dataFey
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error checking both documents:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking documents: ${error.message}`
      },
      { status: 500 }
    );
  }
}