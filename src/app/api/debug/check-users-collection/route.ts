// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking users collection for discordUsername fields...');
    
    // Check if users collection exists and what fields it has
    const usersRef = db.collection('users').limit(5);
    const usersSnap = await usersRef.get();
    
    const samples = [];
    
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      samples.push({
        userId,
        discordUsername: userData.discordUsername || 'NO_DISCORD_USERNAME',
        displayName: userData.displayName || 'NO_DISPLAY_NAME',
        email: userData.email || 'NO_EMAIL',
        allFields: Object.keys(userData)
      });
    }
    
    // Also check if there are any other collections that might have user info
    const collections = await db.listCollections();
    const collectionNames = collections.map(col => col.id);
    
    return NextResponse.json({
      success: true,
      message: `Checked users collection - ${samples.length} documents found`,
      samples,
      allCollections: collectionNames.filter(name => 
        name.includes('user') || name.includes('profile') || name.includes('account')
      )
    });
    
  } catch (error: any) {
    console.error('❌ Error checking users collection:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking users: ${error.message}`
      },
      { status: 500 }
    );
  }
}