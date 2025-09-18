import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Check the actual structure - look for subcollections or different collection name
    const fantasyLineupsRef = db.collection('fantasyLineups');
    const lineupsSnap = await fantasyLineupsRef.get();
    
    const results: any = {
      mainCollection: {
        totalDocs: lineupsSnap.size,
        sampleDocs: []
      }
    };
    
    // Check first few documents for subcollections
    let docCount = 0;
    for (const doc of lineupsSnap.docs) {
      if (docCount >= 3) break;
      
      const data = doc.data();
      results.mainCollection.sampleDocs.push({
        docId: doc.id,
        allKeys: Object.keys(data),
        sampleData: {
          userId: data.userId,
          displayName: data.displayName,
          roundId: data.roundId,
          round: data.round
        }
      });
      
      // Check for subcollections
      const subcollections = await doc.ref.listCollections();
      if (subcollections.length > 0) {
        results.mainCollection.sampleDocs[docCount].subcollections = [];
        
        for (const subcoll of subcollections) {
          const subDocs = await subcoll.limit(2).get();
          const subData = subDocs.docs.map(subDoc => ({
            docId: subDoc.id,
            keys: Object.keys(subDoc.data()),
            sampleData: subDoc.data()
          }));
          
          results.mainCollection.sampleDocs[docCount].subcollections.push({
            name: subcoll.id,
            docCount: subDocs.size,
            samples: subData
          });
        }
      }
      
      docCount++;
    }
    
    return NextResponse.json({
      success: true,
      results
    });
    
  } catch (error: any) {
    console.error('❌ Error checking lineup structure:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to check lineup structure: ${error.message}`
      },
      { status: 500 }
    );
  }
}