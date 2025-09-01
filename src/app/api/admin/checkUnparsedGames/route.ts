import { NextResponse } from "next/server";
import { checkAndQueueUnparsedGamesAdmin } from "@/lib/admin-actions";

export async function POST() {
  try {
    const result = await checkAndQueueUnparsedGamesAdmin();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to check unparsed games.", 
        error: error.message,
        queuedCount: 0,
        alreadyQueuedCount: 0
      },
      { status: 500 }
    );
  }
}