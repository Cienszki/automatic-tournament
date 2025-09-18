// @ts-nocheck
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get the full leaderboards data
    const response = await fetch('http://localhost:3004/api/fantasy/leaderboards');
    const data = await response.json();
    
    if (!data.success) {
      return NextResponse.json({ error: 'Failed to fetch leaderboards' }, { status: 500 });
    }
    
    // Extract the Mid role leaderboard
    const midLeaderboard = data.leaderboards?.byRole?.Mid || [];
    
    // Find Marchewa specifically
    const marchewa = midLeaderboard.find((player: any) => 
      player.nickname && player.nickname.toLowerCase().includes('marchewa')
    );
    
    return NextResponse.json({
      success: true,
      midLeaderboard: midLeaderboard.map((player: any) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        teamName: player.teamName,
        averageScore: player.averageScore,
        totalMatches: player.totalMatches,
        rank: player.rank
      })),
      marchewa: marchewa ? {
        playerId: marchewa.playerId,
        nickname: marchewa.nickname,
        teamName: marchewa.teamName,
        averageScore: marchewa.averageScore,
        totalMatches: marchewa.totalMatches,
        rank: marchewa.rank
      } : null,
      totalMidPlayers: midLeaderboard.length
    });
    
  } catch (error: any) {
    console.error('❌ Error checking Mid leaderboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}