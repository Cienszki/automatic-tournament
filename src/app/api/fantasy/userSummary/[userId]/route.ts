import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { userId } = await params;
    
    // Get user summary from optimized collection
    const userSummaryDoc = await db.collection('fantasyUserSummaries').doc(userId).get();
    
    if (!userSummaryDoc.exists) {
      return NextResponse.json(
        { 
          success: false, 
          message: "User summary not found. Please run enhanced recalculation first." 
        },
        { status: 404 }
      );
    }
    
    const userSummary = userSummaryDoc.data();
    
    return NextResponse.json({
      success: true,
      userSummary
    });
    
  } catch (error: any) {
    console.error('Error fetching user summary:', error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch user summary.",
        error: error.message
      },
      { status: 500 }
    );
  }
}