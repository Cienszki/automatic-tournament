import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { playerId } = await params;
    
    // Get player stats from optimized collection
    const playerStatsDoc = await db.collection('fantasyPlayerStats').doc(playerId).get();
    
    if (!playerStatsDoc.exists) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Player stats not found. Please run enhanced recalculation first." 
        },
        { status: 404 }
      );
    }
    
    const playerStats = playerStatsDoc.data();
    
    return NextResponse.json({
      success: true,
      playerStats
    });
    
  } catch (error: any) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch player stats.",
        error: error.message
      },
      { status: 500 }
    );
  }
}