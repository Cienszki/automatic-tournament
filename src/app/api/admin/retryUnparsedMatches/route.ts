import { NextResponse } from "next/server";
import { retryUnparsedMatchesAdmin } from "@/lib/admin-actions";

export async function POST() {
  try {
    const result = await retryUnparsedMatchesAdmin();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to retry unparsed matches.", 
        error: error.message,
        parsedCount: 0,
        stillUnparsedCount: 0,
        errorCount: 0
      },
      { status: 500 }
    );
  }
}