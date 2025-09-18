import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking leaderboard source data...');
    
    // Check what's in the fantasyLeaderboards collection
    let leaderboardsRef = db.collection('fantasyLeaderboards').doc('current');
    let leaderboardsSnap = await leaderboardsRef.get();
    
    if (!leaderboardsSnap.exists) {
      leaderboardsRef = db.collection('fantasyLeaderboards').doc('data');
      leaderboardsSnap = await leaderboardsRef.get();
    }
    
    if (!leaderboardsSnap.exists) {
      return NextResponse.json({
        success: false,
        message: 'No leaderboards found'
      });
    }
    
    const leaderboardsData = leaderboardsSnap.data();
    
    // Find Fey specifically in the carry leaderboard
    const carryLeaderboard = leaderboardsData?.byRole?.Carry || [];
    const feyData = carryLeaderboard.find((player: any) => 
      player.nickname === 'Fey' || player.playerId === 'CjQPTnr5wqXDXqLL2hf4'
    );
    
    // Also check if there are other entries for Fey
    const allFeyEntries = carryLeaderboard.filter((player: any) =>
      player.nickname?.toLowerCase().includes('fey') || 
      player.playerId === 'CjQPTnr5wqXDXqLL2hf4'
    );
    
    return NextResponse.json({
      success: true,
      documentId: leaderboardsSnap.id,
      generatedAt: leaderboardsData?.generatedAt,
      algorithm: leaderboardsData?.algorithm,
      carryLeaderboardTotal: carryLeaderboard.length,
      feySpecificData: feyData,
      allFeyEntries,
      firstFewCarryPlayers: carryLeaderboard.slice(0, 5).map((p: any) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        totalMatches: p.totalMatches,
        averageScore: p.averageScore
      }))
    });
    
  } catch (error: any) {
    console.error('❌ Error checking leaderboard source:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking leaderboard source: ${error.message}`
      },
      { status: 500 }
    );
  }
}