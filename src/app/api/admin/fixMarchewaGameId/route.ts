import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function POST() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔧 Fixing Marchewa performance document ID...');
    
    // Marchewa's data
    const correctPlayerId = '3xm0vHddeFVo2gaodOW7';
    const incorrectPlayerId = 'Marchewa';
    const gameId = '8430102930';
    const matchId = '7VdHDXHUb0uSjOOiaD9r';
    
    // Get the game reference
    const gameRef = db.collection('matches').doc(matchId).collection('games').doc(gameId);
    
    // Get the incorrect performance document
    const incorrectPerfRef = gameRef.collection('performances').doc(incorrectPlayerId);
    const incorrectPerfSnap = await incorrectPerfRef.get();
    
    if (!incorrectPerfSnap.exists) {
      return NextResponse.json({
        success: false,
        message: `Performance document with ID '${incorrectPlayerId}' not found`
      });
    }
    
    const performanceData = incorrectPerfSnap.data();
    console.log(`📋 Found performance data for '${incorrectPlayerId}'`);
    
    // Get the correct performance document reference
    const correctPerfRef = gameRef.collection('performances').doc(correctPlayerId);
    
    // Check if correct document already exists
    const correctPerfSnap = await correctPerfRef.get();
    if (correctPerfSnap.exists) {
      console.log(`⚠️ Performance document '${correctPlayerId}' already exists`);
      return NextResponse.json({
        success: false,
        message: `Performance document '${correctPlayerId}' already exists. Cannot overwrite.`
      });
    }
    
    // Update the performance data to use the correct player ID
    const correctedData = {
      ...performanceData,
      playerId: correctPlayerId
    };
    
    // Use a batch to atomically move the document
    const batch = db.batch();
    
    // Set the data in the correct document
    batch.set(correctPerfRef, correctedData);
    
    // Delete the incorrect document
    batch.delete(incorrectPerfRef);
    
    await batch.commit();
    
    console.log(`✅ Successfully moved performance from '${incorrectPlayerId}' to '${correctPlayerId}'`);
    
    return NextResponse.json({
      success: true,
      message: `Performance document moved from '${incorrectPlayerId}' to '${correctPlayerId}'`,
      gameId,
      matchId,
      performanceData: correctedData
    });
    
  } catch (error: any) {
    console.error('❌ Error fixing Marchewa performance ID:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error fixing performance ID: ${error.message}`
      },
      { status: 500 }
    );
  }
}