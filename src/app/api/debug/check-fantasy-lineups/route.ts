import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking fantasy lineups collection for username fields...');
    
    // Get a sample of fantasy lineups to see what username fields they have
    const lineupsRef = db.collection('fantasyLineups').limit(5);
    const lineupsSnap = await lineupsRef.get();
    
    const samples = [];
    
    for (const userDoc of lineupsSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      samples.push({
        userId,
        displayName: userData.displayName || 'NO_DISPLAY_NAME',
        discordUsername: userData.discordUsername || 'NO_DISCORD_USERNAME',
        allFields: Object.keys(userData).filter(key => key.includes('name') || key.includes('discord') || key.includes('user'))
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Checked ${samples.length} fantasy lineup documents`,
      samples,
      totalDocuments: lineupsSnap.docs.length
    });
    
  } catch (error: any) {
    console.error('❌ Error checking fantasy lineups:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking fantasy lineups: ${error.message}`
      },
      { status: 500 }
    );
  }
}